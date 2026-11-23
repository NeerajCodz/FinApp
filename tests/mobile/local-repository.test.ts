import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-crypto', () => {
  let sequence = 0;
  return {
    randomUUID: vi.fn(() => {
      sequence += 1;
      return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`;
    }),
    getRandomBytesAsync: async (byteCount: number) => new Uint8Array(byteCount).fill(1),
  };
});
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
import * as Crypto from 'expo-crypto';
import * as repo from '../../apps/mobile/local/repository';
import { commitLocalWrite } from '../../apps/mobile/local/commands';
import { createOutboxEntry } from '../../apps/mobile/local/outbox/queue';
import { syncOutbox } from '../../apps/mobile/local/sync/engine';
import { deserializeLocalValue } from '../../apps/mobile/local/serialization';
import { projectGroupBalances } from '../../convex/splits/domain';
import {
  planExpenseDelete,
  planExpenseUpdate,
  planSettlementRemoval,
  type QueuedWritePlan,
} from '../../packages/ui/src/finance/groupExpenseOutbox';
vi.mock('expo-constants', () => ({
  default: {
    appOwnership: null,
    executionEnvironment: 'standalone',
    expoConfig: {
      owner: 'neerajcodz',
      slug: 'finapp',
      extra: { eas: { projectId: 'project-test' } },
    },
  },
}));
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
  it('retries a colliding generated record UUID without replacing the existing record', async () => {
    const userId = 'user-id-collision';
    const collisionId = '00000000-0000-4000-8000-000000000010';
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'account',
      { id: collisionId, name: 'Original', type: 'cash', currency: 'INR' },
      createOutboxEntry('account.create', { name: 'Original' }, 'existing-account-mutation'),
    );

    const selectedId = '00000000-0000-4000-8000-000000000020';
    vi.mocked(Crypto.randomUUID)
      .mockImplementationOnce(() => '00000000-0000-4000-8000-000000000011')
      .mockImplementationOnce(() => collisionId)
      .mockImplementationOnce(() => '90000000-0000-4000-8000-000000000012')
      .mockImplementationOnce(() => selectedId)
      .mockImplementationOnce(() => '90000000-0000-4000-8000-000000000013');

    const actualId = await commitLocalWrite(
      userId,
      'account',
      'account.create',
      { name: 'New account', type: 'cash', currency: 'INR' },
      { name: 'New account', type: 'cash', currency: 'INR' },
    );

    expect(actualId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(actualId).toBe(selectedId);
    expect(await repo.readLocal(userId, 'account')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: collisionId, name: 'Original' }),
        expect.objectContaining({ id: selectedId, clientId: selectedId, name: 'New account' }),
      ]),
    );
    const newEntry = (await repo.listOutbox(userId)).find(
      (entry) =>
        entry.operation === 'account.create' &&
        entry.clientMutationId !== 'existing-account-mutation',
    );
    expect(newEntry?.localId).not.toMatch(/^local-/);
    expect(newEntry?.clientMutationId).not.toBe(selectedId);
    expect(JSON.parse(newEntry?.payload ?? '{}')).toMatchObject({ clientId: selectedId });
  });

  it('uses a cloud record clientId as its local ID when no device mapping exists', async () => {
    const userId = 'user-client-id-read';
    const clientId = '00000000-0000-4000-8000-000000000030';
    await repo.applyCloudChanges(
      userId,
      [
        {
          entityType: 'account',
          documentId: 'cloud-account-client-id',
          revision: '1',
          updatedAt: 100,
          document: {
            _id: 'cloud-account-client-id',
            clientId,
            name: 'Synced account',
            type: 'cash',
            currency: 'INR',
          },
        },
      ],
      'cursor-1',
    );

    expect(await repo.readLocal(userId, 'account')).toMatchObject([
      { id: clientId, _id: 'cloud-account-client-id', cloudId: 'cloud-account-client-id' },
    ]);
    const pageUserId = 'user-client-id-page';
    await repo.upsertCloudPage(pageUserId, 'account', [
      {
        _id: 'cloud-account-page',
        clientId,
        name: 'Synced page account',
        type: 'cash',
        currency: 'INR',
      },
    ]);
    expect(await repo.readLocal(pageUserId, 'account')).toMatchObject([
      { id: clientId, _id: 'cloud-account-page', cloudId: 'cloud-account-page' },
    ]);
  });
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

  it('reconciles split rows received before the transaction ID mapping exists', async () => {
    const userId = 'user-split-mapping';
    const payer = {
      _id: 'cloud-payer',
      transactionId: 'cloud-expense',
      userId: 'alice',
      amountMinor: 100n,
    };
    const shares = [
      { _id: 'cloud-alice', transactionId: 'cloud-expense', userId: 'alice', amountMinor: 40n },
      { _id: 'cloud-bob', transactionId: 'cloud-expense', userId: 'bob', amountMinor: 60n },
    ];
    await repo.upsertCloudPage(userId, 'expensePayer', [payer]);
    await repo.upsertCloudPage(userId, 'expenseParticipant', shares);
    const entry = createOutboxEntry('group.addExpense', {}, 'split-map', {
      entityType: 'transaction',
      recordId: 'local-expense',
    });
    await repo.applyLocalMutationAndEnqueue(
      userId,
      'transaction',
      {
        id: 'local-expense',
        accountId: 'account',
        groupId: 'group',
        amountMinor: 100n,
        occurredAt: 1,
        status: 'posted',
      },
      entry,
    );
    await repo.markSynced(userId, entry.localId, 'transaction', 'local-expense', {
      serverId: 'cloud-expense',
      revision: '1',
      updatedAt: 2,
    });
    await repo.upsertCloudPage(userId, 'expensePayer', [payer]);
    await repo.upsertCloudPage(userId, 'expenseParticipant', shares);
    expect(await repo.readLocal(userId, 'expensePayer')).toMatchObject([
      { transactionId: 'local-expense', userId: 'alice', amountMinor: 100n },
    ]);
    expect(await repo.readLocal(userId, 'expenseParticipant')).toHaveLength(2);
    expect(await repo.readLocal(userId, 'expenseParticipant')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transactionId: 'local-expense',
          userId: 'alice',
          amountMinor: 40n,
        }),
        expect.objectContaining({
          transactionId: 'local-expense',
          userId: 'bob',
          amountMinor: 60n,
        }),
      ]),
    );
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

  it('queues group expense edits, deletes and payment undos with optimistic balances', async () => {
    const userId = 'user-expense-edit';
    const group = { _id: 'cloud-group', currency: 'USD' };
    await repo.upsertCloudPage(userId, 'transaction', [
      {
        _id: 'cloud-dinner',
        groupId: 'cloud-group',
        accountId: 'cloud-account',
        ownerId: userId,
        title: 'Dinner',
        amountMinor: 100n,
        currency: 'USD',
        type: 'expense',
        status: 'posted',
        occurredAt: 1,
        version: 2,
      },
    ]);
    await repo.upsertCloudPage(userId, 'expensePayer', [
      { _id: 'payer-alice', transactionId: 'cloud-dinner', userId: 'alice', amountMinor: 100n },
    ]);
    await repo.upsertCloudPage(userId, 'expenseParticipant', [
      { _id: 'part-alice', transactionId: 'cloud-dinner', userId: 'alice', amountMinor: 50n },
      { _id: 'part-bob', transactionId: 'cloud-dinner', userId: 'bob', amountMinor: 50n },
    ]);
    await repo.upsertCloudPage(userId, 'settlement', [
      {
        _id: 'cloud-payment',
        groupId: 'cloud-group',
        fromUserId: 'bob',
        toUserId: 'alice',
        amountMinor: 50n,
        currency: 'USD',
        occurredAt: 2,
      },
    ]);
    const commit = (plan: QueuedWritePlan, clientMutationId: string) =>
      commitLocalWrite(userId, plan.entityType, plan.operation, plan.record, plan.payload, {
        recordId: plan.recordId,
        clientMutationId,
        deviceId: 'device-test',
        dependencies: plan.dependencies,
        relatedRecords: plan.relatedRecords,
        removedRecords: plan.removedRecords,
      });
    const balances = async () =>
      projectGroupBalances(
        group,
        await repo.readLocal(userId, 'transaction'),
        await repo.readLocal(userId, 'expensePayer'),
        await repo.readLocal(userId, 'expenseParticipant'),
        await repo.readLocal(userId, 'settlement'),
      ).balances;
    expect(await balances()).toEqual({ alice: 0n, bob: 0n });

    const [transaction] = await repo.readLocal(userId, 'transaction');
    await commit(
      planExpenseUpdate({
        transaction: transaction!,
        payerRows: await repo.readLocal(userId, 'expensePayer'),
        participantRows: await repo.readLocal(userId, 'expenseParticipant'),
        title: 'Dinner',
        amountMinor: 90n,
        currency: 'USD',
        occurredAt: 1,
        participants: [
          { userId: 'alice', amountMinor: 30n, method: 'equal' },
          { userId: 'carol', amountMinor: 30n, method: 'equal' },
          { userId: 'dave', amountMinor: 30n, method: 'equal' },
        ],
        payers: [{ userId: 'alice', amountMinor: 90n }],
      }),
      'edit-dinner',
    );
    expect(await balances()).toEqual({ alice: 10n, bob: 50n, carol: -30n, dave: -30n });
    const participants = await repo.readLocal(userId, 'expenseParticipant');
    expect(participants.map((row) => row.userId).sort()).toEqual(['alice', 'carol', 'dave']);
    const [edit] = await repo.listOutbox(userId);
    expect(edit?.operation).toBe('group.updateExpense');
    expect(deserializeLocalValue<Record<string, unknown>>(edit!.payload)).toMatchObject({
      transactionId: 'cloud-dinner',
      expectedVersion: 2,
    });

    const [edited] = await repo.readLocal(userId, 'transaction');
    expect(edited).toMatchObject({ version: 3 });
    await commit(planExpenseDelete(edited!, userId, 5), 'delete-dinner');
    expect(await balances()).toEqual({ alice: -50n, bob: 50n });
    const [payment] = await repo.readLocal(userId, 'settlement');
    await commit(planSettlementRemoval(payment!, userId), 'undo-payment');
    expect(await balances()).toEqual({});

    // A rejected edit is stored with a readable reason instead of the raw Convex error.
    const results = await syncOutbox(userId, await repo.listOutbox(userId), async () => {
      throw new Error(
        '[CONVEX M(groups/mutations:updateExpense)] Server Error Uncaught Error: INSUFFICIENT_PERMISSION',
      );
    });
    expect(results[0]?.status).toBe('failed');
    const failed = (await repo.listOutbox(userId)).find(
      (entry) => entry.operation === 'group.updateExpense',
    );
    expect(failed?.lastError).toBe('You no longer have permission to make this change.');
  });
});
