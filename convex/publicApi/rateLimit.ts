/**
 * Token-bucket rate limiting. Pure: the gateway loads the bucket, calls `takeToken` and saves
 * the returned state in the same transaction.
 */

export type BucketConfig = { capacity: number; refillPerSecond: number };
export type BucketState = { tokens: number; updatedAt: number };
export type TakeResult = {
  allowed: boolean;
  state: BucketState;
  limit: number;
  remaining: number;
  /** Seconds until the bucket is full again. */
  resetSeconds: number;
  /** Seconds to wait before retrying (0 when allowed). */
  retryAfterSeconds: number;
};

/** 120 requests of burst, refilling at 2 per second (120 per minute) per token. */
export const DEFAULT_BUCKET: BucketConfig = { capacity: 120, refillPerSecond: 2 };

export function refill(state: BucketState | null, now: number, config: BucketConfig): BucketState {
  if (!state) return { tokens: config.capacity, updatedAt: now };
  const elapsed = Math.max(0, now - state.updatedAt) / 1000;
  return {
    tokens: Math.min(config.capacity, state.tokens + elapsed * config.refillPerSecond),
    updatedAt: Math.max(now, state.updatedAt),
  };
}

export function takeToken(
  state: BucketState | null,
  now: number,
  config: BucketConfig = DEFAULT_BUCKET,
  cost = 1,
): TakeResult {
  const current = refill(state, now, config);
  const allowed = current.tokens >= cost;
  const next = allowed ? { ...current, tokens: current.tokens - cost } : current;
  const missing = config.capacity - next.tokens;
  return {
    allowed,
    state: next,
    limit: config.capacity,
    remaining: Math.max(0, Math.floor(next.tokens)),
    resetSeconds: Math.ceil(missing / config.refillPerSecond),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((cost - current.tokens) / config.refillPerSecond)),
  };
}
