/**
 * Multi-turn Gemini chat with function calling, streamed over SSE (`streamGenerateContent`).
 * Used by the FinAI agent loop. Shares the key, retry, block-reason and usage handling of
 * `gemini.ts`; model ids come from `config.ts` by role. Server-only.
 */
import {
  aiAttempts,
  aiGeneration,
  aiModelForAttempt,
  aiRetry,
  aiShouldBackoff,
  GEMINI_API_BASE,
} from './config';
import { aiError } from './errors';
import {
  backoff,
  BLOCKED_FINISH,
  defaultSleep,
  requireGeminiKey,
  RETRYABLE,
  usageOf,
  type GeminiResponse,
  type GeminiSchema,
  type GeminiUsage,
  type GenerateOptions,
} from './gemini';

export type GeminiFunctionCall = { name: string; args?: Record<string, unknown>; id?: string };
export type GeminiFunctionResponse = {
  name: string;
  response: Record<string, unknown>;
  id?: string;
};

/** One part of a chat turn. Model parts are echoed back verbatim (thought signatures included). */
export type GeminiContentPart = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponse;
  inlineData?: { mimeType: string; data: string };
};
export type GeminiContent = { role: 'user' | 'model'; parts: GeminiContentPart[] };

export type GeminiFunctionDeclaration = {
  name: string;
  description: string;
  parameters?: GeminiSchema;
};

export type ChatStreamOptions = Omit<GenerateOptions, 'parts'> & {
  contents: GeminiContent[];
  functions?: GeminiFunctionDeclaration[];
  /** Called with each text delta as it streams (never with thoughts or function calls). */
  onText?: (delta: string) => void | Promise<void>;
  /** BYOK: one fixed model instead of the role's model chain. */
  model?: string;
  /** BYOK: API base override (defaults to GEMINI_API_BASE). */
  baseUrl?: string;
};

export type ChatStreamResult = {
  /** The model turn to append to `contents` before sending function responses. */
  parts: GeminiContentPart[];
  text: string;
  functionCalls: GeminiFunctionCall[];
  finishReason: string;
  usage: GeminiUsage;
  model: string;
};

type StreamChunk = {
  candidates?: { content?: { parts?: GeminiContentPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: GeminiResponse['usageMetadata'];
};

/** The streamGenerateContent (SSE) URL for a model id (URL-encoded). */
export function geminiStreamUrl(model: string, base: string = GEMINI_API_BASE): string {
  return `${base.replace(/\/+$/, '')}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
}

/** Splits an SSE buffer into complete `data:` payloads and the unfinished remainder. */
export function parseSseEvents(buffer: string): { events: string[]; rest: string } {
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: string[] = [];
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data && data !== '[DONE]') events.push(data);
  }
  return { events, rest };
}

const isPlainText = (part: GeminiContentPart) =>
  typeof part.text === 'string' && !part.functionCall && !part.thought;

/** Appends streamed parts, merging consecutive plain text so the echoed turn stays compact. */
export function mergeStreamParts(into: GeminiContentPart[], incoming: GeminiContentPart[]): void {
  for (const part of incoming) {
    const last = into[into.length - 1];
    if (isPlainText(part) && last && isPlainText(last) && !last.thoughtSignature) {
      last.text += part.text!;
      if (part.thoughtSignature) last.thoughtSignature = part.thoughtSignature;
      continue;
    }
    into.push({ ...part });
  }
}

/**
 * One model turn of a multi-turn chat, streamed. Text deltas go to `onText` as they arrive;
 * function calls come back in `functionCalls`, with the raw `parts` to echo back. Retries
 * 429 / 5xx / network failures only before anything has streamed. The timeout is an idle
 * timeout that restarts whenever a chunk arrives.
 */
export async function streamChat(options: ChatStreamOptions): Promise<ChatStreamResult> {
  const apiKey = requireGeminiKey(options.apiKey);
  const defaults = aiGeneration[options.role];
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? defaults.timeoutMs;
  const body = JSON.stringify({
    ...(options.systemInstruction
      ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } }
      : {}),
    contents: options.contents,
    ...(options.functions?.length
      ? {
          tools: [{ functionDeclarations: options.functions }],
          toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        }
      : {}),
    generationConfig: {
      temperature: options.temperature ?? defaults.temperature,
      maxOutputTokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
    },
  });

  let lastFailure: 'busy' | 'unavailable' | 'timeout' = 'unavailable';
  const attempts = options.model ? aiRetry.retries + 1 : aiAttempts(options.role);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const model = options.model ?? aiModelForAttempt(options.role, attempt);
    const wait =
      attempt < attempts - 1 && (options.model ? true : aiShouldBackoff(options.role, attempt));
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), timeoutMs);
    const restartTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), timeoutMs);
    };
    let response: Response;
    try {
      response = await fetchImpl(geminiStreamUrl(model, options.baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      lastFailure = controller.signal.aborted ? 'timeout' : 'unavailable';
      console.warn('[ai] Gemini stream failed', model, lastFailure, String(cause));
      if (wait) await sleep(backoff(attempt, null));
      continue;
    }
    if (RETRYABLE.has(response.status)) {
      clearTimeout(timer);
      lastFailure = response.status === 429 ? 'busy' : 'unavailable';
      console.warn('[ai] Gemini stream retryable status', model, response.status);
      if (wait) await sleep(backoff(attempt, response.headers.get('retry-after')));
      continue;
    }
    if (options.model && (response.status === 401 || response.status === 403)) {
      clearTimeout(timer);
      throw aiError('AI_KEY_INVALID');
    }
    if (!response.ok || !response.body) {
      clearTimeout(timer);
      console.warn('[ai] Gemini rejected stream', model, response.status);
      throw aiError(response.ok ? 'AI_BAD_RESPONSE' : 'AI_REQUEST_REJECTED');
    }

    const parts: GeminiContentPart[] = [];
    let finishReason = 'STOP';
    let usage: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
    let text = '';
    const handle = async (payload: string) => {
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        throw aiError('AI_BAD_RESPONSE');
      }
      if (chunk.promptFeedback?.blockReason) throw aiError('AI_BLOCKED');
      if (chunk.usageMetadata) usage = usageOf({ usageMetadata: chunk.usageMetadata });
      const candidate = chunk.candidates?.[0];
      if (candidate?.finishReason) finishReason = candidate.finishReason;
      const incoming = candidate?.content?.parts ?? [];
      mergeStreamParts(parts, incoming);
      for (const part of incoming) {
        if (isPlainText(part) && part.text) {
          text += part.text;
          await options.onText?.(part.text);
        }
      }
    };
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        restartTimer();
        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseEvents(buffer);
        buffer = rest;
        for (const event of events) await handle(event);
      }
      const { events } = parseSseEvents(`${buffer}${decoder.decode()}\n\n`);
      for (const event of events) await handle(event);
    } catch (cause) {
      if (controller.signal.aborted) throw aiError('AI_TIMEOUT');
      throw cause;
    } finally {
      clearTimeout(timer);
    }
    if (BLOCKED_FINISH.has(finishReason)) throw aiError('AI_BLOCKED');
    const functionCalls = parts
      .filter((part) => part.functionCall?.name)
      .map((part) => part.functionCall!);
    // A turn cut off at the token limit is incomplete even if it streamed some text or a
    // function call: never present it (or act on it) as a finished answer.
    if (finishReason === 'MAX_TOKENS') throw aiError('AI_TRUNCATED');
    if (!text.trim() && functionCalls.length === 0) throw aiError('AI_BAD_RESPONSE');
    return { parts, text, functionCalls, finishReason, usage, model };
  }
  throw aiError(
    lastFailure === 'busy'
      ? 'AI_BUSY'
      : lastFailure === 'timeout'
        ? 'AI_TIMEOUT'
        : 'AI_UNAVAILABLE',
  );
}
