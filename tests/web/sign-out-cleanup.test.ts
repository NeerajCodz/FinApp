import { describe, expect, it, vi } from 'vitest';
import { signOutAndClearLocalData } from '../../apps/web/lib/offline/signOut';

describe('sign-out local data cleanup', () => {
  it('waits for in-flight sync and range fetches before clearing user data', async () => {
    const events: string[] = [];
    const { promise: syncing, resolve: finishSync } = Promise.withResolvers<void>();
    const { promise: rangeFetch, resolve: finishRangeFetch } = Promise.withResolvers<void>();
    const operation = signOutAndClearLocalData(
      'user-a',
      async () => {
        events.push('stop');
        await Promise.allSettled([syncing, rangeFetch]);
      },
      async () => {
        events.push('clear');
      },
      async () => {
        events.push('signOut');
      },
    );

    await Promise.resolve();
    expect(events).toEqual(['stop']);
    finishSync();
    await Promise.resolve();
    expect(events).toEqual(['stop']);
    finishRangeFetch();
    await operation;
    expect(events).toEqual(['stop', 'clear', 'signOut']);
  });

  it('attempts authentication sign-out when IndexedDB cleanup fails', async () => {
    const signOut = vi.fn(async () => undefined);
    const failure = new Error('IndexedDB unavailable');

    const cleanupError = await signOutAndClearLocalData(
      'user-a',
      async () => undefined,
      async () => {
        throw failure;
      },
      signOut,
    );

    expect(cleanupError).toBe(failure);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it('resumes sync when authentication sign-out fails', async () => {
    const resumeSync = vi.fn();
    const failure = new Error('Authentication sign-out failed');

    await expect(
      signOutAndClearLocalData(
        'user-a',
        async () => undefined,
        async () => undefined,
        async () => {
          throw failure;
        },
        resumeSync,
      ),
    ).rejects.toBe(failure);

    expect(resumeSync).toHaveBeenCalledOnce();
  });
});
