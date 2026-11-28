import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryPushReadQueue } from '../../apps/mobile/local/pushReadQueue';

afterEach(() => vi.useRealTimers());

describe('push notification read retries', () => {
  it('retries a transient failure twice before acknowledging the notification', async () => {
    vi.useFakeTimers();
    const markRead = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const onRead = vi.fn();
    const onError = vi.fn();
    const stop = retryPushReadQueue(['notification-a'], markRead, onRead, onError);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(markRead).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(markRead).toHaveBeenCalledTimes(3);
    expect(onRead).toHaveBeenCalledOnce();
    expect(onRead).toHaveBeenCalledWith('notification-a');
    expect(onError).toHaveBeenCalledTimes(2);
    stop();
  });

  it('cancels delayed retries when the identity scope is disposed', async () => {
    vi.useFakeTimers();
    const markRead = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('offline'));
    const stop = retryPushReadQueue(['notification-a'], markRead, vi.fn(), vi.fn());

    await vi.advanceTimersByTimeAsync(0);
    stop();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(markRead).toHaveBeenCalledOnce();
  });
});
