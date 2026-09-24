import { describe, expect, it, vi } from 'vitest';
import * as repo from '../../app/mobile/local/repository';
import { createOutboxEntry } from '../../app/mobile/local/outbox/queue';
import { syncOutbox } from '../../app/mobile/local/sync/engine';
vi.mock('expo-secure-store', () => ({
  getItemAsync: async () => 'test-key',
  setItemAsync: async () => undefined,
}));
vi.mock('expo-sqlite', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const native = new DatabaseSync(':memory:');
  const db = {
    execSync(source: string) {
      if (/^\s*PRAGMA\s+(key|rekey)\b/i.test(source)) return;
      native.exec(source);
    },
    runSync(source: string, ...params: unknown[]) {
      return native.prepare(source).run(...(params as never[]));
    },
    getFirstSync<T>(source: string, ...params: unknown[]): T | null {
      if (/^\s*PRAGMA\s+cipher_version/i.test(source)) return { cipher_version: 'mock' } as T;
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
  return { openDatabaseAsync: async () => db };
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
    expect(await repo.readTransactionRange(userId, 0, 10)).toMatchObject([
      { title: 'Old history', amountMinor: 500n },
    ]);
  });
});
