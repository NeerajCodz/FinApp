import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPasscodeLockStatus,
  hasBrowserLock,
  setPasscodeLock,
  verifyPasscodeLock,
} from '../../apps/web/lib/security/webauthn-lock';

const values = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};

describe('browser passcode lock', () => {
  beforeEach(() => {
    values.clear();
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('window', { localStorage, dispatchEvent: vi.fn() });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('locks for 30 seconds after five failures and then accepts the correct code', async () => {
    await setPasscodeLock('user-a', '123456');
    expect(hasBrowserLock('user-a')).toBe(true);

    for (let attempt = 0; attempt < 4; attempt += 1)
      expect(await verifyPasscodeLock('user-a', '000000')).toBe(false);
    expect(getPasscodeLockStatus('user-a')).toMatchObject({
      configured: true,
      attemptsRemaining: 1,
      retryAt: 0,
    });

    await expect(verifyPasscodeLock('user-a', '000000')).rejects.toThrow('PASSCODE_LOCKED_OUT');
    expect(getPasscodeLockStatus('user-a').retryAt).toBe(Date.now() + 30_000);
    await expect(verifyPasscodeLock('user-a', '123456')).rejects.toThrow('PASSCODE_LOCKED_OUT');

    vi.advanceTimersByTime(30_001);
    expect(await verifyPasscodeLock('user-a', '123456')).toBe(true);
    expect(getPasscodeLockStatus('user-a')).toMatchObject({
      configured: true,
      attemptsRemaining: 5,
      retryAt: 0,
    });
  });
});
