import {
  areDependenciesMapped,
  listOutbox,
  markOperationSynced,
  markSynced,
  nextRetryDelay,
  updateOutboxStatus,
  type LocalEntity,
  type OutboxEntry,
  type SyncReceipt,
} from './repository';

export type SyncResult = {
  localId: string;
  status: 'synced' | 'failed' | 'conflict';
  retryAfter?: number;
};

function isTransientFailure(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const details = error as { status?: unknown; data?: unknown };
    if (typeof details.status === 'number')
      return details.status === 408 || details.status === 429 || details.status >= 500;
    if (details.data !== undefined) return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|timed out|disconnect|offline|websocket|socket|connection|temporar|unavailable|econn|etimedout|\b(408|429|502|503|504)\b/i.test(
    message,
  );
}

export async function syncOutbox(
  userId: string,
  send: (entry: OutboxEntry) => Promise<SyncReceipt>,
): Promise<SyncResult[]> {
  const candidates = (await listOutbox(userId)).slice(0, 25);
  const results: SyncResult[] = [];
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
        attempted.add(current.localId);
        continue;
      }
      if (!(await areDependenciesMapped(userId, current.dependencies))) continue;

      attempted.add(current.localId);
      madeProgress = true;
      await updateOutboxStatus(userId, current.localId, 'syncing', current.retryCount);
      try {
        const receipt = await send(current);
        if (current.entityType && current.recordId)
          await markSynced(
            userId,
            current.localId,
            current.entityType as LocalEntity,
            current.recordId,
            receipt,
          );
        else await markOperationSynced(userId, current.localId, receipt);
        results.push({ localId: current.localId, status: 'synced' });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'SYNC_FAILED';
        const isConflict = reason === 'TRANSACTION_CHANGED';
        const retryCount = current.retryCount + 1;
        const retryAfter =
          !isConflict && isTransientFailure(error) ? nextRetryDelay(retryCount) : undefined;
        const safeError = reason.replace(/[\r\n]+/g, ' ').slice(0, 240);
        await updateOutboxStatus(
          userId,
          current.localId,
          isConflict ? 'conflict' : 'failed',
          retryCount,
          retryAfter === undefined ? null : Date.now() + retryAfter,
          safeError,
        );
        if (recordKey) blockedRecords.add(recordKey);
        results.push({
          localId: current.localId,
          status: isConflict ? 'conflict' : 'failed',
          retryAfter,
        });
      }
      if (results.length >= 25) break;
    }
  }
  return results;
}
