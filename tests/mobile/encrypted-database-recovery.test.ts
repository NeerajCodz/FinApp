import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Fake SQLCipher world: each file is plaintext (key null) or encrypted with a key. */
const world = vi.hoisted(() => ({
  files: new Map<string, { key: string | null; marker: string }>(),
  secure: new Map<string, string>(),
}));
const dir = 'file:///db';
const main = `${dir}/finapp.db`;
const keyName = 'finapp.sqlite.encryption-key.v1';

vi.mock('expo-constants', () => ({
  default: { appOwnership: null, executionEnvironment: 'standalone', expoConfig: {} },
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async () => new Uint8Array(32).fill(7),
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => world.secure.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void world.secure.set(key, value),
  deleteItemAsync: async (key: string) => void world.secure.delete(key),
}));
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(readonly uri: string) {}
    get exists() {
      return world.files.has(this.uri);
    }
    rename(name: string) {
      const value = world.files.get(this.uri);
      if (!value) throw new Error('FILE_NOT_FOUND');
      world.files.set(`${dir}/${name}`, value);
      world.files.delete(this.uri);
    }
    delete() {
      world.files.delete(this.uri);
    }
  },
}));
vi.mock('expo-sqlite', () => ({
  defaultDatabaseDirectory: dir,
  openDatabaseAsync: async () => {
    if (!world.files.has(main)) world.files.set(main, { key: null, marker: 'fresh' });
    let applied: string | null = null;
    const readable = () => {
      const file = world.files.get(main);
      if (!file) throw new Error('FILE_NOT_FOUND');
      if (file.key !== applied) throw new Error('file is not a database');
    };
    return {
      getFirstSync(sql: string) {
        if (sql.startsWith('PRAGMA cipher_version')) return { cipher_version: '4.6' };
        if (sql.includes('sqlite_master') || sql.startsWith('PRAGMA journal_mode')) readable();
        return null;
      },
      execSync(sql: string) {
        const key = /PRAGMA key = '([^']+)'/.exec(sql)?.[1];
        if (key) applied = key;
        const attach = /ATTACH DATABASE '([^']+)' AS migrated KEY '([^']+)'/.exec(sql);
        if (attach) {
          readable();
          world.files.set(attach[1]!, {
            key: attach[2]!,
            marker: world.files.get(main)!.marker,
          });
        }
      },
      closeAsync: async () => undefined,
    };
  },
}));

async function open() {
  vi.resetModules();
  const module = await import('../../apps/mobile/local/sqlite/database');
  return module.getLocalDatabase();
}

describe('encrypted local database recovery', () => {
  beforeEach(() => {
    world.files.clear();
    world.secure.clear();
  });

  it('encrypts a plaintext database and stores the key', async () => {
    world.files.set(main, { key: null, marker: 'user-data' });
    await open();
    const key = world.secure.get(keyName);
    expect(key).toBeTruthy();
    expect(world.files.get(main)).toEqual({ key, marker: 'user-data' });
    expect(world.files.has(`${main}.plaintext`)).toBe(false);
  });

  it('finishes the swap when the key was saved but the app died before it', async () => {
    world.files.set(main, { key: null, marker: 'user-data' });
    world.secure.set(keyName, 'saved-key');
    await open();
    expect(world.files.get(main)).toEqual({ key: 'saved-key', marker: 'user-data' });
  });

  it('quarantines an encrypted database whose key is gone and starts fresh', async () => {
    world.files.set(main, { key: 'lost-key', marker: 'restored-backup' });
    await open();
    expect(world.files.get(`${main}.quarantine`)).toEqual({
      key: 'lost-key',
      marker: 'restored-backup',
    });
    const key = world.secure.get(keyName);
    expect(world.files.get(main)).toEqual({ key, marker: 'fresh' });
  });

  it('quarantines a database that the stored key cannot open', async () => {
    world.files.set(main, { key: 'other-key', marker: 'mismatch' });
    world.secure.set(keyName, 'stored-key');
    await open();
    expect(world.files.get(`${main}.quarantine`)?.marker).toBe('mismatch');
    expect(world.files.get(main)?.marker).toBe('fresh');
  });
});
