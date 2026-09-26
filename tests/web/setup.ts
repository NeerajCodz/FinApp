import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { WEB_DATABASE_NAME } from '../../apps/web/lib/offline/database';

afterEach(async () => {
  const request = indexedDB.deleteDatabase(WEB_DATABASE_NAME);
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('DATABASE_DELETE_FAILED'));
    request.onblocked = () => reject(new Error('DATABASE_DELETE_BLOCKED'));
  });
});
