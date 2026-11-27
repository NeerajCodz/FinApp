import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { createStreamWriter } from '../../convex/ai/streamWriter';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function deferredWrites() {
  const writes: string[] = [];
  const pending: Array<() => void> = [];
  const write = (text: string) =>
    new Promise<void>((resolve) => {
      writes.push(text);
      pending.push(resolve);
    });
  const settle = async () => {
    while (pending.length) pending.shift()!();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { writes, write, settle };
}

describe('createStreamWriter', () => {
  it('never blocks the caller and writes the first delta right away', () => {
    const { writes, write } = deferredWrites();
    const live = createStreamWriter(write, 80);
    const result = live.push('Hel');
    expect(result).toBeUndefined();
    expect(writes).toEqual(['Hel']);
  });

  it('keeps one write in flight and coalesces to the newest text', async () => {
    const { writes, write, settle } = deferredWrites();
    const live = createStreamWriter(write, 80);
    live.push('a');
    live.push('ab');
    live.push('abc');
    expect(writes).toEqual(['a']);
    await vi.advanceTimersByTimeAsync(100);
    await settle();
    await vi.advanceTimersByTimeAsync(100);
    expect(writes).toEqual(['a', 'abc']);
  });

  it('flushes the tail on a timer even when no further delta arrives', async () => {
    const { writes, write, settle } = deferredWrites();
    const live = createStreamWriter(write, 80);
    live.push('one');
    await settle();
    live.push('one two');
    expect(writes).toEqual(['one']);
    await vi.advanceTimersByTimeAsync(80);
    expect(writes).toEqual(['one', 'one two']);
  });

  it('drain waits for the in-flight write so the final write cannot be overtaken', async () => {
    const order: string[] = [];
    let release!: () => void;
    const live = createStreamWriter(
      (text) =>
        new Promise<void>((resolve) => {
          order.push(`start:${text}`);
          release = () => {
            order.push(`end:${text}`);
            resolve();
          };
        }),
      80,
    );
    live.push('partial');
    const drained = live.drain().then(() => order.push('drained'));
    await Promise.resolve();
    expect(order).toEqual(['start:partial']);
    release();
    await drained;
    expect(order).toEqual(['start:partial', 'end:partial', 'drained']);
  });

  it('stops after a failed write instead of retrying forever', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const write = vi.fn(() => Promise.reject(new Error('boom')));
    const live = createStreamWriter(write, 10);
    live.push('x');
    await live.drain();
    live.push('xy');
    await vi.advanceTimersByTimeAsync(50);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe('FinAI stale activity', () => {
  it('expires abandoned work on schedule so activity subscriptions update', async () => {
    const t = convexTest(schema, import.meta.glob('../../convex/**/*.ts'));
    const userId = await t.run(async (ctx) =>
      ctx.db.insert('users', {
        email: 'stale-activity@example.com',
        displayName: 'Stale Activity',
        emailVerificationTime: Date.now(),
        defaultCurrency: 'USD',
      }),
    );
    const owner = t.withIdentity({ subject: `${userId}|session` });

    const { conversationId } = await owner.mutation(internal.ai.assistant.begin, {
      text: 'A reply that will be abandoned',
    });
    expect((await owner.query(api.ai.assistant.activity, {})).working).toBe(true);

    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(6 * 60_000));

    expect((await owner.query(api.ai.assistant.activity, {})).working).toBe(false);
    expect((await owner.query(api.ai.assistant.conversations, {})).find((row) => row.id === conversationId))
      .toMatchObject({ working: false });
  });
});

