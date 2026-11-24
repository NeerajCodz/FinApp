/**
 * A small Gemini REST client (no SDK, no "typesafe AI" wrapper): `generateStructured` asks for
 * JSON with Gemini structured outputs (`responseMimeType` + `responseSchema`) and parses it;
 * `generateText` returns plain text. Both add a timeout, retry 429 / 5xx / network failures
 * with exponential backoff, handle block and finish reasons, capture token usage and throw
 * `aiError` codes. Callers still validate the parsed JSON with plain TypeScript before use.
 * Server-only: it reads `GEMINI_API_KEY` from the Convex environment.
 */
import {
  aiGeneration,
  aiModels,
  aiRetry,
  GEMINI_API_BASE,
  GEMINI_API_KEY_ENV,
  type AiRole,
} from './config';
import { aiError } from './errors';

/** OpenAPI-subset schema accepted by Gemini's `responseSchema`. */
export type GeminiSchema = {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN';
  description?: string;
  nullable?: boolean;
  enum?: string[];
  format?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  propertyOrdering?: string[];
  items?: GeminiSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
};

export type GeminiPart =
  | { text: string }
  /** Base64 bytes sent inline (images up to ~20 MB request size). */
  | { inlineData: { mimeType: string; data: string } }
  /** A file already uploaded to the Gemini Files API (or a supported URI). */
  | { fileData: { mimeType: string; fileUri: string } };

export type GeminiUsage = { promptTokens: number; outputTokens: number; totalTokens: number };

export type GenerateOptions = {
  role: AiRole;
  systemInstruction?: string;
  parts: GeminiPart[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Test seams; default to the global fetch, a real sleep and `process.env`. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
};

export type GenerateTextResult = {
  text: string;
  model: string;
  finishReason: string;
  usage: GeminiUsage;
};
export type GenerateStructuredResult<T> = GenerateTextResult & { data: T };

/** The API key, or `AI_NOT_CONFIGURED`. */
export function requireGeminiKey(explicit?: string): string {
  const key = (explicit ?? process.env[GEMINI_API_KEY_ENV] ?? '').trim();
  if (!key) throw aiError('AI_NOT_CONFIGURED');
  return key;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env[GEMINI_API_KEY_ENV]?.trim());
}

/** The generateContent URL for a role; the model id is URL-encoded (it may contain spaces). */
export function geminiUrl(role: AiRole): string {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(aiModels[role])}:generateContent`;
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const BLOCKED_FINISH = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'LANGUAGE',
]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function backoff(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, aiRetry.maxDelayMs);
  const exponential = aiRetry.baseDelayMs * 2 ** attempt;
  return Math.min(
    exponential + Math.floor(Math.random() * aiRetry.baseDelayMs),
    aiRetry.maxDelayMs,
  );
}

function usageOf(response: GeminiResponse): GeminiUsage {
  const meta = response.usageMetadata ?? {};
  const promptTokens = meta.promptTokenCount ?? 0;
  const outputTokens = meta.candidatesTokenCount ?? 0;
  return {
    promptTokens,
    outputTokens,
    totalTokens: meta.totalTokenCount ?? promptTokens + outputTokens,
  };
}

async function callGemini(
  options: GenerateOptions,
  generationConfig: Record<string, unknown>,
): Promise<GenerateTextResult> {
  const apiKey = requireGeminiKey(options.apiKey);
  const defaults = aiGeneration[options.role];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? defaults.timeoutMs;
  const body = JSON.stringify({
    ...(options.systemInstruction
      ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
      : {}),
    contents: [{ role: 'user', parts: options.parts }],
    generationConfig: {
      temperature: options.temperature ?? defaults.temperature,
      maxOutputTokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
      ...generationConfig,
    },
  });

  let lastFailure: 'busy' | 'unavailable' | 'timeout' = 'unavailable';
  for (let attempt = 0; attempt <= aiRetry.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(geminiUrl(options.role), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      lastFailure = controller.signal.aborted ? 'timeout' : 'unavailable';
      console.warn('[ai] Gemini request failed', options.role, lastFailure, String(cause));
      if (attempt < aiRetry.retries) await sleep(backoff(attempt, null));
      continue;
    }
    clearTimeout(timer);
    if (RETRYABLE.has(response.status)) {
      lastFailure = response.status === 429 ? 'busy' : 'unavailable';
      console.warn('[ai] Gemini retryable status', options.role, response.status);
      if (attempt < aiRetry.retries)
        await sleep(backoff(attempt, response.headers.get('retry-after')));
      continue;
    }
    if (!response.ok) {
      console.warn('[ai] Gemini rejected request', options.role, response.status);
      throw aiError('AI_REQUEST_REJECTED');
    }
    let payload: GeminiResponse;
    try {
      payload = (await response.json()) as GeminiResponse;
    } catch {
      throw aiError('AI_BAD_RESPONSE');
    }
    if (payload.promptFeedback?.blockReason) throw aiError('AI_BLOCKED');
    const candidate = payload.candidates?.[0];
    const finishReason = candidate?.finishReason ?? 'STOP';
    if (BLOCKED_FINISH.has(finishReason)) throw aiError('AI_BLOCKED');
    if (finishReason === 'MAX_TOKENS') throw aiError('AI_TRUNCATED');
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    if (!text.trim()) throw aiError('AI_BAD_RESPONSE');
    return { text, model: aiModels[options.role], finishReason, usage: usageOf(payload) };
  }
  throw aiError(
    lastFailure === 'busy'
      ? 'AI_BUSY'
      : lastFailure === 'timeout'
        ? 'AI_TIMEOUT'
        : 'AI_UNAVAILABLE',
  );
}

/** Plain text generation for a role. */
export function generateText(options: GenerateOptions): Promise<GenerateTextResult> {
  return callGemini(options, {});
}

/**
 * JSON generation constrained by `responseSchema` (Gemini structured outputs). Returns the parsed
 * value as `unknown`-backed `T`: validate it before trusting it.
 */
export async function generateStructured<T = unknown>(
  options: GenerateOptions & { responseSchema: GeminiSchema },
): Promise<GenerateStructuredResult<T>> {
  const result = await callGemini(options, {
    responseMimeType: 'application/json',
    responseSchema: options.responseSchema,
  });
  try {
    return { ...result, data: JSON.parse(result.text) as T };
  } catch {
    throw aiError('AI_BAD_RESPONSE');
  }
}

/** Base64 for bytes without Node's Buffer (Convex's default runtime has `btoa`). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk)
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  return btoa(binary);
}
