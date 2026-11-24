import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiModelChain, aiModels } from '../../convex/ai/config';
import { aiErrorCode } from '../../convex/ai/errors';
import { bytesToBase64, generateStructured, generateText, geminiUrl } from '../../convex/ai/gemini';

afterEach(() => vi.unstubAllEnvs());

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
const answer = (text: string, finishReason = 'STOP') => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason }],
  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 30, totalTokenCount: 150 },
});
const noSleep = () => Promise.resolve();

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return aiErrorCode(error);
  }
}

describe('gemini client', () => {
  it('keeps model ids in config and URL-encodes them', () => {
    expect(aiModels).toEqual({
      chat: 'gemini-3.8-flash',
      ocr: 'gemini-3.5-flash-lite',
      decision: 'gemini-decision-1',
      utility: 'gemini-3.5-flash-lite',
    });
    expect(geminiUrl('a model')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/a%20model:generateContent',
    );
  });

  it('falls back to the next model when the primary is overloaded, without waiting', async () => {
    const urls: string[] = [];
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      urls.push(String(url));
      if (urls.length === 1) return new Response('{}', { status: 503 });
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'hi' }] }, finishReason: 'STOP' }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const result = await generateText({
      role: 'chat',
      parts: [{ text: 'x' }],
      fetchImpl,
      sleep,
      apiKey: 'k',
    });
    expect(urls[0]).toContain(`/models/${aiModelChain('chat')[0]}:`);
    expect(urls[1]).toContain(`/models/${aiModelChain('chat')[1]}:`);
    expect(result.model).toBe(aiModelChain('chat')[1]);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('fails with AI_NOT_CONFIGURED without a key and never calls fetch', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const fetchImpl = vi.fn();
    expect(await codeOf(generateText({ role: 'chat', parts: [{ text: 'hi' }], fetchImpl }))).toBe(
      'AI_NOT_CONFIGURED',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends structured-output config and parses JSON with usage', async () => {
    const fetchImpl = vi.fn(async () => ok(answer('{"total": 12.5}')));
    const result = await generateStructured<{ total: number }>({
      role: 'ocr',
      apiKey: 'test-key',
      systemInstruction: 'Read receipts',
      parts: [{ inlineData: { mimeType: 'image/png', data: 'AAAA' } }, { text: 'Go' }],
      responseSchema: { type: 'OBJECT', properties: { total: { type: 'NUMBER' } } },
      fetchImpl,
    });
    expect(result.data).toEqual({ total: 12.5 });
    expect(result.usage).toEqual({ promptTokens: 120, outputTokens: 30, totalTokens: 150 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/gemini-3.5-flash-lite:generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(String(init.body));
    expect(body.generationConfig).toMatchObject({
      responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT' },
      temperature: 0,
    });
    expect(body.systemInstruction.parts[0].text).toBe('Read receipts');
    expect(body.contents[0].parts[0].inlineData.mimeType).toBe('image/png');
  });

  it('retries 429 and 5xx with backoff, then succeeds', async () => {
    const sleep = vi.fn(noSleep);
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(new Response('oops', { status: 503 }))
      .mockResolvedValueOnce(ok(answer('hello')));
    const result = await generateText({
      role: 'chat',
      apiKey: 'k',
      parts: [{ text: 'hi' }],
      fetchImpl,
      sleep,
    });
    expect(result.text).toBe('hello');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Each retry moves straight to the next model in the chain.
    expect(sleep).not.toHaveBeenCalled();
  });

  it('maps failures to error codes', async () => {
    const run = (fetchImpl: typeof fetch) =>
      codeOf(
        generateStructured({
          role: 'ocr',
          apiKey: 'k',
          parts: [{ text: 'x' }],
          responseSchema: { type: 'OBJECT' },
          fetchImpl,
          sleep: noSleep,
        }),
      );
    expect(await run(vi.fn(async () => new Response('', { status: 429 })))).toBe('AI_BUSY');
    expect(await run(vi.fn(async () => new Response('', { status: 500 })))).toBe('AI_UNAVAILABLE');
    expect(await run(vi.fn(async () => new Response('', { status: 404 })))).toBe(
      'AI_REQUEST_REJECTED',
    );
    expect(
      await run(
        vi.fn(async () => {
          throw new TypeError('network down');
        }),
      ),
    ).toBe('AI_UNAVAILABLE');
    expect(await run(vi.fn(async () => ok({ promptFeedback: { blockReason: 'SAFETY' } })))).toBe(
      'AI_BLOCKED',
    );
    expect(await run(vi.fn(async () => ok(answer('{}', 'SAFETY'))))).toBe('AI_BLOCKED');
    expect(await run(vi.fn(async () => ok(answer('{"a":', 'MAX_TOKENS'))))).toBe('AI_TRUNCATED');
    expect(await run(vi.fn(async () => ok(answer('not json'))))).toBe('AI_BAD_RESPONSE');
    expect(await run(vi.fn(async () => ok({ candidates: [] })))).toBe('AI_BAD_RESPONSE');
  });

  it('times out slow requests', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ) as unknown as typeof fetch;
    expect(
      await codeOf(
        generateText({
          role: 'decision',
          apiKey: 'k',
          parts: [{ text: 'x' }],
          timeoutMs: 5,
          fetchImpl,
          sleep: noSleep,
        }),
      ),
    ).toBe('AI_TIMEOUT');
  });

  it('encodes bytes as base64 without Buffer', () => {
    expect(bytesToBase64(new TextEncoder().encode('receipt'))).toBe('cmVjZWlwdA==');
  });
});
