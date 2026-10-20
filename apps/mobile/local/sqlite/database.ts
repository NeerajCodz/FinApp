import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import type { AESEncryptionKey } from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

const databaseName = 'finapp.db';
const encryptionKeyName = 'finapp.sqlite.encryption-key.v1';
let database: SQLite.SQLiteDatabase | null = null;
let initialization: Promise<SQLite.SQLiteDatabase> | null = null;

async function createEncryptionKey(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function databaseSibling(path: string, suffix: string): File {
  return new File(fileUri(`${path}${suffix}`));
}

async function openEncryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
  const existingKey = await SecureStore.getItemAsync(encryptionKeyName);
  const key = existingKey ?? (await createEncryptionKey());
  const databasePath = `${String(SQLite.defaultDatabaseDirectory).replace(/\/+$/, '')}/${databaseName}`;
  const databaseFile = new File(fileUri(databasePath));
  const stagedFile = databaseSibling(databasePath, '.encrypted');
  const backupFile = databaseSibling(databasePath, '.plaintext');

  if (!databaseFile.exists && backupFile.exists) {
    backupFile.rename(databaseName);
    if (stagedFile.exists) stagedFile.delete();
  } else if (!databaseFile.exists && stagedFile.exists && existingKey) {
    stagedFile.rename(databaseName);
  }

  const db = await SQLite.openDatabaseAsync(databaseName);
  const cipherVersion = db.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipherVersion?.cipher_version) throw new Error('SQLCIPHER_UNAVAILABLE');

  if (existingKey) {
    db.execSync(`PRAGMA key = '${key}'`);
    db.getFirstSync('SELECT name FROM sqlite_master LIMIT 1');
    db.getFirstSync('PRAGMA journal_mode = WAL');
    if (backupFile.exists) backupFile.delete();
    if (stagedFile.exists) stagedFile.delete();
    return db;
  }
  if (databaseFile.exists) {
    try {
      db.getFirstSync('SELECT name FROM sqlite_master LIMIT 1');
    } catch {
      throw new Error('LOCAL_DATABASE_KEY_MISSING');
    }
  }

  db.execSync('PRAGMA wal_checkpoint(FULL)');
  db.getFirstSync('PRAGMA journal_mode = DELETE');
  if (stagedFile.exists) stagedFile.delete();
  let attached = false;
  try {
    db.execSync(
      `ATTACH DATABASE '${databasePath.replaceAll("'", "''")}.encrypted' AS migrated KEY '${key}'`,
    );
    attached = true;
    db.execSync("SELECT sqlcipher_export('migrated')");
  } catch (error) {
    if (stagedFile.exists) stagedFile.delete();
    throw error;
  } finally {
    if (attached) db.execSync('DETACH DATABASE migrated');
  }
  let sourceMoved = false;
  let migratedDb: SQLite.SQLiteDatabase | null = null;
  try {
    await db.closeAsync();
    databaseFile.rename(`${databaseName}.plaintext`);
    sourceMoved = true;
    stagedFile.rename(databaseName);
    migratedDb = await SQLite.openDatabaseAsync(databaseName);
    migratedDb.execSync(`PRAGMA key = '${key}'`);
    migratedDb.getFirstSync('SELECT name FROM sqlite_master LIMIT 1');
    migratedDb.getFirstSync('PRAGMA journal_mode = WAL');
    await SecureStore.setItemAsync(encryptionKeyName, key);
    await backupFile.delete();
    return migratedDb;
  } catch (error) {
    if (migratedDb) await migratedDb.closeAsync().catch(() => undefined);
    if (sourceMoved && backupFile.exists) {
      const originalFile = new File(fileUri(databasePath));
      if (originalFile.exists) originalFile.delete();
      backupFile.rename(databaseName);
      if (!existingKey) await SecureStore.deleteItemAsync(encryptionKeyName);
    }
    const remainingStageFile = databaseSibling(databasePath, '.encrypted');
    if (remainingStageFile.exists) remainingStageFile.delete();
    throw error;
  }
}

const expoGoEncryptionKeyPrefix = 'finapp.sqlite.aes-key.v1.';
const expoGoSnapshotAad = Uint8Array.from(
  Array.from('finapp.sqlite.snapshot.v1', (character) => character.charCodeAt(0)),
);
let rawDatabase: SQLite.SQLiteDatabase | null = null;
let expoGoStorage = false;
let expoGoDirty = false;
let expoGoKey: AESEncryptionKey | null = null;
let expoGoKeyName: string | null = null;
let expoGoSnapshot: File | null = null;
let expoGoSnapshotNext: File | null = null;
let expoGoSnapshotPrevious: File | null = null;
let expoGoLegacyDatabase: File | null = null;
let persistenceTail: Promise<void> = Promise.resolve();

function expoGoStorageScope(): string {
  const config = Constants.expoConfig;
  const projectId = config?.extra?.eas?.projectId;
  const scope =
    typeof projectId === 'string' && projectId
      ? projectId
      : `${config?.owner ?? ''}-${config?.slug ?? ''}`;
  if (!scope || scope === '-') throw new Error('EXPO_GO_PROJECT_SCOPE_REQUIRED');
  return scope.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function makeExpoGoFiles(): {
  snapshot: File;
  next: File;
  previous: File;
  legacyDatabase: File;
} {
  const directory = String(SQLite.defaultDatabaseDirectory).replace(/\/+$/, '');
  const scope = expoGoStorageScope();
  const snapshotPath = `${directory}/finapp-${scope}.sqlite.aes`;
  return {
    snapshot: new File(fileUri(snapshotPath)),
    next: new File(fileUri(`${snapshotPath}.next`)),
    previous: new File(fileUri(`${snapshotPath}.previous`)),
    legacyDatabase: new File(fileUri(`${directory}/${databaseName}`)),
  };
}

async function readExpoGoEncryptionKey(required: boolean): Promise<AESEncryptionKey | null> {
  if (!expoGoKeyName) throw new Error('EXPO_GO_PROJECT_SCOPE_REQUIRED');
  const savedKey = await SecureStore.getItemAsync(expoGoKeyName);
  if (!savedKey) {
    if (required) throw new Error('EXPO_GO_DATABASE_KEY_MISSING');
    return null;
  }
  try {
    return await Crypto.AESEncryptionKey.import(savedKey, 'hex');
  } catch (cause) {
    throw new Error('EXPO_GO_DATABASE_KEY_INVALID', { cause });
  }
}

async function createExpoGoEncryptionKey(): Promise<AESEncryptionKey> {
  if (!expoGoKeyName) throw new Error('EXPO_GO_PROJECT_SCOPE_REQUIRED');
  const key = await Crypto.AESEncryptionKey.generate(Crypto.AESKeySize.AES256);
  const encodedKey = await key.encoded('hex');
  await SecureStore.setItemAsync(expoGoKeyName, encodedKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

async function decryptExpoGoSnapshot(file: File, key: AESEncryptionKey): Promise<Uint8Array> {
  try {
    const sealed = Crypto.AESSealedData.fromCombined(await file.bytes());
    return await Crypto.aesDecryptAsync(sealed, key, { additionalData: expoGoSnapshotAad });
  } catch (cause) {
    throw new Error('EXPO_GO_DATABASE_AUTHENTICATION_FAILED', { cause });
  }
}

function removeExpoGoLegacyDatabase(): void {
  if (!expoGoLegacyDatabase) return;
  for (const suffix of ['', '-wal', '-shm']) {
    const file = suffix
      ? new File(fileUri(`${expoGoLegacyDatabase.uri}${suffix}`))
      : expoGoLegacyDatabase;
    if (file.exists) file.delete();
  }
  expoGoLegacyDatabase = null;
}
async function openExpoGoDatabase(): Promise<SQLite.SQLiteDatabase> {
  const files = makeExpoGoFiles();
  expoGoSnapshot = files.snapshot;
  expoGoSnapshotNext = files.next;
  expoGoSnapshotPrevious = files.previous;
  expoGoLegacyDatabase = files.legacyDatabase;
  const scope = expoGoStorageScope();
  expoGoKeyName = `${expoGoEncryptionKeyPrefix}${scope}`;

  if (!files.snapshot.exists) {
    if (files.previous.exists) files.previous.moveSync(files.snapshot);
    else if (files.next.exists) files.next.moveSync(files.snapshot);
  }

  if (files.snapshot.exists) {
    const key = await readExpoGoEncryptionKey(true);
    if (!key) throw new Error('EXPO_GO_DATABASE_KEY_MISSING');
    expoGoKey = key;
    const plaintext = await decryptExpoGoSnapshot(files.snapshot, key);
    const db = await SQLite.deserializeDatabaseAsync(plaintext);
    if (files.previous.exists) files.previous.delete();
    if (files.next.exists) files.next.delete();
    return db;
  }

  if (files.legacyDatabase.exists) {
    let legacy: SQLite.SQLiteDatabase | null = null;
    try {
      legacy = await SQLite.openDatabaseAsync(databaseName);
      const firstTable = legacy.getFirstSync<{ name: string }>(
        'SELECT name FROM sqlite_master LIMIT 1',
      );
      if (!firstTable) {
        await legacy.closeAsync();
        legacy = null;
        removeExpoGoLegacyDatabase();
        return SQLite.openDatabaseAsync(':memory:');
      }
      const serialized = legacy.serializeSync();
      await legacy.closeAsync();
      legacy = null;
      expoGoDirty = true;
      return await SQLite.deserializeDatabaseAsync(serialized);
    } catch (cause) {
      if (legacy) await legacy.closeAsync().catch(() => undefined);
      throw new Error('EXPO_GO_LEGACY_DATABASE_UNREADABLE', { cause });
    }
  }

  return SQLite.openDatabaseAsync(':memory:');
}

function trackExpoGoWrites(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  return new Proxy(db, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (property === 'runSync' || property === 'execSync') {
        return (...args: unknown[]) => {
          const result = (value as (...arguments_: unknown[]) => unknown).apply(target, args);
          expoGoDirty = true;
          return result;
        };
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function writeExpoGoSnapshot(bytes: Uint8Array): void {
  if (!expoGoSnapshot || !expoGoSnapshotNext || !expoGoSnapshotPrevious) {
    throw new Error('EXPO_GO_DATABASE_STORAGE_UNAVAILABLE');
  }
  if (expoGoSnapshotNext.exists) expoGoSnapshotNext.delete();
  expoGoSnapshotNext.create();
  expoGoSnapshotNext.write(bytes);
  if (expoGoSnapshot.exists) {
    if (expoGoSnapshotPrevious.exists) expoGoSnapshotPrevious.delete();
    expoGoSnapshot.moveSync(expoGoSnapshotPrevious);
  }
  try {
    expoGoSnapshotNext.moveSync(expoGoSnapshot);
    if (expoGoSnapshotPrevious.exists) expoGoSnapshotPrevious.delete();
  } catch (error) {
    if (!expoGoSnapshot.exists && expoGoSnapshotPrevious.exists) {
      expoGoSnapshotPrevious.moveSync(expoGoSnapshot);
    }
    throw error;
  }
}

export function persistLocalDatabase(): Promise<void> {
  if (!expoGoStorage || !rawDatabase || !expoGoDirty) return Promise.resolve();
  const persist = persistenceTail
    .catch(() => undefined)
    .then(async () => {
      if (!expoGoStorage || !rawDatabase || !expoGoDirty) return;
      expoGoDirty = false;
      try {
        const key =
          expoGoKey ??
          (await readExpoGoEncryptionKey(false)) ??
          (await createExpoGoEncryptionKey());
        expoGoKey = key;
        const serialized = await rawDatabase.serializeAsync();
        const sealed = await Crypto.aesEncryptAsync(serialized, key, {
          additionalData: expoGoSnapshotAad,
        });
        writeExpoGoSnapshot(await sealed.combined());
        if (expoGoLegacyDatabase?.exists) removeExpoGoLegacyDatabase();
      } catch (error) {
        expoGoDirty = true;
        throw error;
      }
    });
  persistenceTail = persist;
  return persist;
}

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  initialization ??= (async () => {
    expoGoStorage =
      Constants.executionEnvironment === 'storeClient' && Constants.appOwnership === 'expo';
    const opened = expoGoStorage ? await openExpoGoDatabase() : await openEncryptedDatabase();
    rawDatabase = opened;
    const ready = expoGoStorage ? trackExpoGoWrites(opened) : opened;
    database = ready;
    if (expoGoDirty) await persistLocalDatabase();
    return ready;
  })().catch(async (error: unknown) => {
    if (rawDatabase) await rawDatabase.closeAsync().catch(() => undefined);
    database = null;
    rawDatabase = null;
    initialization = null;
    expoGoStorage = false;
    throw error;
  });
  return initialization;
}

export async function initializeLocalDatabase(): Promise<void> {
  const db = await getLocalDatabase();
  const version =
    db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version >= 5) return;
  db.withTransactionSync(() => {
    const tables = db
      .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((table) => table.name);
    let legacyMetadata = false;
    if (tables.includes('localMetadata')) {
      const columns = db
        .getAllSync<{ name: string }>('PRAGMA table_info(localMetadata)')
        .map((column) => column.name);
      legacyMetadata = !columns.includes('userId');
      if (legacyMetadata) db.execSync('ALTER TABLE localMetadata RENAME TO localMetadata_legacy');
    }
    db.execSync(`
      CREATE TABLE IF NOT EXISTS outbox (
        localId TEXT PRIMARY KEY,
        userId TEXT,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        clientMutationId TEXT NOT NULL DEFAULT '',
        entityType TEXT,
        recordId TEXT,
        createdAt INTEGER NOT NULL,
        clientUpdatedAt INTEGER NOT NULL DEFAULT 0,
        baseUpdatedAt INTEGER,
        deviceId TEXT,
        dependencies TEXT NOT NULL DEFAULT '[]',
        retryCount INTEGER NOT NULL,
        nextRetryAt INTEGER,
        lastError TEXT,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS drafts (
        localId TEXT PRIMARY KEY,
        userId TEXT,
        payload TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS appProfile (
        userId TEXT PRIMARY KEY,
        cloudId TEXT,
        payload TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS appSettings (
        userId TEXT NOT NULL,
        key TEXT NOT NULL,
        payload TEXT NOT NULL,
        updatedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, key)
      );
      CREATE TABLE IF NOT EXISTS accounts (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS accountMembers (
        userId TEXT NOT NULL,
        accountId TEXT NOT NULL,
        memberId TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, accountId, memberId)
      );
      CREATE TABLE IF NOT EXISTS categories (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS transactions (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        accountId TEXT NOT NULL,
        categoryId TEXT,
        groupId TEXT,
        occurredAt INTEGER NOT NULL,
        amountMinor TEXT NOT NULL,
        status TEXT NOT NULL,
        deletedAt INTEGER,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS transactionTags (
        userId TEXT NOT NULL,
        transactionId TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY (userId, transactionId, tag)
      );
      CREATE TABLE IF NOT EXISTS groups (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS groupMembers (
        userId TEXT NOT NULL,
        groupId TEXT NOT NULL,
        memberId TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, groupId, memberId)
      );
      CREATE TABLE IF NOT EXISTS groupInvites (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        groupId TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS expensePayers (
        userId TEXT NOT NULL,
        transactionId TEXT NOT NULL,
        memberId TEXT NOT NULL,
        amountMinor TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, transactionId, memberId)
      );
      CREATE TABLE IF NOT EXISTS expenseParticipants (
        userId TEXT NOT NULL,
        transactionId TEXT NOT NULL,
        memberId TEXT NOT NULL,
        amountMinor TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, transactionId, memberId)
      );
      CREATE TABLE IF NOT EXISTS settlements (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        groupId TEXT NOT NULL,
        occurredAt INTEGER NOT NULL,
        amountMinor TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS budgets (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS goals (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS goalContributions (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        goalId TEXT NOT NULL,
        occurredAt INTEGER NOT NULL,
        amountMinor TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS recurringRules (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        cloudId TEXT,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS notifications (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS receiptMetadata (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
        transactionId TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS localMetadata (
        userId TEXT NOT NULL DEFAULT '',
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (userId, key)
      );
      CREATE TABLE IF NOT EXISTS syncCoverage (
        userId TEXT NOT NULL,
        scope TEXT NOT NULL,
        startAt INTEGER NOT NULL,
        endAt INTEGER NOT NULL,
        completedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, scope, startAt, endAt)
      );
      CREATE TABLE IF NOT EXISTS syncState (
        userId TEXT PRIMARY KEY,
        cursor TEXT,
        revision TEXT NOT NULL DEFAULT '0',
        lastSyncedAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS idMappings (
        userId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        localId TEXT NOT NULL,
        cloudId TEXT NOT NULL,
        PRIMARY KEY (userId, entityType, localId),
        UNIQUE (userId, entityType, cloudId)
      );
      CREATE TABLE IF NOT EXISTS recordVersions (
        userId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        recordId TEXT NOT NULL,
        cloudUpdatedAt INTEGER,
        clientUpdatedAt INTEGER NOT NULL,
        revision TEXT,
        PRIMARY KEY (userId, entityType, recordId)
      );
      CREATE TABLE IF NOT EXISTS tombstones (
        userId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        recordId TEXT NOT NULL,
        revision TEXT NOT NULL,
        deletedAt INTEGER NOT NULL,
        PRIMARY KEY (userId, entityType, recordId)
      );
      CREATE TABLE IF NOT EXISTS conflicts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        entityType TEXT NOT NULL,
        recordId TEXT NOT NULL,
        localPayload TEXT NOT NULL,
        cloudPayload TEXT NOT NULL,
        localUpdatedAt INTEGER NOT NULL,
        cloudUpdatedAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        resolvedAt INTEGER
      );
    `);
    for (const table of ['budgets', 'goals', 'recurringRules'] as const) {
      const columns = db
        .getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
        .map((column) => column.name);
      if (!columns.includes('cloudId')) db.execSync(`ALTER TABLE ${table} ADD COLUMN cloudId TEXT`);
    }
    const outboxColumns = db
      .getAllSync<{ name: string }>('PRAGMA table_info(outbox)')
      .map((column) => column.name);
    for (const [column, definition] of [
      ['userId', 'TEXT'],
      ['clientMutationId', "TEXT NOT NULL DEFAULT ''"],
      ['entityType', 'TEXT'],
      ['recordId', 'TEXT'],
      ['clientUpdatedAt', 'INTEGER NOT NULL DEFAULT 0'],
      ['baseUpdatedAt', 'INTEGER'],
      ['deviceId', 'TEXT'],
      ['dependencies', "TEXT NOT NULL DEFAULT '[]'"],
      ['nextRetryAt', 'INTEGER'],
      ['lastError', 'TEXT'],
    ] as const) {
      if (!outboxColumns.includes(column)) {
        db.execSync(`ALTER TABLE outbox ADD COLUMN ${column} ${definition}`);
      }
    }
    const draftColumns = db
      .getAllSync<{ name: string }>('PRAGMA table_info(drafts)')
      .map((column) => column.name);
    if (!draftColumns.includes('userId')) db.execSync('ALTER TABLE drafts ADD COLUMN userId TEXT');
    db.execSync(`
      UPDATE outbox SET clientMutationId = localId
      WHERE clientMutationId = '' AND localId IS NOT NULL;
    `);
    if (legacyMetadata) {
      db.execSync(`
        INSERT OR IGNORE INTO localMetadata (userId, key, value)
        SELECT '', key, value FROM localMetadata_legacy;
        DROP TABLE localMetadata_legacy;
      `);
    }
    db.execSync(`
      CREATE INDEX IF NOT EXISTS accounts_user_cloud ON accounts(userId, cloudId);
      CREATE INDEX IF NOT EXISTS categories_user_cloud ON categories(userId, cloudId);
      CREATE INDEX IF NOT EXISTS budgets_user_cloud ON budgets(userId, cloudId);
      CREATE INDEX IF NOT EXISTS goals_user_cloud ON goals(userId, cloudId);
      CREATE INDEX IF NOT EXISTS recurringRules_user_cloud ON recurringRules(userId, cloudId);
      CREATE INDEX IF NOT EXISTS transactions_user_date ON transactions(userId, occurredAt);
      CREATE INDEX IF NOT EXISTS transactions_account_date ON transactions(userId, accountId, occurredAt);
      CREATE INDEX IF NOT EXISTS transactions_category_date ON transactions(userId, categoryId, occurredAt);
      CREATE INDEX IF NOT EXISTS transactions_group_date ON transactions(userId, groupId, occurredAt);
      CREATE INDEX IF NOT EXISTS groupMembers_user_group ON groupMembers(userId, memberId, groupId);
      CREATE INDEX IF NOT EXISTS expensePayers_user_tx ON expensePayers(userId, transactionId);
      CREATE INDEX IF NOT EXISTS expenseParticipants_user_tx ON expenseParticipants(userId, transactionId);
      CREATE INDEX IF NOT EXISTS settlements_group_date ON settlements(userId, groupId, occurredAt);
      CREATE INDEX IF NOT EXISTS goalContributions_goal_date ON goalContributions(userId, goalId, occurredAt);
      CREATE INDEX IF NOT EXISTS notifications_user_date ON notifications(userId, createdAt);
      CREATE INDEX IF NOT EXISTS receiptMetadata_transaction ON receiptMetadata(userId, transactionId);
      CREATE INDEX IF NOT EXISTS outbox_user_status_created ON outbox(userId, status, createdAt);
      CREATE UNIQUE INDEX IF NOT EXISTS outbox_user_mutation
        ON outbox(userId, clientMutationId) WHERE clientMutationId <> '';
    `);
    db.execSync(`
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'account', id, cloudId FROM accounts
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'category', id, cloudId FROM categories
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'group', id, cloudId FROM groups
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'transaction', id, cloudId FROM transactions
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'budget', id, cloudId FROM budgets
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'goal', id, cloudId FROM goals
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      INSERT OR REPLACE INTO idMappings (userId, entityType, localId, cloudId)
      SELECT userId, 'recurringRule', id, cloudId FROM recurringRules
      WHERE cloudId IS NOT NULL AND id <> cloudId;
      DELETE FROM accounts AS remote
      WHERE remote.id = remote.cloudId AND EXISTS (
        SELECT 1 FROM accounts AS local
        WHERE local.userId = remote.userId AND local.cloudId = remote.cloudId AND local.id <> remote.id
      );
      DELETE FROM categories AS remote
      WHERE remote.id = remote.cloudId AND EXISTS (
        SELECT 1 FROM categories AS local
        WHERE local.userId = remote.userId AND local.cloudId = remote.cloudId AND local.id <> remote.id
      );
      DELETE FROM groups AS remote
      WHERE remote.id = remote.cloudId AND EXISTS (
        SELECT 1 FROM groups AS local
        WHERE local.userId = remote.userId AND local.cloudId = remote.cloudId AND local.id <> remote.id
      );
      DELETE FROM transactions AS remote
      WHERE remote.id = remote.cloudId AND EXISTS (
        SELECT 1 FROM transactions AS local
        WHERE local.userId = remote.userId AND local.cloudId = remote.cloudId AND local.id <> remote.id
      );
    `);
    db.execSync('PRAGMA user_version = 5');
  });
  await persistLocalDatabase();
}
