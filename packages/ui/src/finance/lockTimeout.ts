/** How long Finapp can be in the background before the screen lock asks again. */
export const LOCK_TIMEOUT_OPTIONS = [
  { minutes: 0, label: 'Immediately' },
  { minutes: 1, label: '1 minute' },
  { minutes: 5, label: '5 minutes' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
] as const;

export type LockTimeoutMinutes = (typeof LOCK_TIMEOUT_OPTIONS)[number]['minutes'];
export const DEFAULT_LOCK_TIMEOUT: LockTimeoutMinutes = 5;

/** A stored value back to a valid option (the default when missing or unknown). */
export function parseLockTimeout(value: unknown): LockTimeoutMinutes {
  const minutes = typeof value === 'string' ? Number(value) : value;
  return (LOCK_TIMEOUT_OPTIONS.find((option) => option.minutes === minutes)?.minutes ??
    DEFAULT_LOCK_TIMEOUT) as LockTimeoutMinutes;
}

/** Whether time away (`awayMs`) has passed the timeout. */
export function lockTimedOut(awayMs: number, minutes: LockTimeoutMinutes): boolean {
  return awayMs >= minutes * 60_000;
}

export const lockTimeoutKey = (userId: string) => `finapp.lock.timeout.v1:${userId}`;
export const lockLastActiveKey = (userId: string) => `finapp.lock.lastActive.v1:${userId}`;
