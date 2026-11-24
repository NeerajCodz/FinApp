import { describe, expect, it, vi } from 'vitest';
import { buildA2uiMessages, FINAI_CATALOG_ID, type FinView } from '../../convex/ai/a2ui';
import { runAgent, toolErrorCode, type AgentTool } from '../../convex/ai/agent';
import { historyContents } from '../../convex/ai/assistant';
import {
  geminiStreamUrl,
  mergeStreamParts,
  parseSseEvents,
  streamChat,
  type ChatStreamOptions,
  type ChatStreamResult,
  type GeminiContentPart,
} from '../../convex/ai/geminiChat';
import { aiErrorCode } from '../../convex/ai/errors';
import { mentionsFinai, stripMention } from '../../convex/ai/mentions';
import { formatMinor, parseMajorToMinor, presentMoney } from '../../convex/ai/present';
import { amountMinor, window } from '../../convex/ai/toolArgs';

const encoder = new TextEncoder();
function sseResponse(chunks: unknown[], split = 7) {
  const text = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\r\n\r\n`).join('');
  // Deliver in small slices so events straddle reads.
  const pieces: Uint8Array[] = [];
  for (let index = 0; index < text.length; index += split)
    pieces.push(encoder.encode(text.slice(index, index + split)));
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const piece of pieces) controller.enqueue(piece);
        controller.close();
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  );
}
const textChunk = (text: string, extra: Record<string, unknown> = {}) => ({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, ...extra }],
});

describe('SSE parsing', () => {
  it('returns complete data events and keeps the unfinished tail', () => {
    const { events, rest } = parseSseEvents('data: {"a":1}\n\ndata: {"b":2}\r\n\r\ndata: {"c"');
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe('data: {"c"');
  });

  it('merges consecutive text parts but keeps function calls and thoughts separate', () => {
    const parts: GeminiContentPart[] = [];
    mergeStreamParts(parts, [{ text: 'Hel' }]);
    mergeStreamParts(parts, [{ text: 'lo', thoughtSignature: 'sig' }]);
    mergeStreamParts(parts, [{ functionCall: { name: 'x', args: {} } }]);
    mergeStreamParts(parts, [{ text: 'thinking', thought: true }]);
    expect(parts).toEqual([
      { text: 'Hello', thoughtSignature: 'sig' },
      { functionCall: { name: 'x', args: {} } },
      { text: 'thinking', thought: true },
    ]);
  });

  it('URL-encodes the configured model id', () => {
    expect(geminiStreamUrl('gemini-3.8-flash')).toContain(
      '/models/gemini-3.8-flash:streamGenerateContent?alt=sse',
    );
    expect(geminiStreamUrl('a b')).toContain('a%20b');
  });
});

describe('streamChat', () => {
  it('streams text deltas, collects function calls and usage', async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        textChunk('Let me '),
        textChunk('check.'),
        {
          candidates: [
            {
              content: {
                parts: [
                  {
                    functionCall: { name: 'get_overview', args: { days: 7 } },
                    thoughtSignature: 's1',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 9, totalTokenCount: 59 },
        },
      ]),
    );
    const deltas: string[] = [];
    const result = await streamChat({
      role: 'chat',
      apiKey: 'k',
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      functions: [{ name: 'get_overview', description: 'x' }],
      fetchImpl,
      onText: (delta) => {
        deltas.push(delta);
      },
    });
    expect(deltas).toEqual(['Let me ', 'check.']);
    expect(result.text).toBe('Let me check.');
    expect(result.functionCalls).toEqual([{ name: 'get_overview', args: { days: 7 } }]);
    expect(result.parts[1]).toMatchObject({ thoughtSignature: 's1' });
    expect(result.usage).toEqual({ promptTokens: 50, outputTokens: 9, totalTokens: 59 });
    const body = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string);
    expect(body.tools[0].functionDeclarations[0].name).toBe('get_overview');
    expect(body.toolConfig.functionCallingConfig.mode).toBe('AUTO');
  });

  it('retries 503 before streaming, then maps blocks and empty answers to error codes', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(sseResponse([textChunk('ok', { finishReason: 'STOP' })]));
    const result = await streamChat({
      role: 'chat',
      apiKey: 'k',
      contents: [],
      fetchImpl,
      sleep,
    });
    expect(result.text).toBe('ok');
    expect(sleep).not.toHaveBeenCalled(); // the retry used the fallback model

    const blocked = streamChat({
      role: 'chat',
      apiKey: 'k',
      contents: [],
      fetchImpl: async () => sseResponse([{ promptFeedback: { blockReason: 'SAFETY' } }]),
    });
    await expect(blocked.catch(aiErrorCode)).resolves.toBe('AI_BLOCKED');
    const empty = streamChat({
      role: 'chat',
      apiKey: 'k',
      contents: [],
      fetchImpl: async () => sseResponse([textChunk('', { finishReason: 'STOP' })]),
    });
    await expect(empty.catch(aiErrorCode)).resolves.toBe('AI_BAD_RESPONSE');
    const rejected = streamChat({
      role: 'chat',
      apiKey: 'k',
      contents: [],
      fetchImpl: async () => new Response('bad', { status: 400 }),
    });
    await expect(rejected.catch(aiErrorCode)).resolves.toBe('AI_REQUEST_REJECTED');
  });
});

function fakeChat(turns: Partial<ChatStreamResult>[]) {
  const calls: ChatStreamOptions[] = [];
  const chat = async (options: ChatStreamOptions): Promise<ChatStreamResult> => {
    calls.push({ ...options, contents: [...options.contents] });
    const turn = turns.shift() ?? { text: 'done' };
    if (turn.text) await options.onText?.(turn.text);
    return {
      parts: turn.parts ?? [{ text: turn.text ?? '' }],
      text: turn.text ?? '',
      functionCalls: turn.functionCalls ?? [],
      finishReason: 'STOP',
      usage: { promptTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: 'test',
    };
  };
  return { chat, calls };
}

describe('runAgent', () => {
  const overview: AgentTool<{ spent: bigint }> = {
    name: 'get_overview',
    description: 'overview',
    progress: { stage: 'searching', label: 'Reading…' },
    run: async (ctx) => ({
      data: { currency: 'INR', spentMinor: ctx.spent },
      views: [{ kind: 'summary', title: 'Month', metrics: [{ label: 'Spent', value: '₹1.00' }] }],
    }),
  };
  const broken: AgentTool<{ spent: bigint }> = {
    name: 'broken',
    description: 'fails',
    progress: { stage: 'working', label: 'Working…' },
    run: async () => {
      throw new Error('NOT_MEMBER');
    },
  };

  it('runs tools, feeds presented results back and collects views', async () => {
    const { chat, calls } = fakeChat([
      {
        text: '',
        parts: [{ functionCall: { name: 'get_overview', args: {} }, thoughtSignature: 'sig' }],
        functionCalls: [{ name: 'get_overview', args: {} }],
      },
      { text: 'You spent ₹1.00.' },
    ]);
    const progress: string[] = [];
    const texts: string[] = [];
    const result = await runAgent({
      ctx: { spent: 100n },
      system: 'sys',
      contents: [{ role: 'user', parts: [{ text: 'how much did I spend?' }] }],
      tools: [overview],
      chat,
      onProgress: (step) => {
        progress.push(step.label);
      },
      onText: (text) => {
        texts.push(text);
      },
    });
    expect(result.text).toBe('You spent ₹1.00.');
    expect(result.views).toHaveLength(1);
    expect(result.toolsUsed).toEqual(['get_overview']);
    expect(result.usage).toEqual({ promptTokens: 20, outputTokens: 10 });
    expect(progress).toEqual(['Thinking…', 'Reading…', 'Putting it together…']);
    expect(texts.at(-1)).toBe('You spent ₹1.00.');
    // The model turn is echoed with its signature, then the function response with money presented.
    const second = calls[1]!.contents;
    expect(second[1]).toEqual({
      role: 'model',
      parts: [{ functionCall: { name: 'get_overview', args: {} }, thoughtSignature: 'sig' }],
    });
    expect(second[2]!.parts[0]!.functionResponse).toEqual({
      name: 'get_overview',
      response: { currency: 'INR', spentMinor: '100', spentFormatted: '₹1.00' },
    });
  });

  it('reports tool errors and unknown tools to the model instead of failing', async () => {
    const { chat, calls } = fakeChat([
      {
        functionCalls: [{ name: 'broken' }, { name: 'nope' }],
        parts: [{ functionCall: { name: 'broken' } }, { functionCall: { name: 'nope' } }],
      },
      { text: 'Sorry.' },
    ]);
    const result = await runAgent({
      ctx: { spent: 0n },
      system: 's',
      contents: [{ role: 'user', parts: [{ text: 'q' }] }],
      tools: [overview, broken],
      chat,
    });
    expect(result.text).toBe('Sorry.');
    const responses = calls[1]!.contents[2]!.parts.map((part) => part.functionResponse?.response);
    expect(responses).toEqual([{ error: 'NOT_MEMBER' }, { error: 'UNKNOWN_TOOL' }]);
  });

  it('withholds tools on the last step so the model must answer', async () => {
    const loop = {
      functionCalls: [{ name: 'get_overview' }],
      parts: [{ functionCall: { name: 'get_overview' } }],
    };
    const { chat, calls } = fakeChat([loop, loop, { text: 'final' }]);
    const result = await runAgent({
      ctx: { spent: 1n },
      system: 's',
      contents: [{ role: 'user', parts: [{ text: 'q' }] }],
      tools: [overview],
      chat,
      maxSteps: 3,
    });
    expect(calls.map((call) => Boolean(call.functions))).toEqual([true, true, false]);
    expect(result.text).toBe('final');
    expect(result.steps).toBe(3);
  });

  it('maps errors to stable codes', () => {
    expect(toolErrorCode(new Error('NOTHING_OWED'))).toBe('NOTHING_OWED');
    expect(toolErrorCode(new Error('something odd happened'))).toBe('TOOL_FAILED');
  });
});

describe('A2UI output', () => {
  it('builds a v0.9 surface with confirmation cards first and limits applied', () => {
    const views: FinView[] = [
      { kind: 'summary', title: 'S', metrics: [{ label: 'a', value: '1' }] },
      {
        kind: 'transactions',
        title: 'T',
        items: Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, title: `t${i}`, amount: '₹1' })),
      },
      { kind: 'action', actionId: 'act1', title: 'Pay', lines: [{ label: 'Amount', value: '₹5' }] },
      { kind: 'progress', title: 'P', items: [{ label: 'x', progress: 4, detail: 'over' }] },
      { kind: 'bars', title: 'B', bars: [] },
    ];
    const messages = buildA2uiMessages('surface-1', views)!;
    expect(messages[0]).toEqual({
      version: 'v0.9',
      createSurface: { surfaceId: 'surface-1', catalogId: FINAI_CATALOG_ID },
    });
    const update = messages[1] as Extract<(typeof messages)[number], { updateComponents: unknown }>;
    const components = update.updateComponents.components;
    expect(components[0]).toEqual({
      id: 'root',
      component: 'Column',
      children: ['view-0', 'view-1', 'view-2', 'view-3'],
    });
    expect(components[1]).toMatchObject({
      component: 'ActionCard',
      actionId: 'act1',
      confirm: { event: { name: 'finai.confirm', context: { actionId: 'act1' } } },
    });
    expect((components[3] as { items: unknown[] }).items).toHaveLength(8);
    expect(components.find((c) => c.component === 'ProgressList')).toMatchObject({
      items: [{ progress: 1 }],
    });
    expect(components.some((c) => c.component === 'BarChart')).toBe(false);
    expect(buildA2uiMessages('x', [])).toBeNull();
  });
});

describe('helpers', () => {
  it('detects @finai mentions but not emails or other handles', () => {
    expect(mentionsFinai('@finai who owes?')).toBe(true);
    expect(mentionsFinai('hey @FinAI, split this')).toBe(true);
    expect(mentionsFinai('mail me at x@finai.com')).toBe(false);
    expect(mentionsFinai('@finaixyz hi')).toBe(false);
    expect(mentionsFinai('no mention')).toBe(false);
    expect(stripMention('@finai, who owes Max?')).toBe('who owes Max?');
    expect(stripMention('@finai')).toBe('@finai');
  });

  it('parses decimal amounts exactly into minor units', () => {
    expect(parseMajorToMinor('125.5', 'INR')).toBe(12550n);
    expect(parseMajorToMinor('1000', 'JPY')).toBe(1000n);
    expect(parseMajorToMinor('1.005', 'USD')).toBeNull();
    expect(parseMajorToMinor('1.000', 'USD')).toBe(100n);
    expect(parseMajorToMinor('-3', 'USD')).toBeNull();
    expect(amountMinor({ amount: '1,250.00' }, 'amount', 'INR')).toBe(125000n);
    expect(() => amountMinor({ amount: '0' }, 'amount', 'INR')).toThrow('INVALID_AMOUNT');
    expect(formatMinor(12550n, 'INR')).toBe('₹125.50');
    expect(presentMoney({ currency: 'USD', totalMinor: 5n })).toEqual({
      currency: 'USD',
      totalMinor: '5',
      totalFormatted: '$0.05',
    });
  });

  it('builds windows from dates and caps them at 366 days', () => {
    const now = Date.UTC(2026, 10, 24);
    expect(window({}, 30, now)).toEqual({ startAt: now - 30 * 86_400_000, endAt: now });
    const custom = window({ from: '2026-11-01', to: '2026-11-02' }, 30, now);
    expect(custom).toEqual({ startAt: Date.UTC(2026, 10, 1), endAt: Date.UTC(2026, 10, 3) });
    const capped = window({ from: '2020-01-01' }, 30, now);
    expect(capped.endAt - capped.startAt).toBe(366 * 86_400_000);
  });

  it('keeps chat history alternating and starting with the user', () => {
    expect(
      historyContents(
        [
          { role: 'assistant', text: 'hello' },
          { role: 'user', text: 'a' },
          { role: 'user', text: 'b' },
          { role: 'assistant', text: 'c' },
        ],
        'now',
      ),
    ).toEqual([
      { role: 'user', parts: [{ text: 'a' }, { text: 'b' }] },
      { role: 'model', parts: [{ text: 'c' }] },
      { role: 'user', parts: [{ text: 'now' }] },
    ]);
  });
});
