import type { OutboxEntry, ConflictReview } from '../outbox/queue';
import { markConflict, nextRetryDelay } from '../outbox/queue';
import {
  areDependenciesMapped,
  listOutbox,
  markOperationSynced,
  markSynced,
  type LocalEntity,
  type SyncReceipt,
} from '../repository';
import { updateOutboxStatus } from '../outbox/storage';

function isTransientSyncFailure(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const details = error as { status?: unknown; data?: unknown };
    if (typeof details.status === 'number')
      return details.status === 408 || details.status === 429 || details.status >= 500;
    if (details.data !== undefined) return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|timed out|disconnect|offline|websocket|socket|connection|temporar|unavailable|econn|etimedout|\b(408|429|502|503|504)\b/i.test(message);
}

export type SyncResult = {
  localId: string;
  status: 'synced' | 'failed' | 'conflict';
  serverId?: string;
  retryAfter?: number;
  conflict?: ConflictReview;
};
export async function syncOutbox(
  userId: string,
  entries: readonly OutboxEntry[],
  send: (entry: OutboxEntry) => Promise<SyncReceipt>,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const candidates = entries.slice(0, 25);
  const attempted = new Set<string>();
  const blockedRecords = new Set<string>();
  let madeProgress = true;
  while (madeProgress && results.length < 25) {
    madeProgress = false;
    for (const candidate of candidates) {
      if (attempted.has(candidate.localId)) continue;
      if (candidate.status !== 'pending' && candidate.status !== 'failed') {
        attempted.add(candidate.localId);
        continue;
      }
      const recordKey =
        candidate.entityType && candidate.recordId
          ? `${candidate.entityType}:${candidate.recordId}`
          : null;
      if (recordKey && blockedRecords.has(recordKey)) {
        attempted.add(candidate.localId);
        continue;
      }
      const current = (await listOutbox(userId)).find(
        (entry) => entry.localId === candidate.localId,
      );
      if (!current || (current.status !== 'pending' && current.status !== 'failed')) {
        attempted.add(candidate.localId);
        continue;
      }
      if (current.nextRetryAt !== undefined && current.nextRetryAt > Date.now()) {
        attempted.add(candidate.localId);
        continue;
      }
      if (!(await areDependenciesMapped(userId, current.dependencies ?? []))) continue;
      attempted.add(candidate.localId);
      madeProgress = true;
      await updateOutboxStatus(userId, current.localId, 'syncing', current.retryCount);
      try {
        const response = await send(current);
        if (current.entityType && current.recordId) {
          await markSynced(
            userId,
            current.localId,
            current.entityType as LocalEntity,
            current.recordId,
            response,
          );
        } else {
          await markOperationSynced(userId, current.localId, response);
        }
        results.push({ localId: current.localId, status: 'synced', serverId: response.serverId });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'SYNC_FAILED';
        const conflict = reason === 'TRANSACTION_CHANGED' ? markConflict(reason) : undefined;
        const transient = !conflict && isTransientSyncFailure(error);
        const retryCount = current.retryCount + 1;
        const retryAfter = transient ? nextRetryDelay(retryCount) : undefined;
        const safeError = reason.replace(/[\\r\\n]+/g, ' ').slice(0, 240);
        await updateOutboxStatus(
          userId,
          current.localId,
          conflict ? 'conflict' : 'failed',
          retryCount,
          transient ? Date.now() + (retryAfter ?? nextRetryDelay(retryCount)) : null,
          safeError,
        );
        if (recordKey) blockedRecords.add(recordKey);
        results.push({
          localId: current.localId,
          status: conflict ? 'conflict' : 'failed',
          retryAfter,
          conflict,
        });
      }
      if (results.length >= 25) break;
    }
  }
  return results;
}
