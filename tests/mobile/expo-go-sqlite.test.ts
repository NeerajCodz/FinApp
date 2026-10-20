import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  files: new Map<string, Uint8Array>(),
  secureValues: new Map<string, string>(),
  legacyRows: [] as { id: string; payload: string }[],
}));

vi.mock('expo-constants', () => ({
  default: {
    appOwnership: 'expo',
    executionEnvironment: 'storeClient',
    expoConfig: {
      owner: 'neerajcodz',
      slug: 'finapp',
      extra: { eas: { projectId: 'project-test' } },
    },
  },
}));

vi.mock('expo-file-system', () => ({
  File: class {
    constructor(readonly uri: string) {}
    get exists() {
      return storage.files.has(this.uri);
    }
    async bytes() {
      const value = storage.files.get(this.uri);
      if (!value) throw new Error('FILE_NOT_FOUND');
      return new Uint8Array(value);
    }
    create(options?: { overwrite?: boolean }) {
      if (this.exists && !options?.overwrite) throw new Error('FILE_EXISTS');
      storage.files.set(this.uri, new Uint8Array());
    }
    write(value: Uint8Array) {
      storage.files.set(this.uri, new Uint8Array(value));
    }
    delete() {
      storage.files.delete(this.uri);
    }
    moveSync(destination: { uri: string }, options?: { overwrite?: boolean }) {
      const value = storage.files.get(this.uri);
      if (!value) throw new Error('FILE_NOT_FOUND');
      if (storage.files.has(destination.uri) && !options?.overwrite) throw new Error('FILE_EXISTS');
      storage.files.set(destination.uri, value);
      storage.files.delete(this.uri);
    }
  },
}));

vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: async (key: string) => storage.secureValues.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    storage.secureValues.set(key, value);
  },
}));

vi.mock('expo-crypto', async () => {
  const { createCipheriv, createDecipheriv, randomBytes } = await import('node:crypto');
  class EncryptionKey {
    constructor(readonly key: Uint8Array) {}
    static async generate() {
      return new EncryptionKey(randomBytes(32));
    }
    static async import(value: string, encoding: 'hex') {
      return new EncryptionKey(Buffer.from(value, encoding));
    }
    async encoded() {
      return Buffer.from(this.key).toString('hex');
    }
  }
  class SealedData {
    constructor(
      readonly iv: Uint8Array,
      readonly ciphertext: Uint8Array,
      readonly tag: Uint8Array,
    ) {}
    static fromCombined(value: Uint8Array) {
      return new SealedData(value.slice(0, 12), value.slice(12, -16), value.slice(-16));
    }
    async combined() {
      return Uint8Array.from(Buffer.concat([this.iv, this.ciphertext, this.tag]));
    }
  }
  return {
    AESKeySize: { AES256: 256 },
    AESEncryptionKey: EncryptionKey,
    AESSealedData: SealedData,
    aesEncryptAsync: async (
      plaintext: Uint8Array,
      key: EncryptionKey,
      options: { additionalData: Uint8Array },
    ) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key.key, iv);
      cipher.setAAD(options.additionalData);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return new SealedData(iv, ciphertext, cipher.getAuthTag());
    },
    aesDecryptAsync: async (
      sealed: SealedData,
      key: EncryptionKey,
      options: { additionalData: Uint8Array },
    ) => {
      const decipher = createDecipheriv('aes-256-gcm', key.key, sealed.iv);
      decipher.setAAD(options.additionalData);
      decipher.setAuthTag(sealed.tag);
      return Uint8Array.from(Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]));
    },
  };
});

vi.mock('expo-sqlite', () => {
  type Row = { id: string; payload: string };
  type State = { rows: [string, string][]; outbox: [string, string][] };
  const createDatabase = (initialState: State = { rows: [], outbox: [] }) => {
    const rows = new Map(initialState.rows);
    const outbox = new Map(initialState.outbox);
    return {
      databasePath: ':memory:',
      execSync() {},
      runSync(sql: string, ...values: unknown[]) {
        if (/UPDATE outbox/i.test(sql)) {
          const [status, , , , userId, localId] = values;
          outbox.set(`${userId}:${localId}`, String(status));
        } else {
          rows.set(String(values[0]), String(values[1]));
        }
        return { changes: 1 };
      },
      getFirstSync<T>(sql: string, ...values: unknown[]): T | null {
        if (/PRAGMA user_version/i.test(sql)) return { user_version: 5 } as T;
        if (/sqlite_master/i.test(sql)) return rows.size ? ({ name: 'records' } as T) : null;
        if (/SELECT status FROM outbox/i.test(sql)) {
          const status = outbox.get(`${values[0]}:${values[1]}`);
          return status === undefined ? null : ({ status } as T);
        }
        const payload = rows.get(String(values[0]));
        return payload === undefined ? null : ({ payload } as T);
      },
      closeAsync: async () => undefined,
      serializeSync: () =>
        new TextEncoder().encode(JSON.stringify({ rows: [...rows], outbox: [...outbox] })),
      serializeAsync: async () =>
        new TextEncoder().encode(JSON.stringify({ rows: [...rows], outbox: [...outbox] })),
    };
  };
  return {
    defaultDatabaseDirectory: 'file:///database',
    openDatabaseAsync: async (name: string) =>
      name === 'finapp.db'
        ? createDatabase({
            rows: storage.legacyRows.map(({ id, payload }) => [id, payload] as [string, string]),
            outbox: [],
          })
        : createDatabase(),
    deserializeDatabaseAsync: async (bytes: Uint8Array) =>
      createDatabase(JSON.parse(new TextDecoder().decode(bytes)) as State),
  };
});

describe('Expo Go encrypted SQLite snapshots', () => {
  beforeEach(() => {
    storage.secureValues.clear();
    storage.files.clear();
    storage.legacyRows = [];
    vi.resetModules();
  });

  // Dynamic imports let each test simulate closing and relaunching the app module.
  it('persists SQLite data only as an authenticated encrypted snapshot and restores it', async () => {
    const first = await import('../../apps/mobile/local/sqlite/database');
    const db = await first.getLocalDatabase();
    db.runSync('INSERT INTO privateRecords VALUES (?, ?)', 'record-1', 'private-financial-value');
    await first.persistLocalDatabase();

    const [snapshotPath, snapshot] =
      [...storage.files.entries()].find(([path]) =>
        path.endsWith('finapp-project-test.sqlite.aes'),
      ) ?? [];
    expect(snapshotPath).toBeDefined();
    expect(Buffer.from(snapshot!).includes(Buffer.from('private-financial-value'))).toBe(false);

    // Resetting the app module simulates an app process restart before reopening its DB.
    vi.resetModules();
    const second = await import('../../apps/mobile/local/sqlite/database');
    const restored = await second.getLocalDatabase();
    expect(
      restored.getFirstSync('SELECT payload FROM privateRecords WHERE id = ?', 'record-1'),
    ).toEqual({ payload: 'private-financial-value' });
  });
  it('imports an existing plain Expo Go database before removing its plaintext file', async () => {
    storage.legacyRows = [{ id: 'old-record', payload: 'existing-offline-data' }];
    storage.files.set('file:///database/finapp.db', new Uint8Array([1]));
    const { getLocalDatabase } = await import('../../apps/mobile/local/sqlite/database');
    const db = await getLocalDatabase();

    expect(db.getFirstSync('SELECT payload FROM records WHERE id = ?', 'old-record')).toEqual({
      payload: 'existing-offline-data',
    });
    expect(storage.files.has('file:///database/finapp.db')).toBe(false);
    expect(
      [...storage.files.keys()].some((path) => path.endsWith('finapp-project-test.sqlite.aes')),
    ).toBe(true);
  });
  it('discards only an empty legacy database left by an earlier unsupported Go start', async () => {
    storage.files.set('file:///database/finapp.db', new Uint8Array());
    const { getLocalDatabase } = await import('../../apps/mobile/local/sqlite/database');
    const db = await getLocalDatabase();

    expect(db.databasePath).toBe(':memory:');
    expect(storage.files.has('file:///database/finapp.db')).toBe(false);
  });
  it('commits repository writes to the encrypted snapshot before returning', async () => {
    const { updateOutboxStatus } = await import('../../apps/mobile/local/outbox/storage');
    await updateOutboxStatus('user-1', 'mutation-1', 'failed', 2);

    vi.resetModules();
    const { getLocalDatabase } = await import('../../apps/mobile/local/sqlite/database');
    const db = await getLocalDatabase();
    expect(
      db.getFirstSync(
        'SELECT status FROM outbox WHERE userId = ? AND localId = ?',
        'user-1',
        'mutation-1',
      ),
    ).toEqual({ status: 'failed' });
  });

  it('fails closed and preserves a snapshot whose authentication tag is invalid', async () => {
    const first = await import('../../apps/mobile/local/sqlite/database');
    const db = await first.getLocalDatabase();
    db.runSync('INSERT INTO privateRecords VALUES (?, ?)', 'record-2', 'must-not-be-reset');
    await first.persistLocalDatabase();

    const [snapshotPath, snapshot] =
      [...storage.files.entries()].find(([path]) =>
        path.endsWith('finapp-project-test.sqlite.aes'),
      ) ?? [];
    expect(snapshotPath).toBeDefined();
    const corrupted = new Uint8Array(snapshot!);
    corrupted[corrupted.length - 1] ^= 0xff;
    storage.files.set(snapshotPath!, corrupted);

    vi.resetModules();
    const second = await import('../../apps/mobile/local/sqlite/database');
    await expect(second.getLocalDatabase()).rejects.toThrow(
      'EXPO_GO_DATABASE_AUTHENTICATION_FAILED',
    );
    expect(storage.files.has(snapshotPath!)).toBe(true);
  });
});
