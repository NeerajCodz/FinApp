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
  userId: string,
  entries: readonly OutboxEntry[],
  send: (entry: OutboxEntry) => Promise<{ serverId: string }>,
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const entry of entries
    .filter((candidate) => candidate.status === 'pending' || candidate.status === 'failed')
    .slice(0, 25)) {
    await updateOutboxStatus(userId, entry.localId, 'syncing', entry.retryCount);
    try {
      const response = await send(entry);
      await updateOutboxStatus(userId, entry.localId, 'synced', entry.retryCount);
      results.push({ localId: entry.localId, status: 'synced', serverId: response.serverId });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'SYNC_FAILED';
      const conflict = reason === 'TRANSACTION_CHANGED' ? markConflict(reason) : undefined;
      const retryCount = entry.retryCount + 1;
      const retryAfter = nextRetryDelay(retryCount);
      const safeError = reason.replace(/[\r\n]+/g, ' ').slice(0, 240);
      await updateOutboxStatus(
        userId,
        entry.localId,
        conflict ? 'conflict' : 'failed',
        retryCount,
        conflict ? null : Date.now() + retryAfter,
        safeError,
      );
      results.push({
        localId: entry.localId,
        status: conflict ? 'conflict' : 'failed',
        retryAfter,
        conflict,
      });
    }
  }
  return results;
}
