import { getLocalDatabase, initializeLocalDatabase } from '../sqlite/database';
import type { OutboxEntry } from './queue';

export async function enqueueOffline(entry: OutboxEntry, userId: string): Promise<void> {
  if (!userId) throw new Error('AUTH_REQUIRED');
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT OR IGNORE INTO outbox
        (localId, userId, operation, payload, clientMutationId, createdAt, clientUpdatedAt,
         retryCount, dependencies, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.localId,
      userId,
      entry.operation,
      entry.payload,
      entry.clientMutationId,
      entry.createdAt,
      entry.createdAt,
      entry.retryCount,
      '[]',
      entry.status,
    );
  });
}

export async function updateOutboxStatus(
  userId: string,
  localId: string,
  status: OutboxEntry['status'],
  retryCount: number,
  nextRetryAt: number | null = null,
  lastError: string | null = null,
): Promise<void> {
  if (!userId) throw new Error('AUTH_REQUIRED');
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.runSync(
    `UPDATE outbox
     SET status = ?, retryCount = ?, nextRetryAt = ?, lastError = ?
     WHERE userId = ? AND localId = ?`,
    status,
    retryCount,
    nextRetryAt,
    lastError,
    userId,
    localId,
  );
}
