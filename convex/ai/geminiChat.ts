/**
 * Multi-turn Gemini chat with function calling, streamed over SSE (`streamGenerateContent`).
 * Used by the FinAI agent loop. Shares the key, retry, block-reason and usage handling of
 * `gemini.ts`; model ids come from `config.ts` by role. Server-only.
 */
import { aiGeneration, aiModels, aiRetry, GEMINI_API_BASE, type AiRole } from './config';
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

/** The streamGenerateContent (SSE) URL for a role; the model id is URL-encoded. */
export function geminiStreamUrl(role: AiRole): string {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(aiModels[role])}:streamGenerateContent?alt=sse`;
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
  for (let attempt = 0; attempt <= aiRetry.retries; attempt++) {
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), timeoutMs);
    const restartTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), timeoutMs);
    };
    let response: Response;
    try {
      response = await fetchImpl(geminiStreamUrl(options.role), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      lastFailure = controller.signal.aborted ? 'timeout' : 'unavailable';
      console.warn('[ai] Gemini stream failed', options.role, lastFailure, String(cause));
      if (attempt < aiRetry.retries) await sleep(backoff(attempt, null));
      continue;
    }
    if (RETRYABLE.has(response.status)) {
      clearTimeout(timer);
      lastFailure = response.status === 429 ? 'busy' : 'unavailable';
      console.warn('[ai] Gemini stream retryable status', options.role, response.status);
      if (attempt < aiRetry.retries)
        await sleep(backoff(attempt, response.headers.get('retry-after')));
      continue;
    }
    if (!response.ok || !response.body) {
      clearTimeout(timer);
      console.warn('[ai] Gemini rejected stream', options.role, response.status);
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
    if (!text.trim() && functionCalls.length === 0)
      throw aiError(finishReason === 'MAX_TOKENS' ? 'AI_TRUNCATED' : 'AI_BAD_RESPONSE');
    return { parts, text, functionCalls, finishReason, usage, model: aiModels[options.role] };
  }
  throw aiError(
    lastFailure === 'busy'
      ? 'AI_BUSY'
      : lastFailure === 'timeout'
        ? 'AI_TIMEOUT'
        : 'AI_UNAVAILABLE',
  );
}
