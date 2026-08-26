import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;

export function getLocalDatabase(): SQLite.SQLiteDatabase {
  database ??= SQLite.openDatabaseSync('finapp.db');
  return database;
}

export function initializeLocalDatabase(): void {
  getLocalDatabase().execSync(
    `PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS outbox (localId TEXT PRIMARY KEY, operation TEXT NOT NULL, payload TEXT NOT NULL, createdAt INTEGER NOT NULL, retryCount INTEGER NOT NULL, status TEXT NOT NULL); CREATE TABLE IF NOT EXISTS drafts (localId TEXT PRIMARY KEY, payload TEXT NOT NULL, updatedAt INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS localMetadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
  );
}
