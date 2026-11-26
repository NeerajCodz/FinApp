import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCK_TIMEOUT,
  lockTimedOut,
  parseLockTimeout,
} from '../../packages/ui/src/finance/lockTimeout';

describe('lock timeout', () => {
  it('defaults to five minutes and only accepts listed options', () => {
    expect(DEFAULT_LOCK_TIMEOUT).toBe(5);
    expect(parseLockTimeout(null)).toBe(5);
    expect(parseLockTimeout('15')).toBe(15);
    expect(parseLockTimeout(0)).toBe(0);
    expect(parseLockTimeout('7')).toBe(5);
  });

  it('locks once time away reaches the timeout (immediately when set to 0)', () => {
    expect(lockTimedOut(4 * 60_000, 5)).toBe(false);
    expect(lockTimedOut(5 * 60_000, 5)).toBe(true);
    expect(lockTimedOut(0, 0)).toBe(true);
    expect(lockTimedOut(Infinity, 60)).toBe(true);
  });
});
