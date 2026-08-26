import { getLocalDatabase, initializeLocalDatabase } from '../sqlite/database';
import type { OutboxEntry } from './queue';

export function enqueueOffline(entry: OutboxEntry): void {
  initializeLocalDatabase();
  getLocalDatabase().runSync(
    'INSERT OR REPLACE INTO outbox (localId, operation, payload, createdAt, retryCount, status) VALUES (?, ?, ?, ?, ?, ?)',
    entry.localId,
    entry.operation,
    entry.payload,
    entry.createdAt,
    entry.retryCount,
    entry.status,
  );
}

export function updateOutboxStatus(
  localId: string,
  status: OutboxEntry['status'],
  retryCount: number,
): void {
  initializeLocalDatabase();
  getLocalDatabase().runSync(
    'UPDATE outbox SET status = ?, retryCount = ? WHERE localId = ?',
    status,
    retryCount,
    localId,
  );
}
