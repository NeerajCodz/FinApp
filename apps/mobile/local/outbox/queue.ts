import { serializeLocalValue } from '../serialization';
export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'synced' | 'conflict';
export type OutboxEntry = {
  localId: string;
  operation: string;
  payload: string;
  clientMutationId: string;
  entityType?: string;
  recordId?: string;
  nextRetryAt?: number;
  createdAt: number;
  clientUpdatedAt?: number;
  baseUpdatedAt?: number;
  deviceId?: string;
  dependencies?: readonly string[];
  retryCount: number;
  lastError?: string;
  status: OutboxStatus;
};

export type ConflictReview = { status: 'conflict'; reason: string; action: 'Review changes' };
export function serializePayload(value: unknown): string {
  return serializeLocalValue(value);
}

export function createOutboxEntry(
  operation: string,
  payload: unknown,
  clientMutationId: string,
  options: Pick<
    OutboxEntry,
    'entityType' | 'recordId' | 'clientUpdatedAt' | 'baseUpdatedAt' | 'deviceId' | 'dependencies'
  > = {},
): OutboxEntry {
  const createdAt = Date.now();
  return {
    localId: `local-${clientMutationId}`,
    entityType: options.entityType,
    recordId: options.recordId,
    operation,
    payload: serializePayload(payload),
    clientMutationId,
    createdAt,
    clientUpdatedAt: options.clientUpdatedAt ?? createdAt,
    baseUpdatedAt: options.baseUpdatedAt,
    deviceId: options.deviceId,
    dependencies: options.dependencies,
    retryCount: 0,
    status: 'pending',
  };
}

const retryDelays = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000] as const;

export function nextRetryDelay(retryCount: number): number {
  if (!Number.isFinite(retryCount)) return retryDelays[0];
  const index = Math.max(0, Math.ceil(retryCount) - 1);
  return retryDelays[Math.min(index, retryDelays.length - 1)] ?? retryDelays[0];
}

export function markConflict(reason: string): ConflictReview {
  return { status: 'conflict', reason, action: 'Review changes' };
}
