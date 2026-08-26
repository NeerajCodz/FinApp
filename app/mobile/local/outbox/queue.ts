export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'synced' | 'conflict';
export type OutboxEntry = {
  localId: string;
  operation: string;
  payload: string;
  clientMutationId: string;
  createdAt: number;
  retryCount: number;
  status: OutboxStatus;
};

export type ConflictReview = { status: 'conflict'; reason: string; action: 'Review changes' };
export function serializePayload(value: unknown): string {
  return JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? `${item}n` : item));
}

export function createOutboxEntry(
  operation: string,
  payload: unknown,
  clientMutationId: string,
): OutboxEntry {
  return {
    localId: `local-${clientMutationId}`,
    operation,
    payload: serializePayload(payload),
    clientMutationId,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
}

export function nextRetryDelay(retryCount: number): number {
  return Math.min(30_000, 30_000 * 2 ** Math.max(0, retryCount - 1));
}

export function markConflict(reason: string): ConflictReview {
  return { status: 'conflict', reason, action: 'Review changes' };
}
