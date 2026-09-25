import * as Crypto from 'expo-crypto';
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
    db.execSync(`ATTACH DATABASE '${databasePath.replaceAll("'", "''")}.encrypted' AS migrated KEY '${key}'`);
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

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;
  initialization ??= openEncryptedDatabase().then((db) => {
    database = db;
    return db;
  });
  return initialization;
}

export async function initializeLocalDatabase(): Promise<void> {
  const db = await getLocalDatabase();
  const version =
    db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version >= 4) return;
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
        payload TEXT NOT NULL,
        PRIMARY KEY (userId, id)
      );
      CREATE TABLE IF NOT EXISTS goals (
        userId TEXT NOT NULL,
        id TEXT NOT NULL,
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
    db.execSync('PRAGMA user_version = 4');
  });
}
