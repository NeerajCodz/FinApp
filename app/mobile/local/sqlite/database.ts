import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

const databaseName = 'finapp.db';
const encryptionKeyName = 'finapp.sqlite.encryption-key.v1';
let database: SQLite.SQLiteDatabase | null = null;
let initialization: Promise<SQLite.SQLiteDatabase> | null = null;

function createEncryptionKey(): string {
  const bytes = new Uint8Array(32);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('SECURE_RANDOM_UNAVAILABLE');
  }
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function openEncryptedDatabase(): Promise<SQLite.SQLiteDatabase> {
  const existingKey = await SecureStore.getItemAsync(encryptionKeyName);
  const key = existingKey ?? createEncryptionKey();
  const db = await SQLite.openDatabaseAsync(databaseName);
  if (existingKey) {
    db.execSync(`PRAGMA key = '${key}'`);
  } else {
    // The initial installation may contain the older plaintext outbox database.
    // An empty SQLCipher key reads it before rekeying the same database in place.
    db.execSync("PRAGMA key = ''");
    db.getFirstSync('PRAGMA journal_mode = DELETE');
    db.execSync(`PRAGMA rekey = '${key}'`);
    await SecureStore.setItemAsync(encryptionKeyName, key);
    db.getFirstSync('PRAGMA journal_mode = WAL');
  }
  const cipherVersion = db.getFirstSync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipherVersion?.cipher_version) throw new Error('SQLCIPHER_UNAVAILABLE');
  db.getFirstSync('PRAGMA user_version');
  return db;
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
  const version = db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
  if (version >= 1) return;
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
    db.execSync('PRAGMA user_version = 1');
  });
}
