import { openWebDatabase, requestResultFor, transactionComplete } from './database';

export type LocalEntity =
  | 'profile'
  | 'settings'
  | 'account'
  | 'accountMember'
  | 'category'
  | 'transaction'
  | 'transactionTag'
  | 'group'
  | 'groupMember'
  | 'groupInvite'
  | 'expensePayer'
  | 'expenseParticipant'
  | 'settlement'
  | 'budget'
  | 'goal'
  | 'goalContribution'
  | 'recurringRule'
  | 'notification'
  | 'receiptMetadata';

export type LocalRecord = Record<string, unknown> & { id?: string; _id?: string };
export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'synced' | 'conflict';
export type OutboxEntry = {
  userId: string;
  localId: string;
  operation: string;
  payload: Record<string, unknown>;
  clientMutationId: string;
  entityType?: LocalEntity;
  recordId?: string;
  createdAt: number;
  clientUpdatedAt?: number;
  baseUpdatedAt?: number;
  deviceId?: string;
  dependencies: readonly string[];
  retryCount: number;
  nextRetryAt?: number;
  lastError?: string;
  status: OutboxStatus;
};
export type SyncReceipt = { serverId: string; revision: string; updatedAt: number };
export type CloudChange = {
  entityType: LocalEntity;
  documentId: string;
  revision: bigint | string;
  updatedAt: number;
  deletedAt?: number;
  document?: LocalRecord;
};
export type LocalSyncStatus = {
  pending: number;
  syncing: number;
  failed: number;
  conflicts: number;
  lastSyncedAt: number | null;
};
type RecordRow = {
  key: string;
  userId: string;
  entityType: LocalEntity;
  id: string;
  cloudId?: string;
  updatedAt: number;
  clientUpdatedAt?: number;
  cloudUpdatedAt?: number;
  revision?: string;
  record: LocalRecord;
};
type MappingRow = {
  key: string;
  userId: string;
  entityType: LocalEntity;
  localId: string;
  cloudId: string;
};
type SyncState = {
  userId: string;
  cursor: string | null;
  revision: string;
  lastSyncedAt: number | null;
  bootstrapComplete: boolean;
};
type ConflictRow = {
  conflictId: string;
  userId: string;
  entityType: LocalEntity;
  recordId: string;
  local: LocalRecord;
  cloud: LocalRecord;
  localUpdatedAt: number;
  cloudUpdatedAt: number;
  createdAt: number;
  resolvedAt: number | null;
};

const subscribers = new Map<string, Set<() => void>>();
const retryDelays = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000] as const;

function requireUser(userId: string): void {
  if (!userId) throw new Error('AUTH_REQUIRED');
}

function recordKey(userId: string, entityType: LocalEntity, id: string): string {
  return `${userId}\u0000${entityType}\u0000${id}`;
}

function mappingKey(userId: string, entityType: LocalEntity, localId: string): string {
  return `${userId}\u0000${entityType}\u0000${localId}`;
}

let crossTabChannel: BroadcastChannel | undefined;

function broadcastLocalChange(userId: string): void {
  for (const listener of subscribers.get(userId) ?? []) listener();
}

function notify(userId: string): void {
  broadcastLocalChange(userId);
  crossTabChannel?.postMessage(userId);
}

function markOutboxConflict(
  outbox: IDBObjectStore,
  userId: string,
  entityType: LocalEntity,
  recordId: string,
): void {
  for (const status of ['pending', 'failed', 'syncing'] as const) {
    const request = outbox.index('by-user-status').getAll(IDBKeyRange.only([userId, status]));
    request.onsuccess = () => {
      for (const entry of request.result as OutboxEntry[]) {
        if (entry.entityType === entityType && entry.recordId === recordId)
          outbox.put({
            ...entry,
            status: 'conflict',
            nextRetryAt: undefined,
            lastError: 'A cloud edit conflicts with this local version.',
          });
      }
    };
  }
}

export function subscribeLocalData(userId: string, listener: () => void): () => void {
  requireUser(userId);
  if (typeof BroadcastChannel !== 'undefined' && !crossTabChannel) {
    crossTabChannel = new BroadcastChannel('finapp-web-local');
    crossTabChannel.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data === 'string') broadcastLocalChange(event.data);
    };
  }
  const listeners = subscribers.get(userId) ?? new Set<() => void>();
  listeners.add(listener);
  subscribers.set(userId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) subscribers.delete(userId);
  };
}

export async function readLocal<T extends LocalRecord = LocalRecord>(
  userId: string,
  entityType: LocalEntity,
): Promise<T[]> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('records', 'readonly');
  const done = transactionComplete(transaction);
  const rows = (await requestResultFor(
    transaction
      .objectStore('records')
      .index('by-user-entity')
      .getAll(IDBKeyRange.only([userId, entityType])),
  )) as RecordRow[];
  await done;
  return rows
    .sort((left, right) => left.updatedAt - right.updatedAt || left.id.localeCompare(right.id))
    .map((row) => row.record as T);
}

export async function getLocalRecord<T extends LocalRecord = LocalRecord>(
  userId: string,
  entityType: LocalEntity,
  id: string,
): Promise<T | null> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('records', 'readonly');
  const done = transactionComplete(transaction);
  const row = (await requestResultFor(
    transaction.objectStore('records').get(recordKey(userId, entityType, id)),
  )) as RecordRow | undefined;
  await done;
  return (row?.record as T | undefined) ?? null;
}

export async function commitLocalWrite(
  userId: string,
  entityType: LocalEntity,
  operation: string,
  record: LocalRecord,
  payload: Record<string, unknown>,
  options: {
    recordId?: string;
    clientMutationId?: string;
    dependencies?: readonly string[];
    baseUpdatedAt?: number;
    deviceId?: string;
  } = {},
): Promise<string> {
  requireUser(userId);
  const clientMutationId = options.clientMutationId ?? crypto.randomUUID();
  const id = options.recordId ?? String(record.id ?? record._id ?? `local-${clientMutationId}`);
  const now = Date.now();
  const localRecord = { ...record, id, updatedAt: now, clientUpdatedAt: now };
  const entry: OutboxEntry = {
    userId,
    localId: `local-${clientMutationId}`,
    operation,
    payload: { ...payload, clientMutationId },
    clientMutationId,
    entityType,
    recordId: id,
    createdAt: now,
    clientUpdatedAt: now,
    baseUpdatedAt: options.baseUpdatedAt,
    deviceId: options.deviceId,
    dependencies: options.dependencies ?? [],
    retryCount: 0,
    status: 'pending',
  };
  const db = await openWebDatabase();
  const transaction = db.transaction(['records', 'outbox'], 'readwrite');
  const done = transactionComplete(transaction);
  transaction.objectStore('records').put({
    key: recordKey(userId, entityType, id),
    userId,
    entityType,
    id,
    cloudId: typeof record.cloudId === 'string' ? record.cloudId : undefined,
    updatedAt: now,
    clientUpdatedAt: now,
    record: localRecord,
  } satisfies RecordRow);
  const outbox = transaction.objectStore('outbox');
  const existing = outbox.get(entry.localId);
  existing.onsuccess = () => {
    if (!existing.result) outbox.add(entry);
  };
  await done;
  notify(userId);
  return id;
}

export async function upsertCloudPage(
  userId: string,
  entityType: LocalEntity,
  incoming: readonly LocalRecord[],
): Promise<void> {
  requireUser(userId);
  if (incoming.length === 0) return;
  const db = await openWebDatabase();
  const transaction = db.transaction(['records', 'idMappings', 'conflicts', 'outbox'], 'readwrite');
  const done = transactionComplete(transaction);
  const rows = transaction.objectStore('records');
  const mappings = transaction.objectStore('idMappings');
  const conflicts = transaction.objectStore('conflicts');
  const outbox = transaction.objectStore('outbox');
  for (const raw of incoming) {
    const cloudId = String(raw._id ?? raw.id ?? '');
    if (!cloudId) throw new Error(`SYNC_RECORD_ID_REQUIRED:${entityType}`);
    const updatedAt = typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now();
    const mappingRequest = mappings
      .index('by-user-entity-cloud')
      .get([userId, entityType, cloudId]);
    mappingRequest.onsuccess = () => {
      const localId = (mappingRequest.result as MappingRow | undefined)?.localId ?? cloudId;
      const key = recordKey(userId, entityType, localId);
      const record = { ...raw, id: localId, _id: cloudId, cloudId };
      const existingRequest = rows.get(key);
      existingRequest.onsuccess = () => {
        const existing = existingRequest.result as RecordRow | undefined;
        if (existing?.clientUpdatedAt !== undefined && existing.clientUpdatedAt > updatedAt) {
          conflicts.put({
            conflictId: `${entityType}:${localId}:${updatedAt}`,
            userId,
            entityType,
            recordId: localId,
            local: existing.record,
            cloud: record,
            localUpdatedAt: existing.clientUpdatedAt,
            cloudUpdatedAt: updatedAt,
            createdAt: Date.now(),
            resolvedAt: null,
          } satisfies ConflictRow);
          markOutboxConflict(outbox, userId, entityType, localId);
          return;
        }
        rows.put({
          key,
          userId,
          entityType,
          id: localId,
          cloudId,
          updatedAt,
          cloudUpdatedAt: updatedAt,
          record,
        } satisfies RecordRow);
      };
    };
  }
  await done;
  notify(userId);
}

export async function listOutbox(userId: string): Promise<OutboxEntry[]> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('outbox', 'readonly');
  const done = transactionComplete(transaction);
  const entries = (await requestResultFor(
    transaction
      .objectStore('outbox')
      .index('by-user-created')
      .getAll(IDBKeyRange.bound([userId, 0, ''], [userId, Number.MAX_SAFE_INTEGER, '\uffff'])),
  )) as OutboxEntry[];
  await done;
  return entries;
}

export async function updateOutboxStatus(
  userId: string,
  localId: string,
  status: OutboxStatus,
  retryCount: number,
  nextRetryAt: number | null = null,
  lastError: string | null = null,
): Promise<void> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('outbox', 'readwrite');
  const done = transactionComplete(transaction);
  const store = transaction.objectStore('outbox');
  const request = store.get(localId);
  request.onsuccess = () => {
    const entry = request.result as OutboxEntry | undefined;
    if (!entry || entry.userId !== userId) return;
    store.put({
      ...entry,
      status,
      retryCount,
      nextRetryAt: nextRetryAt ?? undefined,
      lastError: lastError ?? undefined,
    });
  };
  await done;
  notify(userId);
}

export async function getMappedCloudId(
  userId: string,
  entityType: LocalEntity,
  localId: string,
): Promise<string | null> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('idMappings', 'readonly');
  const done = transactionComplete(transaction);
  const mapping = (await requestResultFor(
    transaction.objectStore('idMappings').get(mappingKey(userId, entityType, localId)),
  )) as MappingRow | undefined;
  await done;
  return mapping?.cloudId ?? null;
}

export async function areDependenciesMapped(
  userId: string,
  dependencies: readonly string[],
): Promise<boolean> {
  requireUser(userId);
  if (dependencies.length === 0) return true;
  const db = await openWebDatabase();
  const transaction = db.transaction('idMappings', 'readonly');
  const done = transactionComplete(transaction);
  const rows = (await requestResultFor(
    transaction
      .objectStore('idMappings')
      .index('by-user-entity-local')
      .getAll(IDBKeyRange.bound([userId, '', ''], [userId, '\uffff', '\uffff'])),
  )) as MappingRow[];
  await done;
  const mapped = new Set(rows.flatMap((row) => [row.localId, `${row.entityType}:${row.localId}`]));
  return dependencies.every((dependency) => mapped.has(dependency));
}

function rewriteForeignIds(value: unknown, localId: string, cloudId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteForeignIds(item, localId, cloudId));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        /id$/i.test(key) && item === localId ? cloudId : rewriteForeignIds(item, localId, cloudId),
      ]),
    );
  }
  return value;
}

export async function markSynced(
  userId: string,
  localId: string,
  entityType: LocalEntity,
  recordId: string,
  receipt: SyncReceipt,
): Promise<void> {
  requireUser(userId);
  if (!receipt.serverId || !receipt.revision || !Number.isFinite(receipt.updatedAt))
    throw new Error('SYNC_RECEIPT_REQUIRED');
  const db = await openWebDatabase();
  const transaction = db.transaction(['records', 'outbox', 'idMappings', 'syncState'], 'readwrite');
  const done = transactionComplete(transaction);
  const mappings = transaction.objectStore('idMappings');
  mappings.put({
    key: mappingKey(userId, entityType, recordId),
    userId,
    entityType,
    localId: recordId,
    cloudId: receipt.serverId,
  } satisfies MappingRow);
  const records = transaction.objectStore('records');
  const localRecordRequest = records.get(recordKey(userId, entityType, recordId));
  localRecordRequest.onsuccess = () => {
    const row = localRecordRequest.result as RecordRow | undefined;
    if (!row) return;
    const record: LocalRecord = {
      ...row.record,
      id: recordId,
      _id: receipt.serverId,
      cloudId: receipt.serverId,
      updatedAt: receipt.updatedAt,
    };
    delete record.clientUpdatedAt;
    records.put({
      ...row,
      cloudId: receipt.serverId,
      updatedAt: receipt.updatedAt,
      cloudUpdatedAt: receipt.updatedAt,
      clientUpdatedAt: undefined,
      revision: receipt.revision,
      record,
    });
  };
  const outbox = transaction.objectStore('outbox');
  const entryRequest = outbox.get(localId);
  entryRequest.onsuccess = () => {
    const entry = entryRequest.result as OutboxEntry | undefined;
    if (entry?.userId === userId)
      outbox.put({ ...entry, status: 'synced', lastError: undefined, nextRetryAt: undefined });
  };
  const allEntriesRequest = outbox
    .index('by-user-created')
    .getAll(IDBKeyRange.bound([userId, 0, ''], [userId, Number.MAX_SAFE_INTEGER, '\uffff']));
  allEntriesRequest.onsuccess = () => {
    for (const entry of allEntriesRequest.result as OutboxEntry[]) {
      if (entry.status !== 'pending' && entry.status !== 'failed' && entry.status !== 'syncing')
        continue;
      const dependencyKeys = new Set([recordId, `${entityType}:${recordId}`]);
      const dependencies = entry.dependencies.filter(
        (dependency) => !dependencyKeys.has(dependency),
      );
      if (dependencies.length === entry.dependencies.length) continue;
      outbox.put({
        ...entry,
        payload: rewriteForeignIds(entry.payload, recordId, receipt.serverId) as Record<
          string,
          unknown
        >,
        dependencies,
      });
    }
  };
  const stateStore = transaction.objectStore('syncState');
  const stateRequest = stateStore.get(userId);
  stateRequest.onsuccess = () => {
    const state = stateRequest.result as SyncState | undefined;
    stateStore.put({
      ...state,
      userId,
      revision: receipt.revision,
      lastSyncedAt: receipt.updatedAt,
      cursor: state?.cursor ?? null,
      bootstrapComplete: state?.bootstrapComplete ?? false,
    });
  };
  await done;
  notify(userId);
}

export async function markOperationSynced(
  userId: string,
  localId: string,
  receipt: SyncReceipt,
): Promise<void> {
  requireUser(userId);
  if (!receipt.revision || !Number.isFinite(receipt.updatedAt))
    throw new Error('SYNC_RECEIPT_REQUIRED');
  const db = await openWebDatabase();
  const transaction = db.transaction(['outbox', 'syncState'], 'readwrite');
  const done = transactionComplete(transaction);
  const outbox = transaction.objectStore('outbox');
  const request = outbox.get(localId);
  request.onsuccess = () => {
    const entry = request.result as OutboxEntry | undefined;
    if (entry?.userId === userId)
      outbox.put({ ...entry, status: 'synced', lastError: undefined, nextRetryAt: undefined });
  };
  const stateStore = transaction.objectStore('syncState');
  const stateRequest = stateStore.get(userId);
  stateRequest.onsuccess = () => {
    const state = stateRequest.result as SyncState | undefined;
    stateStore.put({
      ...state,
      userId,
      revision: receipt.revision,
      lastSyncedAt: receipt.updatedAt,
      cursor: state?.cursor ?? null,
      bootstrapComplete: state?.bootstrapComplete ?? false,
    });
  };
  await done;
  notify(userId);
}

export async function applyCloudChanges(
  userId: string,
  changes: readonly CloudChange[],
  cursor: string,
): Promise<void> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction(
    ['records', 'idMappings', 'conflicts', 'syncState', 'outbox'],
    'readwrite',
  );
  const done = transactionComplete(transaction);
  const records = transaction.objectStore('records');
  const mappings = transaction.objectStore('idMappings');
  const conflicts = transaction.objectStore('conflicts');
  const outbox = transaction.objectStore('outbox');
  let maxRevision = 0n;
  for (const change of changes) {
    const revision = BigInt(change.revision);
    if (revision > maxRevision) maxRevision = revision;
    const mappingRequest = mappings
      .index('by-user-entity-cloud')
      .get([userId, change.entityType, change.documentId]);
    mappingRequest.onsuccess = () => {
      const localId =
        (mappingRequest.result as MappingRow | undefined)?.localId ?? change.documentId;
      const key = recordKey(userId, change.entityType, localId);
      const recordRequest = records.get(key);
      recordRequest.onsuccess = () => {
        const existing = recordRequest.result as RecordRow | undefined;
        if (change.deletedAt !== undefined) {
          records.delete(key);
          return;
        }
        if (!change.document) return;
        const cloudRecord = {
          ...change.document,
          id: localId,
          _id: change.documentId,
          cloudId: change.documentId,
        };
        if (
          existing?.clientUpdatedAt !== undefined &&
          existing.clientUpdatedAt > change.updatedAt
        ) {
          const conflictId = `${change.entityType}:${localId}:${revision}`;
          conflicts.put({
            conflictId,
            userId,
            entityType: change.entityType,
            recordId: localId,
            local: existing.record,
            cloud: cloudRecord,
            localUpdatedAt: existing.clientUpdatedAt,
            createdAt: Date.now(),
            cloudUpdatedAt: change.updatedAt,
            resolvedAt: null,
          } satisfies ConflictRow);
          markOutboxConflict(outbox, userId, change.entityType, localId);
          return;
        }
        records.put({
          key,
          userId,
          entityType: change.entityType,
          id: localId,
          cloudId: change.documentId,
          updatedAt: change.updatedAt,
          cloudUpdatedAt: change.updatedAt,
          revision: revision.toString(),
          record: cloudRecord,
        } satisfies RecordRow);
      };
    };
  }
  const stateStore = transaction.objectStore('syncState');
  const stateRequest = stateStore.get(userId);
  stateRequest.onsuccess = () => {
    const state = stateRequest.result as SyncState | undefined;
    const currentRevision = BigInt(state?.revision ?? '0');
    stateStore.put({
      ...state,
      userId,
      cursor,
      revision: (maxRevision > currentRevision ? maxRevision : currentRevision).toString(),
      lastSyncedAt: Date.now(),
      bootstrapComplete: state?.bootstrapComplete ?? false,
    });
  };
  await done;
  notify(userId);
}

export async function clearLocalData(userId: string): Promise<void> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction(
    ['records', 'outbox', 'idMappings', 'syncState', 'conflicts'],
    'readwrite',
  );
  const done = transactionComplete(transaction);
  const records = transaction.objectStore('records');
  const recordCursor = records
    .index('by-user-entity')
    .openCursor(IDBKeyRange.bound([userId, ''], [userId, '\uffff']));
  recordCursor.onsuccess = () => {
    const cursor = recordCursor.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  const outbox = transaction.objectStore('outbox');
  const outboxCursor = outbox
    .index('by-user-created')
    .openCursor(IDBKeyRange.bound([userId, 0, ''], [userId, Number.MAX_SAFE_INTEGER, '\uffff']));
  outboxCursor.onsuccess = () => {
    const cursor = outboxCursor.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  const mappings = transaction.objectStore('idMappings');
  const mappingCursor = mappings
    .index('by-user-entity-local')
    .openCursor(IDBKeyRange.bound([userId, '', ''], [userId, '\uffff', '\uffff']));
  mappingCursor.onsuccess = () => {
    const cursor = mappingCursor.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  const conflicts = transaction.objectStore('conflicts');
  const conflictCursor = conflicts.index('by-user').openCursor(IDBKeyRange.only(userId));
  conflictCursor.onsuccess = () => {
    const cursor = conflictCursor.result;
    if (cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
  transaction.objectStore('syncState').delete(userId);
  await done;
  notify(userId);
}

export type LocalConflict = {
  id: string;
  entityType: LocalEntity;
  recordId: string;
  localRecord: LocalRecord;
  cloudRecord: LocalRecord;
  localUpdatedAt: number;
  cloudUpdatedAt: number;
  createdAt: number;
};

export async function readConflicts(userId: string): Promise<LocalConflict[]> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('conflicts', 'readonly');
  const done = transactionComplete(transaction);
  const rows = (await requestResultFor(
    transaction.objectStore('conflicts').index('by-user').getAll(IDBKeyRange.only(userId)),
  )) as ConflictRow[];
  await done;
  return rows
    .filter((row) => row.resolvedAt === null)
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((row) => ({
      id: row.conflictId,
      entityType: row.entityType,
      recordId: row.recordId,
      localRecord: row.local,
      cloudRecord: row.cloud,
      localUpdatedAt: row.localUpdatedAt,
      cloudUpdatedAt: row.cloudUpdatedAt,
      createdAt: row.createdAt,
    }));
}

export async function resolveConflict(
  userId: string,
  conflictId: string,
  winner: 'local' | 'cloud',
): Promise<void> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction(['conflicts', 'records', 'outbox'], 'readwrite');
  const done = transactionComplete(transaction);
  const conflicts = transaction.objectStore('conflicts');
  let abortMessage: string | undefined;
  const conflictRequest = conflicts.get(conflictId);
  conflictRequest.onsuccess = () => {
    const conflict = conflictRequest.result as ConflictRow | undefined;
    if (!conflict || conflict.userId !== userId) {
      abortMessage = 'CONFLICT_NOT_FOUND';
      transaction.abort();
      return;
    }
    if (conflict.resolvedAt !== null) {
      abortMessage = 'CONFLICT_ALREADY_RESOLVED';
      transaction.abort();
      return;
    }
    const now = Date.now();
    const selected = winner === 'local' ? conflict.local : conflict.cloud;
    const record: LocalRecord = { ...selected, id: conflict.recordId };
    if (winner === 'local') {
      record.updatedAt = now;
      record.clientUpdatedAt = now;
    } else {
      delete record.clientUpdatedAt;
      record.updatedAt = conflict.cloudUpdatedAt;
    }
    transaction.objectStore('records').put({
      key: recordKey(userId, conflict.entityType, conflict.recordId),
      userId,
      entityType: conflict.entityType,
      id: conflict.recordId,
      cloudId: String(conflict.cloud.cloudId ?? conflict.cloud._id ?? ''),
      updatedAt: winner === 'local' ? now : conflict.cloudUpdatedAt,
      cloudUpdatedAt: conflict.cloudUpdatedAt,
      clientUpdatedAt: winner === 'local' ? now : undefined,
      record,
    } satisfies RecordRow);
    conflicts.put({ ...conflict, resolvedAt: now });

    const outbox = transaction.objectStore('outbox');
    const request = outbox.index('by-user-status').getAll(IDBKeyRange.only([userId, 'conflict']));
    request.onsuccess = () => {
      for (const entry of request.result as OutboxEntry[]) {
        if (entry.entityType !== conflict.entityType || entry.recordId !== conflict.recordId)
          continue;
        outbox.put({
          ...entry,
          status: winner === 'local' ? 'pending' : 'synced',
          nextRetryAt: undefined,
          lastError: undefined,
        });
      }
    };
  };
  try {
    await done;
  } catch (error) {
    if (abortMessage) throw new Error(abortMessage, { cause: error });
    throw error;
  }
  notify(userId);
}

export async function getSyncCursor(userId: string): Promise<string | null> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('syncState', 'readonly');
  const done = transactionComplete(transaction);
  const state = (await requestResultFor(transaction.objectStore('syncState').get(userId))) as
    SyncState | undefined;
  await done;
  return state?.cursor ?? null;
}

export async function hasCompletedBootstrap(userId: string): Promise<boolean> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('syncState', 'readonly');
  const done = transactionComplete(transaction);
  const state = (await requestResultFor(transaction.objectStore('syncState').get(userId))) as
    SyncState | undefined;
  await done;
  return state?.bootstrapComplete ?? false;
}

export async function markBootstrapCompleted(userId: string): Promise<void> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('syncState', 'readwrite');
  const done = transactionComplete(transaction);
  const store = transaction.objectStore('syncState');
  const request = store.get(userId);
  request.onsuccess = () => {
    const state = request.result as SyncState | undefined;
    store.put({
      ...state,
      userId,
      cursor: state?.cursor ?? null,
      revision: state?.revision ?? '0',
      lastSyncedAt: state?.lastSyncedAt ?? null,
      bootstrapComplete: true,
    });
  };
  await done;
  notify(userId);
}

export async function getLocalSyncStatus(userId: string): Promise<LocalSyncStatus> {
  const [entries, cursorState] = await Promise.all([listOutbox(userId), getSyncState(userId)]);
  return {
    pending: entries.filter((entry) => entry.status === 'pending').length,
    syncing: entries.filter((entry) => entry.status === 'syncing').length,
    failed: entries.filter((entry) => entry.status === 'failed').length,
    conflicts: entries.filter((entry) => entry.status === 'conflict').length,
    lastSyncedAt: cursorState.lastSyncedAt,
  };
}

export async function getSyncState(
  userId: string,
): Promise<Pick<SyncState, 'revision' | 'lastSyncedAt'>> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('syncState', 'readonly');
  const done = transactionComplete(transaction);
  const state = (await requestResultFor(transaction.objectStore('syncState').get(userId))) as
    SyncState | undefined;
  await done;
  return { revision: state?.revision ?? '0', lastSyncedAt: state?.lastSyncedAt ?? null };
}

export async function retryFailed(userId: string): Promise<void> {
  requireUser(userId);
  const db = await openWebDatabase();
  const transaction = db.transaction('outbox', 'readwrite');
  const done = transactionComplete(transaction);
  const store = transaction.objectStore('outbox');
  const request = store.index('by-user-status').getAll(IDBKeyRange.only([userId, 'failed']));
  request.onsuccess = () => {
    for (const entry of request.result as OutboxEntry[])
      store.put({ ...entry, status: 'pending', nextRetryAt: undefined, lastError: undefined });
  };
  await done;
  notify(userId);
}

export function nextRetryDelay(retryCount: number): number {
  const index = Number.isFinite(retryCount) ? Math.max(0, Math.ceil(retryCount) - 1) : 0;
  return retryDelays[Math.min(index, retryDelays.length - 1)] ?? retryDelays[0];
}
