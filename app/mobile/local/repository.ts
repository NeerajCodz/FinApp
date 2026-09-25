import type { SQLiteDatabase } from 'expo-sqlite';
import { getLocalDatabase, initializeLocalDatabase } from './sqlite/database';
import type { OutboxEntry } from './outbox/queue';
import { deserializeLocalValue, serializeLocalValue } from './serialization';
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
export type CloudChange = {
  entityType: LocalEntity;
  documentId: string;
  revision: bigint | string;
  updatedAt: number;
  deletedAt?: number;
  document?: LocalRecord;
};

type BasicTable = 'accounts' | 'categories' | 'groups' | 'budgets' | 'goals' | 'recurringRules';
const listeners = new Map<string, Set<() => void>>();
const cloudToLocalIds = new Map<string, Map<string, string>>();

function requireUser(userId: string): void {
  if (!userId) throw new Error('AUTH_REQUIRED');
}
function entityId(record: LocalRecord, type: LocalEntity): string {
  const id = record.id ?? record._id;
  if (typeof id === 'string' && id) return id;
  const keyFields: Partial<Record<LocalEntity, string[]>> = {
    accountMember: ['accountId', 'memberId'],
    groupMember: ['groupId', 'memberId'],
    expensePayer: ['transactionId', 'memberId'],
    expenseParticipant: ['transactionId', 'memberId'],
    transactionTag: ['transactionId', 'tag'],
  };
  const fields = keyFields[type];
  if (fields?.every((field) => record[field] != null)) {
    return fields.map((field) => String(record[field])).join(':');
  }
  throw new Error('LOCAL_RECORD_ID_REQUIRED');
}
function sameFinancialContent(left: LocalRecord, right: LocalRecord): boolean {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !['_id', '_creationTime', 'id', 'cloudId', 'updatedAt'].includes(key))
          .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
          .map(([key, item]) => [key, normalize(item)]),
      );
    }
    return value;
  };
  return encode(normalize(left)) === encode(normalize(right));
}
function encode(value: unknown): string {
  return serializeLocalValue(value);
}
function decode<T>(value: string): T {
  return deserializeLocalValue<T>(value);
}
function notify(userId: string): void {
  for (const listener of listeners.get(userId) ?? []) listener();
}
export function subscribeLocalData(userId: string, listener: () => void): () => void {
  requireUser(userId);
  const set = listeners.get(userId) ?? new Set<() => void>();
  set.add(listener);
  listeners.set(userId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(userId);
  };
}

function putBasic(
  db: SQLiteDatabase,
  table: BasicTable,
  userId: string,
  type: LocalEntity,
  record: LocalRecord,
): void {
  const id = entityId(record, type);
  const cloudId = typeof record.cloudId === 'string' ? record.cloudId : (record._id ?? null);
  db.runSync(
    `INSERT INTO ${table} (userId, id, cloudId, payload) VALUES (?, ?, ?, ?)
     ON CONFLICT(userId, id) DO UPDATE SET cloudId = excluded.cloudId, payload = excluded.payload`,
    userId,
    id,
    cloudId,
    encode(record),
  );
}
function mapCloudForeignIds(db: SQLiteDatabase, userId: string, value: unknown): unknown {
  let localByCloudId = cloudToLocalIds.get(userId);
  if (!localByCloudId) {
    const mappings = db.getAllSync<{ localId: string; cloudId: string }>(
      'SELECT localId, cloudId FROM idMappings WHERE userId = ?',
      userId,
    );
    localByCloudId = new Map(mappings.map(({ localId, cloudId }) => [cloudId, localId]));
    cloudToLocalIds.set(userId, localByCloudId);
  }
  const normalize = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(normalize);
    if (!current || typeof current !== 'object') return current;
    return Object.fromEntries(
      Object.entries(current).map(([key, item]) => [
        key,
        key !== 'id' && key !== '_id' && key !== 'cloudId' && /id$/i.test(key) && typeof item === 'string'
          ? (localByCloudId.get(item) ?? item)
          : normalize(item),
      ]),
    );
  };
  return normalize(value);
}
function putRecord(
  db: SQLiteDatabase,
  userId: string,
  type: LocalEntity,
  record: LocalRecord,
): void {
  record = mapCloudForeignIds(db, userId, record) as LocalRecord;
  const id = entityId(record, type);
  const payload = encode(record);
  const cloudId = typeof record.cloudId === 'string' ? record.cloudId : (record._id ?? null);
  if (cloudId) {
    db.runSync(
      'INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId) VALUES (?, ?, ?, ?)',
      userId,
      type,
      id,
      cloudId,
    );
    cloudToLocalIds.get(userId)?.set(String(cloudId), id);
  }
  if (type === 'profile') {
    db.runSync(
      `INSERT INTO appProfile (userId, cloudId, payload, updatedAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET cloudId = excluded.cloudId, payload = excluded.payload, updatedAt = excluded.updatedAt`,
      userId,
      cloudId,
      payload,
      Number(record.updatedAt ?? Date.now()),
    );
    return;
  }
  if (type === 'settings') {
    db.runSync(
      `INSERT INTO appSettings (userId, key, payload, updatedAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(userId, key) DO UPDATE SET payload = excluded.payload, updatedAt = excluded.updatedAt`,
      userId,
      'cloud',
      payload,
      Number(record.updatedAt ?? Date.now()),
    );
    return;
  }
  const basicTables: Partial<Record<LocalEntity, BasicTable>> = {
    account: 'accounts',
    category: 'categories',
    group: 'groups',
    budget: 'budgets',
    goal: 'goals',
    recurringRule: 'recurringRules',
  };
  const basicTable = basicTables[type];
  if (basicTable) {
    putBasic(db, basicTable, userId, type, record);
    return;
  }
  if (type === 'transaction') {
    db.runSync(
      `INSERT INTO transactions
       (userId, id, cloudId, accountId, categoryId, groupId, occurredAt, amountMinor, status, deletedAt, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(userId, id) DO UPDATE SET cloudId = excluded.cloudId, accountId = excluded.accountId,
         categoryId = excluded.categoryId, groupId = excluded.groupId, occurredAt = excluded.occurredAt,
         amountMinor = excluded.amountMinor, status = excluded.status, deletedAt = excluded.deletedAt, payload = excluded.payload`,
      userId,
      id,
      cloudId,
      String(record.accountId ?? ''),
      record.categoryId == null ? null : String(record.categoryId),
      record.groupId == null ? null : String(record.groupId),
      Number(record.occurredAt ?? 0),
      String(record.amountMinor ?? '0'),
      String(record.status ?? 'posted'),
      record.deletedAt == null ? null : Number(record.deletedAt),
      payload,
    );
    return;
  }
  const flatTables: Partial<Record<LocalEntity, string>> = {
    accountMember: 'accountMembers',
    groupMember: 'groupMembers',
    groupInvite: 'groupInvites',
    expensePayer: 'expensePayers',
    expenseParticipant: 'expenseParticipants',
    settlement: 'settlements',
    goalContribution: 'goalContributions',
    notification: 'notifications',
    receiptMetadata: 'receiptMetadata',
  };
  if (type === 'transactionTag') {
    db.runSync(
      'INSERT OR IGNORE INTO transactionTags (userId, transactionId, tag) VALUES (?, ?, ?)',
      userId,
      String(record.transactionId),
      String(record.tag),
    );
    return;
  }
  const table = flatTables[type];
  if (!table) throw new Error('UNSUPPORTED_LOCAL_ENTITY');
  const fieldSets: Partial<Record<LocalEntity, readonly string[]>> = {
    accountMember: ['accountId', 'memberId'],
    groupMember: ['groupId', 'memberId'],
    groupInvite: ['id', 'groupId'],
    expensePayer: ['transactionId', 'memberId'],
    expenseParticipant: ['transactionId', 'memberId'],
    settlement: ['id', 'groupId', 'occurredAt', 'amountMinor'],
    goalContribution: ['id', 'goalId', 'occurredAt', 'amountMinor'],
    notification: ['id', 'createdAt'],
    receiptMetadata: ['id', 'transactionId'],
  };
  const fields = fieldSets[type] ?? [];
  const hasSeparateAmount = type === 'expensePayer' || type === 'expenseParticipant';
  const columns = ['userId', ...fields, ...(hasSeparateAmount ? ['amountMinor'] : []), 'payload'];
  const values = [
    userId,
    ...fields.map((field) => {
      const value = field === 'memberId' ? (record.memberId ?? record.userId) : record[field];
      return value == null ? null : String(value);
    }),
    ...(hasSeparateAmount ? [String(record.amountMinor ?? '0')] : []),
    payload,
  ];
  const conflictColumns = columns
    .slice(2)
    .map((column) => `${column} = excluded.${column}`)
    .join(', ');
  db.runSync(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
     ON CONFLICT DO UPDATE SET ${conflictColumns}`,
    ...values,
  );
}

export async function readLocal<T extends LocalRecord>(
  userId: string,
  type: LocalEntity,
): Promise<T[]> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  if (type === 'profile') {
    const profile = db.getFirstSync<{ payload: string }>(
      'SELECT payload FROM appProfile WHERE userId = ?',
      userId,
    );
    return profile ? [decode<T>(profile.payload)] : [];
  }
  if (type === 'transactionTag') {
    const tags = db.getAllSync<{ transactionId: string; tag: string }>(
      'SELECT transactionId, tag FROM transactionTags WHERE userId = ?',
      userId,
    );
    return tags.map((tag) => ({ ...tag, id: `${tag.transactionId}:${tag.tag}` }) as unknown as T);
  }
  const tableByType: Partial<Record<LocalEntity, string>> = {
    account: 'accounts',
    category: 'categories',
    transaction: 'transactions',
    group: 'groups',
    accountMember: 'accountMembers',
    groupMember: 'groupMembers',
    groupInvite: 'groupInvites',
    expensePayer: 'expensePayers',
    expenseParticipant: 'expenseParticipants',
    settlement: 'settlements',
    budget: 'budgets',
    goal: 'goals',
    goalContribution: 'goalContributions',
    settings: 'appSettings',
    recurringRule: 'recurringRules',
    notification: 'notifications',
    receiptMetadata: 'receiptMetadata',
  };

  const table = tableByType[type];
  if (!table) throw new Error('UNSUPPORTED_LOCAL_ENTITY');
  const rows = db.getAllSync<{ payload?: string }>(
    `SELECT payload FROM ${table} WHERE userId = ?`,
    userId,
  );
  return rows.flatMap((row) => (row.payload ? [decode<T>(row.payload)] : []));
}

export async function readTransactionRange<T extends LocalRecord>(
  userId: string,
  startAt: number,
  endAt: number,
): Promise<T[]> {
  requireUser(userId);
  assertRange(startAt, endAt);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const rows = db.getAllSync<{ payload: string }>(
    'SELECT payload FROM transactions WHERE userId = ? AND occurredAt >= ? AND occurredAt < ? ORDER BY occurredAt',
    userId,
    startAt,
    endAt,
  );
  return rows.map((row) => decode<T>(row.payload));
}

export async function readGroupRange<T extends LocalRecord>(
  userId: string,
  groupId: string,
  startAt: number,
  endAt: number,
): Promise<{ transactions: T[]; settlements: T[] }> {
  requireUser(userId);
  assertRange(startAt, endAt);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const transactions = db.getAllSync<{ payload: string }>(
    'SELECT payload FROM transactions WHERE userId = ? AND groupId = ? AND occurredAt >= ? AND occurredAt < ? ORDER BY occurredAt',
    userId, groupId, startAt, endAt,
  );
  const settlements = db.getAllSync<{ payload: string }>(
    'SELECT payload FROM settlements WHERE userId = ? AND groupId = ? AND occurredAt >= ? AND occurredAt < ? ORDER BY occurredAt',
    userId, groupId, startAt, endAt,
  );
  return {
    transactions: transactions.map((row) => decode<T>(row.payload)),
    settlements: settlements.map((row) => decode<T>(row.payload)),
  };
}
function assertRange(startAt: number, endAt: number): void {
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt >= endAt)
    throw new Error('INVALID_DATE_RANGE');
}

export async function applyLocalMutationAndEnqueue(
  userId: string,
  type: LocalEntity,
  record: LocalRecord,
  entry: OutboxEntry,
  relatedRecords: readonly { entityType: LocalEntity; record: LocalRecord }[] = [],
): Promise<void> {
  requireUser(userId);
  if (!entry.clientMutationId) throw new Error('CLIENT_MUTATION_ID_REQUIRED');
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    const prior = db.getFirstSync<{ localId: string }>(
      'SELECT localId FROM outbox WHERE userId = ? AND clientMutationId = ?',
      userId,
      entry.clientMutationId,
    );
    if (prior) return;
    for (const related of relatedRecords) putRecord(db, userId, related.entityType, related.record);
    putRecord(db, userId, type, record);
    db.runSync(
      `INSERT INTO outbox (localId, userId, operation, payload, clientMutationId, entityType, recordId,
        createdAt, clientUpdatedAt, baseUpdatedAt, deviceId, dependencies, retryCount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.localId,
      userId,
      entry.operation,
      entry.payload,
      entry.clientMutationId,
      type,
      entityId(record, type),
      entry.createdAt,
      entry.clientUpdatedAt ?? entry.createdAt,
      entry.baseUpdatedAt ?? null,
      entry.deviceId ?? null,
      JSON.stringify(entry.dependencies ?? []),
      entry.retryCount,
      entry.status,
    );
    const id = entityId(record, type);
    db.runSync(
      `INSERT INTO recordVersions (userId, entityType, recordId, clientUpdatedAt)
       VALUES (?, ?, ?, ?) ON CONFLICT(userId, entityType, recordId)
       DO UPDATE SET clientUpdatedAt = excluded.clientUpdatedAt`,
      userId,
      type,
      id,
      entry.createdAt,
    );
  });
  notify(userId);
}

export async function upsertCloudPage(
  userId: string,
  type: LocalEntity,
  records: readonly LocalRecord[],
): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    for (const record of records) putRecord(db, userId, type, record);
  });
  notify(userId);
}

export async function applyCloudChanges(
  userId: string,
  changes: readonly CloudChange[],
  cursor: string,
): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    for (const change of changes) {
      const mapped = db.getFirstSync<{ localId: string }>(
        'SELECT localId FROM idMappings WHERE userId = ? AND entityType = ? AND cloudId = ?',
        userId,
        change.entityType,
        change.documentId,
      );
      const localId =
        mapped?.localId ?? String(change.document?.id ?? change.document?._id ?? change.documentId);
      const localTable: Partial<Record<LocalEntity, string>> = {
        profile: 'appProfile',
        settings: 'appSettings',
        accountMember: 'accountMembers',
        groupMember: 'groupMembers',
        expensePayer: 'expensePayers',
        expenseParticipant: 'expenseParticipants',
        transactionTag: 'transactionTags',
        account: 'accounts',
        category: 'categories',
        transaction: 'transactions',
        group: 'groups',
        budget: 'budgets',
        goal: 'goals',
        recurringRule: 'recurringRules',
        settlement: 'settlements',
        goalContribution: 'goalContributions',
        notification: 'notifications',
        groupInvite: 'groupInvites',
        receiptMetadata: 'receiptMetadata',
      };
      const table = localTable[change.entityType];
      const hasCloudId = [
        'accounts',
        'categories',
        'transactions',
        'groups',
        'budgets',
        'goals',
        'recurringRules',
      ].includes(table ?? '');
      const row = table === 'appProfile'
        ? db.getFirstSync<{ id: string; payload: string }>(
            'SELECT userId AS id, payload FROM appProfile WHERE userId = ?',
            userId,
          )
        : table === 'appSettings'
          ? db.getFirstSync<{ id: string; payload: string }>(
              "SELECT key AS id, payload FROM appSettings WHERE userId = ? AND key = 'cloud'",
              userId,
            )
          : table && !['accountMembers', 'groupMembers', 'expensePayers', 'expenseParticipants', 'transactionTags'].includes(table)
            ? db.getFirstSync<{ id: string; payload: string }>(
                `SELECT id, payload FROM ${table} WHERE userId = ? AND ${hasCloudId ? '(id = ? OR cloudId = ?)' : 'id = ?'} LIMIT 1`,
                ...(hasCloudId ? [userId, localId, change.documentId] : [userId, localId]),
              )
            : null;
      const localVersion = db.getFirstSync<{ clientUpdatedAt: number }>(
        'SELECT clientUpdatedAt FROM recordVersions WHERE userId = ? AND entityType = ? AND recordId = ?',
        userId,
        change.entityType,
        localId,
      );
      if (change.deletedAt !== undefined) {
        db.runSync(
          `INSERT INTO tombstones (userId, entityType, recordId, revision, deletedAt) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(userId, entityType, recordId) DO UPDATE SET revision = excluded.revision, deletedAt = excluded.deletedAt`,
          userId,
          change.entityType,
          localId,
          String(change.revision),
          change.deletedAt,
        );
        if (table === 'appProfile')
          db.runSync('DELETE FROM appProfile WHERE userId = ?', userId);
        else if (table === 'appSettings')
          db.runSync("DELETE FROM appSettings WHERE userId = ? AND key = 'cloud'", userId);
        else if (
          table &&
          row &&
          !['accountMembers', 'groupMembers', 'expensePayers', 'expenseParticipants', 'transactionTags'].includes(table)
        )
          db.runSync(`DELETE FROM ${table} WHERE userId = ? AND id = ?`, userId, row.id);
      } else if (change.document) {
        if (row && localVersion && localVersion.clientUpdatedAt > 0) {
          const cloudPayload = encode(change.document);
          if (!sameFinancialContent(decode<LocalRecord>(row.payload), change.document)) {
            const conflictId = `${change.entityType}:${localId}:${change.revision}`;
            db.runSync(
              `INSERT OR IGNORE INTO conflicts
               (id, userId, entityType, recordId, localPayload, cloudPayload, localUpdatedAt, cloudUpdatedAt, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              conflictId,
              userId,
              change.entityType,
              localId,
              row.payload,
              cloudPayload,
              localVersion.clientUpdatedAt,
              change.updatedAt,
              Date.now(),
            );
            db.runSync(
              `UPDATE outbox SET status = 'conflict', lastError = ?, nextRetryAt = NULL
               WHERE userId = ? AND entityType = ? AND recordId = ? AND status IN ('pending', 'failed', 'syncing', 'synced')`,
              'A cloud edit conflicts with this local version.',
              userId,
              change.entityType,
              localId,
            );
            if (localVersion.clientUpdatedAt > change.updatedAt) {
              db.runSync(
                `UPDATE recordVersions SET cloudUpdatedAt = ?, revision = ?
                 WHERE userId = ? AND entityType = ? AND recordId = ?`,
                change.updatedAt,
                String(change.revision),
                userId,
                change.entityType,
                localId,
              );
              continue;
            }
          }
        }
        putRecord(db, userId, change.entityType, {
          ...change.document,
          id: localId,
          _id: change.documentId,
          cloudId: change.documentId,
        });
        db.runSync(
          'DELETE FROM tombstones WHERE userId = ? AND entityType = ? AND recordId = ?',
          userId,
          change.entityType,
          localId,
        );
      }
      db.runSync(
        `INSERT INTO recordVersions (userId, entityType, recordId, cloudUpdatedAt, clientUpdatedAt, revision)
         VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(userId, entityType, recordId)
         DO UPDATE SET cloudUpdatedAt = excluded.cloudUpdatedAt, revision = excluded.revision`,
        userId,
        change.entityType,
        localId,
        change.updatedAt,
        String(change.revision),
      );
    }
    const current = db.getFirstSync<{ revision: string }>(
      'SELECT revision FROM syncState WHERE userId = ?',
      userId,
    );
    const revision = changes.reduce(
      (maximum, change) => (BigInt(change.revision) > maximum ? BigInt(change.revision) : maximum),
      BigInt(current?.revision ?? '0'),
    );
    db.runSync(
      `INSERT INTO syncState (userId, cursor, revision, lastSyncedAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET cursor = excluded.cursor, revision = excluded.revision, lastSyncedAt = excluded.lastSyncedAt`,
      userId,
      cursor,
      revision.toString(),
      Date.now(),
    );
  });
  notify(userId);
}

export async function areDependenciesMapped(
  userId: string,
  dependencies: readonly string[],
): Promise<boolean> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  return dependencies.every((dependency) => {
    const separator = dependency.indexOf(':');
    if (separator < 1) {
      return Boolean(
        db.getFirstSync(
          'SELECT 1 FROM idMappings WHERE userId = ? AND localId = ? LIMIT 1',
          userId,
          dependency,
        ),
      );
    }
    const entityType = dependency.slice(0, separator);
    const localId = dependency.slice(separator + 1);
    return Boolean(
      db.getFirstSync(
        'SELECT 1 FROM idMappings WHERE userId = ? AND entityType = ? AND localId = ?',
        userId,
        entityType,
        localId,
      ),
    );
  });
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

export async function recordCoverage(
  userId: string,
  scope: string,
  startAt: number,
  endAt: number,
): Promise<void> {
  requireUser(userId);
  assertRange(startAt, endAt);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.runSync(
    `INSERT INTO syncCoverage (userId, scope, startAt, endAt, completedAt) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(userId, scope, startAt, endAt) DO UPDATE SET completedAt = excluded.completedAt`,
    userId,
    scope,
    startAt,
    endAt,
    Date.now(),
  );
  notify(userId);
}

export async function isRangeCovered(
  userId: string,
  scope: string,
  startAt: number,
  endAt: number,
): Promise<boolean> {
  requireUser(userId);
  assertRange(startAt, endAt);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  return Boolean(
    db.getFirstSync(
      'SELECT 1 FROM syncCoverage WHERE userId = ? AND scope = ? AND startAt <= ? AND endAt >= ? LIMIT 1',
      userId,
      scope,
      startAt,
      endAt,
    ),
  );
}

export type SyncReceipt = { serverId: string; revision: string; updatedAt: number };

export async function markSynced(
  userId: string,
  localId: string,
  entityType: LocalEntity,
  localEntityId: string,
  receipt: SyncReceipt,
): Promise<void> {
  requireUser(userId);
  if (!receipt.serverId || !receipt.revision || !Number.isFinite(receipt.updatedAt)) {
    throw new Error('SYNC_RECEIPT_REQUIRED');
  }
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId) VALUES (?, ?, ?, ?)',
      userId,
      entityType,
      localEntityId,
      receipt.serverId,
    );
    cloudToLocalIds.get(userId)?.set(receipt.serverId, localEntityId);
    const recordTable: Partial<Record<LocalEntity, string>> = {
      account: 'accounts',
      category: 'categories',
      transaction: 'transactions',
      group: 'groups',
      budget: 'budgets',
      profile: 'appProfile',
    };
    const table = recordTable[entityType];
    const localRecord = table === 'appProfile'
      ? db.getFirstSync<{ payload: string }>('SELECT payload FROM appProfile WHERE userId = ?', userId)
      : table
        ? db.getFirstSync<{ payload: string }>(`SELECT payload FROM ${table} WHERE userId = ? AND id = ?`, userId, localEntityId)
        : null;
    if (localRecord) {
      putRecord(db, userId, entityType, {
        ...decode<LocalRecord>(localRecord.payload),
        id: localEntityId,
        _id: receipt.serverId,
        cloudId: receipt.serverId,
        clientUpdatedAt: undefined,
        updatedAt: receipt.updatedAt,
      });
    }
    const dependencies = db.getAllSync<{ localId: string; payload: string; dependencies: string }>(
      `SELECT localId, payload, dependencies FROM outbox
       WHERE userId = ? AND status IN ('pending', 'failed', 'syncing')`,
      userId,
    );
    const dependencyKeys = new Set([localEntityId, `${entityType}:${localEntityId}`]);
    for (const dependent of dependencies) {
      const unresolved = JSON.parse(dependent.dependencies) as string[];
      const matching = unresolved.filter((dependency) => dependencyKeys.has(dependency));
      if (matching.length === 0) continue;
      const value = decode<unknown>(dependent.payload);
      db.runSync(
        'UPDATE outbox SET payload = ?, dependencies = ? WHERE userId = ? AND localId = ?',
        encode(rewriteForeignIds(value, localEntityId, receipt.serverId)),
        JSON.stringify(unresolved.filter((dependency) => !dependencyKeys.has(dependency))),
        userId,
        dependent.localId,
      );
    }
    db.runSync(
      `INSERT INTO recordVersions (userId, entityType, recordId, cloudUpdatedAt, clientUpdatedAt, revision)
       VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(userId, entityType, recordId)
       DO UPDATE SET cloudUpdatedAt = excluded.cloudUpdatedAt, revision = excluded.revision`,
      userId,
      entityType,
      localEntityId,
      receipt.updatedAt,
      receipt.revision,
    );
    db.runSync(
      `INSERT INTO syncState (userId, revision, lastSyncedAt) VALUES (?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET revision = excluded.revision, lastSyncedAt = excluded.lastSyncedAt`,
      userId,
      receipt.revision,
      receipt.updatedAt,
    );
    db.runSync(
      'UPDATE outbox SET status = ?, lastError = NULL, nextRetryAt = NULL WHERE userId = ? AND localId = ?',
      'synced',
      userId,
      localId,
    );
  });
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
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT INTO syncState (userId, revision, lastSyncedAt) VALUES (?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET revision = excluded.revision, lastSyncedAt = excluded.lastSyncedAt`,
      userId,
      receipt.revision,
      receipt.updatedAt,
    );
    db.runSync(
      'UPDATE outbox SET status = ?, lastError = NULL, nextRetryAt = NULL WHERE userId = ? AND localId = ?',
      'synced',
      userId,
      localId,
    );
  });
  notify(userId);
}

export async function retryFailed(userId: string): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.runSync(
    "UPDATE outbox SET status = 'pending', nextRetryAt = NULL WHERE userId = ? AND status = 'failed'",
    userId,
  );
  notify(userId);
}

export async function retryFailedEntry(userId: string, localId: string): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.runSync(
    "UPDATE outbox SET status = 'pending', nextRetryAt = NULL, lastError = NULL WHERE userId = ? AND localId = ? AND status = 'failed'",
    userId,
    localId,
  );
  notify(userId);
}

export async function recoverInterruptedSync(userId: string): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.runSync(
    "UPDATE outbox SET status = 'pending', nextRetryAt = NULL WHERE userId = ? AND status = 'syncing'",
    userId,
  );
  notify(userId);
}

export async function getSyncCursor(userId: string): Promise<string | null> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  return db.getFirstSync<{ cursor: string | null }>(
    'SELECT cursor FROM syncState WHERE userId = ?',
    userId,
  )?.cursor ?? null;
}

export async function hasCompletedBootstrap(userId: string): Promise<boolean> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  return db.getFirstSync<{ value: string }>(
    "SELECT value FROM localMetadata WHERE userId = ? AND key = 'bootstrapComplete'",
    userId,
  )?.value === '1';
}

export async function markBootstrapCompleted(userId: string): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.runSync(
    `INSERT INTO localMetadata (userId, key, value) VALUES (?, 'bootstrapComplete', '1')
     ON CONFLICT(userId, key) DO UPDATE SET value = '1'`,
    userId,
  );
}

export async function getSyncRevision(userId: string): Promise<string> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  return db.getFirstSync<{ revision: string }>(
    'SELECT revision FROM syncState WHERE userId = ?',
    userId,
  )?.revision ?? '0';
}

export type LocalSyncWindow = 7 | 30 | 90 | 180 | 365 | 'all';
const syncWindows: readonly LocalSyncWindow[] = [7, 30, 90, 180, 365, 'all'];
export type LocalSyncStatus = {
  pending: number;
  syncing: number;
  failed: number;
  conflicts: number;
  lastSyncedAt: number | null;
};

export async function getSyncWindow(userId: string): Promise<LocalSyncWindow> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const result = db.getFirstSync<{ value: string }>(
    'SELECT value FROM localMetadata WHERE userId = ? AND key = ?',
    userId,
    'syncWindowDays',
  );
  if (!result) return 30;
  const value = result.value === 'all' ? 'all' : Number(result.value);
  return syncWindows.includes(value as LocalSyncWindow) ? (value as LocalSyncWindow) : 30;
}

export async function setSyncWindow(userId: string, days: LocalSyncWindow): Promise<void> {
  requireUser(userId);
  if (!syncWindows.includes(days)) throw new Error('INVALID_SYNC_WINDOW');
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const now = Date.now();
  db.withTransactionSync(() => {
    const priorVersion = db.getFirstSync<{ value: string }>(
      "SELECT value FROM localMetadata WHERE userId = ? AND key = 'syncWindowMutationVersion'",
      userId,
    );
    const version = Number(priorVersion?.value ?? 0) + 1;
    const mutationId = `sync-window:${userId}:${version}`;
    db.runSync(
      `INSERT INTO localMetadata (userId, key, value) VALUES (?, 'syncWindowMutationVersion', ?)
       ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value`,
      userId,
      String(version),
    );
    db.runSync(
      `INSERT INTO localMetadata (userId, key, value) VALUES (?, ?, ?)
       ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value`,
      userId,
      'syncWindowDays',
      String(days),
    );
    db.runSync(
      `INSERT OR IGNORE INTO outbox (localId, userId, operation, payload, clientMutationId, createdAt,
        clientUpdatedAt, retryCount, dependencies, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, '[]', 'pending')`,
      `local-${mutationId}`,
      userId,
      'sync.bootstrap',
      encode({ days }),
      mutationId,
      now,
      now,
    );
  });
  notify(userId);
}

export async function getLocalSyncStatus(userId: string): Promise<LocalSyncStatus> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const counts = db.getFirstSync<{
    pending: number;
    syncing: number;
    failed: number;
    conflicts: number;
  }>(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'syncing' THEN 1 ELSE 0 END) AS syncing,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
       SUM(CASE WHEN status = 'conflict' THEN 1 ELSE 0 END) AS conflicts
     FROM outbox WHERE userId = ?`,
    userId,
  );
  const state = db.getFirstSync<{ lastSyncedAt: number | null }>(
    'SELECT lastSyncedAt FROM syncState WHERE userId = ?',
    userId,
  );
  return {
    pending: counts?.pending ?? 0,
    syncing: counts?.syncing ?? 0,
    failed: counts?.failed ?? 0,
    conflicts: counts?.conflicts ?? 0,
    lastSyncedAt: state?.lastSyncedAt ?? null,
  };
}

export async function listOutbox(userId: string): Promise<OutboxEntry[]> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const rows = db.getAllSync<{
    localId: string;
    operation: string;
    payload: string;
    clientMutationId: string;
    entityType: string | null;
    recordId: string | null;
    createdAt: number;
    clientUpdatedAt: number;
    baseUpdatedAt: number | null;
    deviceId: string | null;
    dependencies: string;
    retryCount: number;
    nextRetryAt: number | null;
    lastError: string | null;
    status: OutboxEntry['status'];
  }>('SELECT * FROM outbox WHERE userId = ? ORDER BY createdAt, localId', userId);
  return rows.map((row) => ({
    ...row,
    nextRetryAt: row.nextRetryAt ?? undefined,
    entityType: row.entityType ?? undefined,
    recordId: row.recordId ?? undefined,
    dependencies: JSON.parse(row.dependencies) as string[],
    baseUpdatedAt: row.baseUpdatedAt ?? undefined,
    deviceId: row.deviceId ?? undefined,
    lastError: row.lastError ?? undefined,
  }));
}

export async function getMappedCloudId(
  userId: string,
  type: LocalEntity,
  localId: string,
): Promise<string | null> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  return (
    db.getFirstSync<{ cloudId: string }>(
      'SELECT cloudId FROM idMappings WHERE userId = ? AND entityType = ? AND localId = ?',
      userId,
      type,
      localId,
    )?.cloudId ?? null
  );
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
  resolvedAt: number | null;
};

export async function readConflicts(userId: string): Promise<LocalConflict[]> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  const rows = db.getAllSync<{
    id: string;
    entityType: LocalEntity;
    recordId: string;
    localPayload: string;
    cloudPayload: string;
    localUpdatedAt: number;
    cloudUpdatedAt: number;
    createdAt: number;
    resolvedAt: number | null;
  }>('SELECT * FROM conflicts WHERE userId = ? ORDER BY createdAt DESC', userId);
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    recordId: row.recordId,
    localRecord: decode<LocalRecord>(row.localPayload),
    cloudRecord: decode<LocalRecord>(row.cloudPayload),
    localUpdatedAt: row.localUpdatedAt,
    cloudUpdatedAt: row.cloudUpdatedAt,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }));
}

export async function resolveConflict(
  userId: string,
  conflictId: string,
  winner: 'local' | 'cloud',
): Promise<void> {
  requireUser(userId);
  await initializeLocalDatabase();
  const db = await getLocalDatabase();
  db.withTransactionSync(() => {
    const conflict = db.getFirstSync<{
      entityType: LocalEntity;
      recordId: string;
      localPayload: string;
      cloudPayload: string;
      resolvedAt: number | null;
    }>('SELECT * FROM conflicts WHERE userId = ? AND id = ?', userId, conflictId);
    if (!conflict) throw new Error('CONFLICT_NOT_FOUND');
    if (conflict.resolvedAt !== null) throw new Error('CONFLICT_ALREADY_RESOLVED');
    const chosen = decode<LocalRecord>(
      winner === 'local' ? conflict.localPayload : conflict.cloudPayload,
    );
    putRecord(db, userId, conflict.entityType, { ...chosen, id: conflict.recordId });
    db.runSync(
      'UPDATE conflicts SET resolvedAt = ? WHERE userId = ? AND id = ?',
      Date.now(),
      userId,
      conflictId,
    );
    db.runSync(
      `UPDATE outbox SET status = ?, lastError = NULL, nextRetryAt = NULL
       WHERE userId = ? AND entityType = ? AND recordId = ? AND status = 'conflict'`,
      winner === 'local' ? 'pending' : 'synced',
      userId,
      conflict.entityType,
      conflict.recordId,
    );
  });
  notify(userId);
}
