export const WEB_DATABASE_NAME = 'finapp-web-local';
const WEB_DATABASE_VERSION = 2;

export type StoreName = 'records' | 'outbox' | 'idMappings' | 'syncState' | 'conflicts';

let databasePromise: Promise<IDBDatabase> | undefined;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  const { promise, resolve, reject } = Promise.withResolvers<T>();
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('INDEXEDDB_REQUEST_FAILED'));
  return promise;
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  transaction.oncomplete = () => resolve();
  transaction.onabort = () =>
    reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_ABORTED'));
  transaction.onerror = () =>
    reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_FAILED'));
  return promise;
}

export async function openWebDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') throw new Error('INDEXEDDB_UNAVAILABLE');
  if (databasePromise) return databasePromise;

  const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
  databasePromise = promise;
  const request = indexedDB.open(WEB_DATABASE_NAME, WEB_DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains('records')) {
      const records = database.createObjectStore('records', { keyPath: 'key' });
      records.createIndex('by-user-entity', ['userId', 'entityType']);
      records.createIndex('by-user-cloud', ['userId', 'entityType', 'cloudId']);
    }
    if (!database.objectStoreNames.contains('outbox')) {
      const outbox = database.createObjectStore('outbox', { keyPath: 'localId' });
      outbox.createIndex('by-user-created', ['userId', 'createdAt', 'localId']);
      outbox.createIndex('by-user-status', ['userId', 'status']);
    }
    if (!database.objectStoreNames.contains('idMappings')) {
      const mappings = database.createObjectStore('idMappings', { keyPath: 'key' });
      mappings.createIndex('by-user-entity-local', ['userId', 'entityType', 'localId'], {
        unique: true,
      });
      mappings.createIndex('by-user-entity-cloud', ['userId', 'entityType', 'cloudId'], {
        unique: true,
      });
    }
    if (!database.objectStoreNames.contains('syncState'))
      database.createObjectStore('syncState', { keyPath: 'userId' });
    const upgrade = request.transaction;
    const conflicts = database.objectStoreNames.contains('conflicts')
      ? upgrade?.objectStore('conflicts')
      : database.createObjectStore('conflicts', { keyPath: 'conflictId' });
    if (!conflicts) throw new Error('INDEXEDDB_UPGRADE_TRANSACTION_REQUIRED');
    if (!conflicts.indexNames.contains('by-user')) conflicts.createIndex('by-user', 'userId');
    if (conflicts.indexNames.contains('by-user-open')) conflicts.deleteIndex('by-user-open');
  };
  request.onsuccess = () => {
    const database = request.result;
    database.onversionchange = () => {
      database.close();
      databasePromise = undefined;
    };
    resolve(database);
  };
  request.onerror = () => {
    databasePromise = undefined;
    reject(request.error ?? new Error('INDEXEDDB_OPEN_FAILED'));
  };
  request.onblocked = () => {
    databasePromise = undefined;
    reject(new Error('INDEXEDDB_UPGRADE_BLOCKED'));
  };

  return databasePromise;
}

export function requestResultFor<T>(request: IDBRequest<T>): Promise<T> {
  return requestResult(request);
}
