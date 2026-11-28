import { describe, expect, it, vi } from 'vitest';
import {
  createPushRegistrationQueue,
  type PushRegistrationStatus,
} from '../../apps/mobile/local/push-registration-queue';

function deferred<T>() {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  return { promise, resolve, reject };
}

describe('push registration queue', () => {
  it('reruns a failed in-flight registration after connectivity returns', async () => {
    const connection = { isConnected: true };
    const firstAttempt = deferred<unknown>();
    const register = vi.fn()
      .mockReturnValueOnce(firstAttempt.promise)
      .mockResolvedValueOnce('registered');
    const statuses: PushRegistrationStatus[] = [];
    const queue = createPushRegistrationQueue({
      isConnected: () => connection.isConnected,
      register,
      setStatus: (status) => statuses.push(status),
    });

    const inFlight = queue.request();
    expect(register).toHaveBeenCalledTimes(1);

    connection.isConnected = false;
    await queue.request();
    connection.isConnected = true;
    await queue.request();
    firstAttempt.reject(new Error('connection dropped'));
    await inFlight;

    expect(register).toHaveBeenCalledTimes(2);
    expect(statuses.at(-1)).toBe('registered');
  });
});
