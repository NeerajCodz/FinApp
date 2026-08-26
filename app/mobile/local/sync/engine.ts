import type { OutboxEntry, ConflictReview } from '../outbox/queue';
import { markConflict, nextRetryDelay } from '../outbox/queue';
import { updateOutboxStatus } from '../outbox/storage';

export type SyncResult = {
  localId: string;
  status: 'synced' | 'failed' | 'conflict';
  serverId?: string;
  retryAfter?: number;
  conflict?: ConflictReview;
};
export async function syncOutbox(
  entries: readonly OutboxEntry[],
  send: (entry: OutboxEntry) => Promise<{ serverId: string }>,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const entry of entries
    .filter((candidate) => candidate.status === 'pending' || candidate.status === 'failed')
    .slice(0, 25)) {
    updateOutboxStatus(entry.localId, 'syncing', entry.retryCount);
    try {
      const response = await send(entry);
      updateOutboxStatus(entry.localId, 'synced', entry.retryCount);
      results.push({ localId: entry.localId, status: 'synced', serverId: response.serverId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'SYNC_FAILED';
      const conflict = reason === 'TRANSACTION_CHANGED' ? markConflict(reason) : undefined;
      const retryCount = entry.retryCount + 1;
      updateOutboxStatus(entry.localId, conflict ? 'conflict' : 'failed', retryCount);
      results.push({
        localId: entry.localId,
        status: conflict ? 'conflict' : 'failed',
        retryAfter: nextRetryDelay(retryCount),
        conflict,
      });
    }
  }
  return results;
}
