import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (byteCount: number) => new Uint8Array(byteCount).fill(1),
}));
vi.mock('expo-file-system', () => ({
  File: class {
    constructor(_uri: string) {}
    get exists() {
      return false;
    }
    delete() {}
    async move(_destination: unknown) {}
  },
}));
import * as repo from '../../apps/mobile/local/repository';
import { createOutboxEntry } from '../../apps/mobile/local/outbox/queue';
import { syncOutbox } from '../../apps/mobile/local/sync/engine';
import { deserializeLocalValue } from '../../apps/mobile/local/serialization';
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => 'test-key',
  setItemAsync: async () => undefined,
}));
vi.mock('expo-sqlite', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const native = new DatabaseSync(':memory:');
  let keyApplied = false;
  const db = {
    databasePath: 'memory://finapp.db',
    execSync(source: string) {
      if (/^\s*PRAGMA\s+key\b/i.test(source)) {
        keyApplied = true;
        return;
      }
      if (/^\s*PRAGMA\s+rekey\b/i.test(source)) return;
      native.exec(source);
    },
    runSync(source: string, ...params: unknown[]) {
      return native.prepare(source).run(...(params as never[]));
    },
    getFirstSync<T>(source: string, ...params: unknown[]): T | null {
      if (/^\s*SELECT\s+name\s+FROM\s+sqlite_master/i.test(source) && !keyApplied) {
        throw new Error('SQLITE_NOTADB');
      }
      if (/^\s*PRAGMA\s+cipher_version/i.test(source)) return { cipher_version: 'mock' } as T;
      if (/^\s*PRAGMA\s+user_version/i.test(source) && !keyApplied) {
        throw new Error('SQLITE_NOTADB');
      }
      return (native.prepare(source).get(...(params as never[])) as T | undefined) ?? null;
    },
    getAllSync<T>(source: string, ...params: unknown[]): T[] {
      return native.prepare(source).all(...(params as never[])) as T[];
    },
    withTransactionSync(task: () => void) {
      native.exec('BEGIN');
      try {
        task();
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { defaultDatabaseDirectory: 'memory://', openDatabaseAsync: async () => db };
});

describe('local financial repository', () => {
  it('commits the optimistic transaction and durable outbox before cloud acknowledgement', async () => {
    const userId = 'user-1';
    const entry = createOutboxEntry(
      'transaction.create',
      { title: 'Lunch', amountMinor: 123n },
      'mutation-1',
    );
    let observed = 0;
    const unsubscribe = repo.subscribeLocalData(userId, () => observed++);
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'transaction',
      {
        id: 'local-transaction-1',
        title: 'Lunch',
        accountId: 'account-1',
        occurredAt: 100,
        amountMinor: 123n,
        status: 'posted',
      },
      entry,
    );

    const pending = await repo.listOutbox(userId);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe('pending');
    expect(await repo.readTransactionRange(userId, 0, 200)).toMatchObject([
      { id: 'local-transaction-1', amountMinor: 123n, title: 'Lunch' },
    ]);
    expect(observed).toBe(1);

    let acknowledge!: (value: { serverId: string; revision: string; updatedAt: number }) => void;
    let started!: () => void;
    const sending = new Promise<{ serverId: string; revision: string; updatedAt: number }>(
      (resolve) => {
        acknowledge = resolve;
      },
    );
    const dispatchStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const flush = syncOutbox(userId, pending, async () => {
      started();
      return sending;
    });
    await dispatchStarted;
    expect(await repo.readTransactionRange(userId, 0, 200)).toHaveLength(1);
    expect((await repo.listOutbox(userId))[0]?.status).toBe('syncing');
    acknowledge({ serverId: 'cloud-transaction-1', revision: '1', updatedAt: 101 });
    await flush;
    expect((await repo.listOutbox(userId))[0]?.status).toBe('synced');
    expect(await repo.getMappedCloudId(userId, 'transaction', 'local-transaction-1')).toBe(
      'cloud-transaction-1',
    );
    unsubscribe();
  });

  it('isolates queued work between authenticated user namespaces', async () => {
    await repo.applyLocalMutationAndEnqueue(
      'user-2',
      'transaction',
      {
        id: 'local-private',
        title: 'Private',
        accountId: 'account-2',
        occurredAt: 100,
        amountMinor: 900n,
        status: 'posted',
      },
      createOutboxEntry('transaction.create', { title: 'Private' }, 'mutation-user-2'),
    );
    expect(await repo.readTransactionRange('user-1', 0, 200)).toMatchObject([
      { id: 'local-transaction-1' },
    ]);
    expect(await repo.readTransactionRange('user-2', 0, 200)).toMatchObject([
      { id: 'local-private' },
    ]);
    expect(await repo.listOutbox('user-1')).toHaveLength(1);
    expect(await repo.listOutbox('user-2')).toHaveLength(1);
  });
  it('waits for parent ID mappings and rewrites dependent operation payloads', async () => {
    const userId = 'user-dependencies';
    const parent = createOutboxEntry('account.create', { name: 'Wallet' }, 'parent-mutation');
    const child = createOutboxEntry(
      'transaction.create',
      { title: 'Lunch', accountId: 'local-account', amountMinor: 50n },
      'child-mutation',
      { dependencies: ['account:local-account'] },
    );
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'account',
      {
        id: 'local-account',
        name: 'Wallet',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
      },
      parent,
    );
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'transaction',
      {
        id: 'local-child',
        title: 'Lunch',
        accountId: 'local-account',
        occurredAt: 10,
        amountMinor: 50n,
        status: 'posted',
      },
      child,
    );
    const sent: { operation: string; accountId?: string }[] = [];
    await syncOutbox(userId, await repo.listOutbox(userId), async (entry) => {
      const payload = JSON.parse(entry.payload) as { accountId?: string };
      sent.push({ operation: entry.operation, accountId: payload.accountId });
      return {
        serverId: entry.operation === 'account.create' ? 'cloud-account' : 'cloud-transaction',
        revision: String(sent.length),
        updatedAt: 20 + sent.length,
      };
    });
    expect(sent).toEqual([
      { operation: 'account.create', accountId: undefined },
      { operation: 'transaction.create', accountId: 'cloud-account' },
    ]);
    expect((await repo.listOutbox(userId)).every((entry) => entry.status === 'synced')).toBe(true);
  });

  it('reuses optimistic IDs when historical cloud pages return synced entities', async () => {
    const userId = 'user-range-mapping';
    const categoryEntry = createOutboxEntry(
      'category.create',
      { name: 'Travel' },
      'category-range',
      { entityType: 'category', recordId: 'local-category' },
    );
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'category',
      {
        id: 'local-category',
        ownerId: userId,
        name: 'Travel',
        isSystem: false,
        sortOrder: 1,
      },
      categoryEntry,
    );
    await repo.markSynced(userId, categoryEntry.localId, 'category', 'local-category', {
      serverId: 'cloud-category',
      revision: '1',
      updatedAt: 2,
    });
    await repo.upsertCloudPage(userId, 'category', [
      { _id: 'cloud-category', ownerId: userId, name: 'Travel', isSystem: false, sortOrder: 1 },
    ]);

    const transactionEntry = createOutboxEntry(
      'transaction.create',
      { title: 'Train', categoryId: 'local-category' },
      'transaction-range',
      { entityType: 'transaction', recordId: 'local-transaction' },
    );
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'transaction',
      {
        id: 'local-transaction',
        accountId: 'cloud-account',
        categoryId: 'local-category',
        title: 'Train',
        amountMinor: 999n,
        occurredAt: 10,
        status: 'posted',
      },
      transactionEntry,
    );
    await repo.markSynced(userId, transactionEntry.localId, 'transaction', 'local-transaction', {
      serverId: 'cloud-transaction',
      revision: '2',
      updatedAt: 3,
    });
    await repo.upsertCloudPage(userId, 'transaction', [
      {
        _id: 'cloud-transaction',
        ownerId: userId,
        accountId: 'cloud-account',
        categoryId: 'cloud-category',
        title: 'Train',
        amountMinor: 999n,
        occurredAt: 10,
        status: 'posted',
      },
    ]);

    expect(await repo.readLocal(userId, 'category')).toMatchObject([
      { id: 'local-category', cloudId: 'cloud-category', name: 'Travel' },
    ]);
    expect(await repo.readTransactionRange(userId, 0, 20)).toMatchObject([
      {
        id: 'local-transaction',
        cloudId: 'cloud-transaction',
        categoryId: 'local-category',
        title: 'Train',
      },
    ]);
  });

  it('retains conflicting versions and lets explicit resolution select a winner', async () => {
    const userId = 'user-conflict';
    const entry = createOutboxEntry(
      'transaction.create',
      { title: 'Local edit' },
      'conflict-mutation',
    );
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'transaction',
      {
        id: 'local-conflict-tx',
        title: 'Local edit',
        accountId: 'account-3',
        occurredAt: 100,
        amountMinor: 100n,
        status: 'posted',
      },
      entry,
    );
    await repo.markSynced(userId, entry.localId, 'transaction', 'local-conflict-tx', {
      serverId: 'cloud-conflict-tx',
      revision: '1',
      updatedAt: entry.createdAt,
    });
    await repo.applyCloudChanges(
      userId,
      [
        {
          entityType: 'transaction',
          documentId: 'cloud-conflict-tx',
          revision: 2n,
          updatedAt: entry.createdAt - 1,
          document: {
            _id: 'cloud-conflict-tx',
            title: 'Cloud edit',
            accountId: 'account-3',
            occurredAt: 100,
            amountMinor: 200n,
            status: 'posted',
          },
        },
      ],
      'cursor-2',
    );
    expect(await repo.readTransactionRange(userId, 0, 200)).toMatchObject([
      { id: 'local-conflict-tx', title: 'Local edit', amountMinor: 100n },
    ]);
    const conflicts = await repo.readConflicts(userId);
    expect(conflicts).toMatchObject([
      {
        recordId: 'local-conflict-tx',
        localRecord: { title: 'Local edit', amountMinor: 100n },
        cloudRecord: { title: 'Cloud edit', amountMinor: 200n },
        resolvedAt: null,
      },
    ]);
    expect((await repo.listOutbox(userId))[0]?.status).toBe('conflict');
    await repo.resolveConflict(userId, conflicts[0]!.id, 'cloud');
    expect(await repo.readTransactionRange(userId, 0, 200)).toMatchObject([
      { id: 'local-conflict-tx', title: 'Cloud edit', amountMinor: 200n },
    ]);
    expect((await repo.readConflicts(userId))[0]?.resolvedAt).not.toBeNull();
  });

  it('caches historical ranges and never deletes them when the bootstrap window changes', async () => {
    const userId = 'user-history';
    await repo.upsertCloudPage(userId, 'transaction', [
      {
        _id: 'cloud-old-tx',
        title: 'Old history',
        accountId: 'cloud-account',
        occurredAt: 1,
        amountMinor: 500n,
        status: 'posted',
      },
    ]);
    await repo.recordCoverage(userId, 'transactions', 0, 10);
    expect(await repo.isRangeCovered(userId, 'transactions', 2, 9)).toBe(true);
    expect(await repo.readTransactionRange(userId, 0, 10)).toMatchObject([
      { title: 'Old history', amountMinor: 500n },
    ]);
    await repo.setSyncWindow(userId, 7);
    expect(await repo.getSyncWindow(userId)).toBe(7);
    const backfill = (await repo.listOutbox(userId)).find(
      (entry) => entry.operation === 'sync.bootstrap',
    );
    expect(backfill?.status).toBe('pending');
    expect(
      backfill ? deserializeLocalValue<{ days: number }>(backfill.payload) : undefined,
    ).toEqual({ days: 7 });
    expect(await repo.readTransactionRange(userId, 0, 10)).toMatchObject([
      { title: 'Old history', amountMinor: 500n },
    ]);
  });

  it('backs off transient network failures but leaves server rejections for manual retry', async () => {
    const userId = 'user-retry-policy';
    const makePending = async (id: string) => {
      const entry = createOutboxEntry(
        'transaction.create',
        { title: id, amountMinor: 1n },
        `mutation-${id}`,
        { entityType: 'transaction', recordId: `local-${id}` },
      );
      await repo.applyLocalMutationAndEnqueue(
        userId,
        'transaction',
        { id: `local-${id}`, title: id, occurredAt: 1, amountMinor: 1n },
        entry,
      );
      return entry;
    };
    const transient = await makePending('transient');
    await syncOutbox(userId, [transient], async () => {
      throw new Error('Network request failed');
    });
    const [transientState] = await repo.listOutbox(userId);
    expect(transientState?.status).toBe('failed');
    expect(transientState?.nextRetryAt).toBeGreaterThan(Date.now());

    const rejected = await makePending('rejected');
    await syncOutbox(userId, [rejected], async () => {
      throw Object.assign(new Error('INVALID_AMOUNT'), { data: { code: 'INVALID_AMOUNT' } });
    });
    const rejectedState = (await repo.listOutbox(userId)).find(
      (entry) => entry.localId === rejected.localId,
    );
    expect(rejectedState?.status).toBe('failed');
    expect(rejectedState?.nextRetryAt).toBeUndefined();
    await repo.retryFailedEntry(userId, rejected.localId);
    const manuallyRetried = (await repo.listOutbox(userId)).find(
      (entry) => entry.localId === rejected.localId,
    );
    expect(manuallyRetried?.status).toBe('pending');
    expect(manuallyRetried?.nextRetryAt).toBeUndefined();
    expect(manuallyRetried?.lastError).toBeUndefined();
    expect(
      (await repo.listOutbox(userId)).find((entry) => entry.localId === transient.localId)?.status,
    ).toBe('failed');
  });

  it('keeps cloud group references addressable by their stable local route ID', async () => {
    const userId = 'user-group-mapping';
    const groupWrite = createOutboxEntry('group.create', { name: 'Trip' }, 'mutation-group-map', {
      entityType: 'group',
      recordId: 'local-group-map',
    });
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'group',
      { id: 'local-group-map', name: 'Trip', currency: 'INR' },
      groupWrite,
    );
    await repo.markSynced(userId, groupWrite.localId, 'group', 'local-group-map', {
      serverId: 'cloud-group-map',
      revision: '1',
      updatedAt: 10,
    });
    await repo.upsertCloudPage(userId, 'transaction', [
      {
        _id: 'cloud-expense-map',
        groupId: 'cloud-group-map',
        title: 'Dinner',
        amountMinor: 2500n,
        currency: 'INR',
        status: 'posted',
        occurredAt: 20,
      },
    ]);

    expect(await repo.readGroupRange(userId, 'local-group-map', 0, 30)).toMatchObject({
      transactions: [{ groupId: 'local-group-map', title: 'Dinner' }],
    });
  });
});
