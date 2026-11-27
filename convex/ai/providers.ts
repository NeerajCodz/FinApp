/**
 * BYOK chat adapters. Each turns the agent's Gemini-shaped turn (contents, function
 * declarations) into a provider request, streams the reply and returns the same
 * `ChatStreamResult` the agent expects, so tools, cards and steps work on every provider.
 * Server-only; keys arrive decrypted for the duration of one request and are never logged.
 */
import { aiGeneration, aiRetry } from './config';
import { aiError } from './errors';
import type { GeminiSchema, GeminiUsage } from './gemini';
import { backoff, defaultSleep, RETRYABLE } from './gemini';
import {
  parseSseEvents,
  streamChat,
  type ChatStreamOptions,
  type ChatStreamResult,
  type GeminiContent,
  type GeminiContentPart,
  type GeminiFunctionCall,
} from './geminiChat';
import { AI_PROVIDERS, type AiProviderId } from '../shared/aiProviders';

export type ProviderConfig = {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  /** Overrides the provider default (required for `custom`). */
  baseUrl?: string;
};

export type ChatFn = (options: ChatStreamOptions) => Promise<ChatStreamResult>;

const ANTHROPIC_VERSION = '2023-06-01';

function baseUrlOf(config: ProviderConfig): string {
  return (config.baseUrl || AI_PROVIDERS[config.provider].baseUrl).replace(/\/+$/, '');
}

/** Gemini's OBJECT/STRING schema types to JSON Schema's lowercase types. */
export function toJsonSchema(schema: GeminiSchema | undefined): Record<string, unknown> {
  if (!schema) return { type: 'object', properties: {} };
  const convert = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(convert);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'type' && typeof value === 'string') out.type = value.toLowerCase();
      else if (key === 'nullable') continue;
      else out[key] = convert(value);
    }
    return out;
  };
  const result = convert(schema) as Record<string, unknown>;
  if (result.type === 'object' && !result.properties) result.properties = {};
  return result;
}

/** Gives every function call an id (providers need them to pair results with calls). */
function ensureCallIds(contents: GeminiContent[]): GeminiContent[] {
  let counter = 0;
  const pending: string[] = [];
  return contents.map((content) => ({
    ...content,
    parts: content.parts.map((part) => {
      if (part.functionCall) {
        const id = part.functionCall.id ?? `call_${counter++}`;
        pending.push(id);
        return { ...part, functionCall: { ...part.functionCall, id } };
      }
      if (part.functionResponse) {
        const id = part.functionResponse.id ?? pending.shift() ?? `call_${counter++}`;
        return { ...part, functionResponse: { ...part.functionResponse, id } };
      }
      return part;
    }),
  }));
}

/** Retries 429/5xx/network before anything streams, then hands back a streaming response. */
async function openStream(
  url: string,
  init: RequestInit,
  options: ChatStreamOptions,
  timeoutMs: number,
): Promise<{
  response: Response;
  controller: AbortController;
  restart: () => void;
  stop: () => void;
}> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  let lastFailure: 'busy' | 'unavailable' | 'timeout' = 'unavailable';
  for (let attempt = 0; attempt <= aiRetry.retries; attempt++) {
    const controller = new AbortController();
    // The first chunk may take longer (reasoning models think before answering).
    const firstChunkMs = Math.max(
      timeoutMs,
      options.firstChunkTimeoutMs ?? aiGeneration.chat.firstChunkTimeoutMs ?? timeoutMs,
    );
    const connectMs = Math.min(
      firstChunkMs,
      options.connectTimeoutMs ?? aiGeneration.chat.connectTimeoutMs ?? firstChunkMs,
    );
    let timer = setTimeout(() => controller.abort(), connectMs);
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => controller.abort(), timeoutMs);
    };
    const stop = () => clearTimeout(timer);
    let response: Response;
    try {
      response = await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (cause) {
      stop();
      lastFailure = controller.signal.aborted ? 'timeout' : 'unavailable';
      console.warn('[ai] BYOK request failed', lastFailure, String(cause).slice(0, 200));
      if (attempt < aiRetry.retries) await sleep(backoff(attempt, null));
      continue;
    }
    if (RETRYABLE.has(response.status)) {
      stop();
      lastFailure = response.status === 429 ? 'busy' : 'unavailable';
      if (attempt < aiRetry.retries)
        await sleep(backoff(attempt, response.headers.get('retry-after')));
      continue;
    }
    if (response.status === 401 || response.status === 403) {
      stop();
      throw aiError('AI_KEY_INVALID');
    }
    if (!response.ok || !response.body) {
      stop();
      console.warn('[ai] BYOK provider rejected request', response.status);
      throw aiError(response.ok ? 'AI_BAD_RESPONSE' : 'AI_REQUEST_REJECTED');
    }
    // Started: allow the model time to think before its first chunk.
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), firstChunkMs);
    return { response, controller, restart, stop };
  }
  throw aiError(
    lastFailure === 'busy'
      ? 'AI_BUSY'
      : lastFailure === 'timeout'
        ? 'AI_TIMEOUT'
        : 'AI_UNAVAILABLE',
  );
}

/** Reads an SSE body, calling `handle` for each `data:` payload. */
async function readSse(
  stream: Awaited<ReturnType<typeof openStream>>,
  handle: (payload: string) => Promise<void>,
) {
  const reader = stream.response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      stream.restart();
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseEvents(buffer);
      buffer = rest;
      for (const event of events) await handle(event);
    }
    const { events } = parseSseEvents(`${buffer}${decoder.decode()}\n\n`);
    for (const event of events) await handle(event);
  } catch (cause) {
    if (stream.controller.signal.aborted) throw aiError('AI_TIMEOUT');
    throw cause;
  } finally {
    stream.stop();
  }
}

function finish(
  text: string,
  calls: GeminiFunctionCall[],
  truncated: boolean,
  usage: GeminiUsage,
  model: string,
  finishReason: string,
): ChatStreamResult {
  if (truncated) throw aiError('AI_TRUNCATED');
  if (!text.trim() && calls.length === 0) throw aiError('AI_BAD_RESPONSE');
  const parts: GeminiContentPart[] = [
    ...(text ? [{ text }] : []),
    ...calls.map((functionCall) => ({ functionCall })),
  ];
  return { parts, text, functionCalls: calls, finishReason, usage, model };
}

const parseArgs = (raw: string): Record<string, unknown> => {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

/** Chat Completions (OpenAI and every OpenAI-compatible provider). */
export function openAiMessages(system: string | undefined, contents: GeminiContent[]) {
  const messages: Record<string, unknown>[] = system ? [{ role: 'system', content: system }] : [];
  for (const content of ensureCallIds(contents)) {
    if (content.role === 'model') {
      const text = content.parts
        .filter((part) => part.text && !part.thought)
        .map((part) => part.text)
        .join('');
      const calls = content.parts.filter((part) => part.functionCall);
      messages.push({
        role: 'assistant',
        content: text || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((part) => ({
                id: part.functionCall!.id,
                type: 'function',
                function: {
                  name: part.functionCall!.name,
                  arguments: JSON.stringify(part.functionCall!.args ?? {}),
                },
              })),
            }
          : {}),
      });
      continue;
    }
    const text = content.parts
      .filter((part) => part.text)
      .map((part) => part.text)
      .join('\n');
    // Attachments: images as data URLs, PDFs as files (OpenAI-compatible content parts).
    const media = content.parts.filter((part) => part.inlineData);
    if (media.length)
      messages.push({
        role: 'user',
        content: [
          ...(text ? [{ type: 'text', text }] : []),
          ...media.map((part, index) => {
            const { mimeType, data } = part.inlineData!;
            const url = `data:${mimeType};base64,${data}`;
            return mimeType === 'application/pdf'
              ? { type: 'file', file: { filename: `attachment-${index + 1}.pdf`, file_data: url } }
              : { type: 'image_url', image_url: { url } };
          }),
        ],
      });
    else if (text) messages.push({ role: 'user', content: text });
    for (const part of content.parts)
      if (part.functionResponse)
        messages.push({
          role: 'tool',
          tool_call_id: part.functionResponse.id,
          content: JSON.stringify(part.functionResponse.response),
        });
  }
  return messages;
}

async function openAiChat(
  config: ProviderConfig,
  options: ChatStreamOptions,
): Promise<ChatStreamResult> {
  const defaults = aiGeneration[options.role];
  const body = {
    model: config.model,
    stream: true,
    stream_options: { include_usage: true },
    messages: openAiMessages(options.systemInstruction, options.contents),
    ...(options.functions?.length
      ? {
          tools: options.functions.map((fn) => ({
            type: 'function',
            function: {
              name: fn.name,
              description: fn.description,
              parameters: toJsonSchema(fn.parameters),
            },
          })),
          tool_choice: 'auto',
        }
      : {}),
    max_completion_tokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
  };
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://fin.neeraj.fyi';
    headers['X-Title'] = 'Finapp';
  }
  const stream = await openStream(
    `${baseUrlOf(config)}/chat/completions`,
    { method: 'POST', headers, body: JSON.stringify(body) },
    options,
    options.timeoutMs ?? defaults.timeoutMs,
  );
  let text = '';
  let finishReason = 'stop';
  const usage: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  const calls = new Map<number, { id: string; name: string; args: string }>();
  await readSse(stream, async (payload) => {
    let chunk: {
      choices?: {
        delta?: {
          content?: string | null;
          tool_calls?: {
            index?: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }[];
        };
        finish_reason?: string | null;
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      error?: { message?: string };
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      throw aiError('AI_BAD_RESPONSE');
    }
    if (chunk.error) throw aiError('AI_REQUEST_REJECTED');
    if (chunk.usage) {
      usage.promptTokens = chunk.usage.prompt_tokens ?? 0;
      usage.outputTokens = chunk.usage.completion_tokens ?? 0;
      usage.totalTokens = chunk.usage.total_tokens ?? usage.promptTokens + usage.outputTokens;
    }
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta;
    if (delta?.content) {
      text += delta.content;
      await options.onText?.(delta.content);
    }
    for (const call of delta?.tool_calls ?? []) {
      const index = call.index ?? 0;
      const current = calls.get(index) ?? { id: '', name: '', args: '' };
      if (call.id) current.id = call.id;
      if (call.function?.name) current.name += call.function.name;
      if (call.function?.arguments) current.args += call.function.arguments;
      calls.set(index, current);
    }
  });
  if (finishReason === 'content_filter') throw aiError('AI_BLOCKED');
  const functionCalls = [...calls.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, call]) => call.name)
    .map(([index, call]) => ({
      name: call.name,
      args: parseArgs(call.args),
      id: call.id || `call_${index}`,
    }));
  return finish(text, functionCalls, finishReason === 'length', usage, config.model, finishReason);
}

function assertAnthropicImageTypes(contents: GeminiContent[]) {
  for (const content of contents) {
    for (const part of content.parts) {
      const mimeType = part.inlineData?.mimeType.toLowerCase();
      if (mimeType === 'image/heic' || mimeType === 'image/heif') {
        throw aiError(
          'AI_REQUEST_REJECTED',
          'Anthropic does not support HEIC/HEIF images. Convert the image to JPEG, PNG, or WebP and try again.',
        );
      }
    }
  }
}

/** Anthropic Messages API (alternating roles, tool_use / tool_result blocks). */
export function anthropicMessages(contents: GeminiContent[]) {
  const messages: { role: 'user' | 'assistant'; content: Record<string, unknown>[] }[] = [];
  const push = (role: 'user' | 'assistant', blocks: Record<string, unknown>[]) => {
    if (!blocks.length) return;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };
  for (const content of ensureCallIds(contents)) {
    const blocks: Record<string, unknown>[] = [];
    for (const part of content.parts) {
      if (part.thought) continue;
      if (part.functionCall)
        blocks.push({
          type: 'tool_use',
          id: part.functionCall.id,
          name: part.functionCall.name,
          input: part.functionCall.args ?? {},
        });
      else if (part.functionResponse)
        blocks.push({
          type: 'tool_result',
          tool_use_id: part.functionResponse.id,
          content: JSON.stringify(part.functionResponse.response),
        });
      else if (part.inlineData)
        blocks.push({
          type: part.inlineData.mimeType === 'application/pdf' ? 'document' : 'image',
          source: {
            type: 'base64',
            media_type: part.inlineData.mimeType,
            data: part.inlineData.data,
          },
        });
      else if (part.text) blocks.push({ type: 'text', text: part.text });
    }
    push(content.role === 'model' ? 'assistant' : 'user', blocks);
  }
  return messages;
}

async function anthropicChat(
  config: ProviderConfig,
  options: ChatStreamOptions,
): Promise<ChatStreamResult> {
  assertAnthropicImageTypes(options.contents);
  const defaults = aiGeneration[options.role];
  const body = {
    model: config.model,
    stream: true,
    max_tokens: options.maxOutputTokens ?? defaults.maxOutputTokens,
    ...(options.systemInstruction ? { system: options.systemInstruction } : {}),
    messages: anthropicMessages(options.contents),
    ...(options.functions?.length
      ? {
          tools: options.functions.map((fn) => ({
            name: fn.name,
            description: fn.description,
            input_schema: toJsonSchema(fn.parameters),
          })),
        }
      : {}),
  };
  const stream = await openStream(
    `${baseUrlOf(config)}/messages`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    },
    options,
    options.timeoutMs ?? defaults.timeoutMs,
  );
  let text = '';
  let stopReason = 'end_turn';
  const usage: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  const blocks = new Map<
    number,
    { kind: 'text' | 'tool'; id?: string; name?: string; json: string }
  >();
  await readSse(stream, async (payload) => {
    let event: {
      type?: string;
      index?: number;
      message?: { usage?: { input_tokens?: number; output_tokens?: number } };
      content_block?: { type?: string; id?: string; name?: string };
      delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string };
      usage?: { output_tokens?: number };
      error?: { type?: string };
    };
    try {
      event = JSON.parse(payload);
    } catch {
      throw aiError('AI_BAD_RESPONSE');
    }
    switch (event.type) {
      case 'error':
        throw aiError(event.error?.type === 'overloaded_error' ? 'AI_BUSY' : 'AI_REQUEST_REJECTED');
      case 'message_start':
        usage.promptTokens = event.message?.usage?.input_tokens ?? 0;
        break;
      case 'content_block_start':
        blocks.set(event.index ?? 0, {
          kind: event.content_block?.type === 'tool_use' ? 'tool' : 'text',
          id: event.content_block?.id,
          name: event.content_block?.name,
          json: '',
        });
        break;
      case 'content_block_delta': {
        const block = blocks.get(event.index ?? 0);
        if (event.delta?.type === 'text_delta' && event.delta.text) {
          text += event.delta.text;
          await options.onText?.(event.delta.text);
        } else if (event.delta?.type === 'input_json_delta' && block) {
          block.json += event.delta.partial_json ?? '';
        }
        break;
      }
      case 'message_delta':
        if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        if (event.usage?.output_tokens) usage.outputTokens = event.usage.output_tokens;
        break;
      default:
        break;
    }
  });
  usage.totalTokens = usage.promptTokens + usage.outputTokens;
  if (stopReason === 'refusal') throw aiError('AI_BLOCKED');
  const functionCalls = [...blocks.entries()]
    .sort(([a], [b]) => a - b)
    .filter(([, block]) => block.kind === 'tool' && block.name)
    .map(([index, block]) => ({
      name: block.name!,
      args: parseArgs(block.json),
      id: block.id ?? `call_${index}`,
    }));
  return finish(text, functionCalls, stopReason === 'max_tokens', usage, config.model, stopReason);
}

/** The chat function for a BYOK configuration. */
export function providerChat(config: ProviderConfig): ChatFn {
  const api = AI_PROVIDERS[config.provider].api;
  if (api === 'anthropic') return (options) => anthropicChat(config, options);
  if (api === 'gemini')
    return (options) =>
      streamChat({
        ...options,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
      });
  return (options) => openAiChat(config, options);
}

/**
 * Checks a key by listing models (cheap, no tokens spent). Returns null when the key works, or
 * an error code: AI_KEY_INVALID (rejected), AI_UNAVAILABLE (couldn't reach the provider).
 */
export async function checkProviderKey(
  config: Omit<ProviderConfig, 'model'>,
  fetchImpl: typeof fetch = fetch,
): Promise<null | 'AI_KEY_INVALID' | 'AI_UNAVAILABLE'> {
  const api = AI_PROVIDERS[config.provider].api;
  const base = baseUrlOf({ ...config, model: '' });
  const request: { url: string; headers: Record<string, string> } =
    api === 'anthropic'
      ? {
          url: `${base}/models?limit=1`,
          headers: { 'x-api-key': config.apiKey, 'anthropic-version': ANTHROPIC_VERSION },
        }
      : api === 'gemini'
        ? { url: `${base}/models?pageSize=1`, headers: { 'x-goog-api-key': config.apiKey } }
        : { url: `${base}/models`, headers: { authorization: `Bearer ${config.apiKey}` } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(request.url, {
      headers: request.headers,
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) return 'AI_KEY_INVALID';
    return response.ok ? null : 'AI_UNAVAILABLE';
  } catch {
    return 'AI_UNAVAILABLE';
  } finally {
    clearTimeout(timer);
  }
}
