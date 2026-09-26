import { describe, expect, it } from 'vitest';
import { openWebDatabase, WEB_DATABASE_NAME } from '../../apps/web/lib/offline/database';
import * as repository from '../../apps/web/lib/offline/repository';

const userA = 'user-a';
const userB = 'user-b';

describe('browser offline repository', () => {
  it('persists an optimistic transaction and exactly one matching outbox entry', async () => {
    const id = await repository.commitLocalWrite(
      userA,
      'transaction',
      'transaction.create',
      { id: 'txn-local-1', amount: '00125.50', type: 'expense' },
      { amount: '00125.50', type: 'expense' },
      { clientMutationId: 'mutation-1' },
    );

    expect(await repository.getLocalRecord(userA, 'transaction', id)).toMatchObject({
      id: 'txn-local-1',
      amount: '00125.50',
      type: 'expense',
    });
    const entries = await repository.listOutbox(userA);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      localId: 'local-mutation-1',
      clientMutationId: 'mutation-1',
      recordId: 'txn-local-1',
      operation: 'transaction.create',
      status: 'pending',
      payload: { clientMutationId: 'mutation-1', amount: '00125.50' },
    });
    expect((await repository.readLocal(userA, 'transaction'))[0]).toMatchObject({
      amount: '00125.50',
      id: id,
    });
    expect(await repository.readLocal(userB, 'transaction')).toEqual([]);
    expect(await repository.listOutbox(userB)).toEqual([]);
  });

  it('isolates records, pending writes, and cloud acknowledgements by user', async () => {
    const localId = await repository.commitLocalWrite(
      userA,
      'account',
      'account.create',
      { id: 'account-local', name: 'Checking' },
      { name: 'Checking' },
      { clientMutationId: 'account-mutation' },
    );

    await repository.markSynced(userA, 'local-account-mutation', 'account', localId, {
      serverId: 'cloud-account',
      revision: '17',
      updatedAt: 1_700_000_000_000,
    });

    expect(await repository.getLocalRecord(userB, 'account', localId)).toBeNull();
    expect(await repository.getMappedCloudId(userA, 'account', localId)).toBe('cloud-account');
    expect(await repository.getMappedCloudId(userB, 'account', localId)).toBeNull();
    expect(await repository.listOutbox(userA)).toMatchObject([{ status: 'synced' }]);
    expect(await repository.listOutbox(userB)).toEqual([]);
  });

  it('applies cloud changes and preserves both sides of a local/cloud conflict', async () => {
    const localId = await repository.commitLocalWrite(
      userA,
      'transaction',
      'transaction.create',
      { id: 'txn-local', amount: '12', memo: 'Original' },
      { amount: '12' },
      { clientMutationId: 'txn-original' },
    );
    await repository.markSynced(userA, 'local-txn-original', 'transaction', localId, {
      serverId: 'cloud-txn',
      revision: '8',
      updatedAt: 10,
    });
    await repository.commitLocalWrite(
      userA,
      'transaction',
      'transaction.update',
      { id: localId, amount: '12', memo: 'Local edit' },
      { amount: '12', memo: 'Local edit' },
      { clientMutationId: 'txn-mutation' },
    );
    await repository.applyCloudChanges(
      userA,
      [
        {
          entityType: 'transaction',
          documentId: 'cloud-txn',
          revision: 9n,
          updatedAt: 1,
          document: { amount: '1200', memo: 'Cloud edit' },
        },
        {
          entityType: 'account',
          documentId: 'cloud-account-from-feed',
          revision: '10',
          updatedAt: 2,
          document: { name: 'Feed account', balance: '0007' },
        },
      ],
      'cursor-10',
    );

    expect(await repository.getLocalRecord(userA, 'transaction', localId)).toMatchObject({
      amount: '12',
      memo: 'Local edit',
    });
    expect(await repository.readLocal(userA, 'account')).toMatchObject([
      { id: 'cloud-account-from-feed', balance: '0007', name: 'Feed account' },
    ]);
    expect(await repository.getSyncCursor(userA)).toBe('cursor-10');
    expect(await repository.getLocalSyncStatus(userA)).toMatchObject({ conflicts: 1 });
    expect((await repository.listOutbox(userA)).map((entry) => entry.status).sort()).toEqual([
      'conflict',
      'synced',
    ]);

    const [conflict] = await repository.readConflicts(userA);
    expect(conflict).toMatchObject({
      entityType: 'transaction',
      recordId: 'txn-local',
      localRecord: { amount: '12', memo: 'Local edit' },
      cloudRecord: { amount: '1200', memo: 'Cloud edit', _id: 'cloud-txn' },
    });
    expect(await repository.readConflicts(userB)).toEqual([]);

    await repository.resolveConflict(userA, conflict.id, 'cloud');
    expect(await repository.getLocalRecord(userA, 'transaction', localId)).toMatchObject({
      amount: '1200',
      memo: 'Cloud edit',
    });
    expect(await repository.readConflicts(userA)).toEqual([]);
    expect((await repository.listOutbox(userA)).map((entry) => entry.status).sort()).toEqual([
      'synced',
      'synced',
    ]);
  });

  it('clears only the selected user’s local records and queued work', async () => {
    await repository.commitLocalWrite(
      userA,
      'transaction',
      'transaction.create',
      { id: 'txn-a', amount: '5' },
      {},
      { clientMutationId: 'mutation-a' },
    );
    await repository.commitLocalWrite(
      userB,
      'transaction',
      'transaction.create',
      { id: 'txn-b', amount: '9' },
      {},
      { clientMutationId: 'mutation-b' },
    );
    const accountA = await repository.commitLocalWrite(
      userA,
      'account',
      'account.create',
      { id: 'account-a', name: 'A' },
      {},
      { clientMutationId: 'account-mutation-a' },
    );
    await repository.markSynced(userA, 'local-account-mutation-a', 'account', accountA, {
      serverId: 'cloud-account-a',
      revision: '1',
      updatedAt: 10,
    });
    const accountB = await repository.commitLocalWrite(
      userB,
      'account',
      'account.create',
      { id: 'account-b', name: 'B' },
      {},
      { clientMutationId: 'account-mutation-b' },
    );
    await repository.markSynced(userB, 'local-account-mutation-b', 'account', accountB, {
      serverId: 'cloud-account-b',
      revision: '2',
      updatedAt: 20,
    });

    await repository.clearLocalData(userA);

    expect(await repository.readLocal(userA, 'transaction')).toEqual([]);
    expect(await repository.listOutbox(userA)).toEqual([]);
    expect(await repository.readLocal(userB, 'transaction')).toMatchObject([
      { id: 'txn-b', amount: '9' },
    ]);
    expect((await repository.listOutbox(userB)).map((entry) => entry.status).sort()).toEqual([
      'pending',
      'synced',
    ]);
    expect(await repository.getMappedCloudId(userA, 'account', accountA)).toBeNull();
    expect(await repository.getMappedCloudId(userB, 'account', accountB)).toBe('cloud-account-b');
  });

  it('upgrades a version-one database without losing user data', async () => {
    const request = indexedDB.open(WEB_DATABASE_NAME, 1);
    const oldDatabase = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const db = request.result;
        const records = db.createObjectStore('records', { keyPath: 'key' });
        records.createIndex('by-user-entity', ['userId', 'entityType']);
        records.createIndex('by-user-cloud', ['userId', 'entityType', 'cloudId']);
        records.put({
          key: `${userA}\u0000account\u0000account-v1`,
          userId: userA,
          entityType: 'account',
          id: 'account-v1',
          updatedAt: 3,
          record: { id: 'account-v1', name: 'Kept through upgrade' },
        });
        const outbox = db.createObjectStore('outbox', { keyPath: 'localId' });
        outbox.createIndex('by-user-created', ['userId', 'createdAt', 'localId']);
        outbox.createIndex('by-user-status', ['userId', 'status']);
        const mappings = db.createObjectStore('idMappings', { keyPath: 'key' });
        mappings.createIndex('by-user-entity-local', ['userId', 'entityType', 'localId'], {
          unique: true,
        });
        mappings.createIndex('by-user-entity-cloud', ['userId', 'entityType', 'cloudId'], {
          unique: true,
        });
        db.createObjectStore('syncState', { keyPath: 'userId' });
        const conflicts = db.createObjectStore('conflicts', { keyPath: 'conflictId' });
        conflicts.createIndex('by-user', 'userId');
        conflicts.createIndex('by-user-open', ['userId', 'resolvedAt']);
        conflicts.put({ conflictId: 'account:old-conflict', userId: userA, resolvedAt: null });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('DATABASE_SEED_FAILED'));
    });
    oldDatabase.close();

    expect(await repository.readLocal(userA, 'account')).toMatchObject([
      { id: 'account-v1', name: 'Kept through upgrade' },
    ]);
    const upgraded = await openWebDatabase();
    expect(upgraded.version).toBe(2);
    expect(
      Array.from(upgraded.transaction('conflicts').objectStore('conflicts').indexNames),
    ).toEqual(['by-user']);
  });
});
