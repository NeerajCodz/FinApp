import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';

const modules = import.meta.glob('../../convex/**/*.ts');
const DAY = 86_400_000;

afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  const make = async (key: string) => {
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: key,
        email: `${key}@example.com`,
        emailVerificationTime: 1,
        displayName: key,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert('userSettings', {
        userId,
        currency: 'INR',
        timezone: 'UTC',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: defaultNotificationPreferences,
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        updatedAt: 1,
      }),
    );
    return { userId, as: t.withIdentity({ subject: key, email: `${key}@example.com`, name: key }) };
  };
  const owner = await make('owner');
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const accountId = await ctx.db.insert('accounts', {
      ownerId: owner.userId,
      name: 'Wallet',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
      createdAt: now,
      updatedAt: now,
    });
    const categoryId = await ctx.db.insert('categories', {
      ownerId: owner.userId,
      name: 'Food',
      kind: 'expense',
      isSystem: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    const tx = (title: string) =>
      ctx.db.insert('transactions', {
        ownerId: owner.userId,
        accountId,
        type: 'expense',
        amountMinor: 10_000n,
        currency: 'INR',
        categoryId: String(categoryId),
        title,
        occurredAt: now,
        status: 'posted',
        createdAt: now,
        updatedAt: now,
      });
    return { accountId, categoryId, lunch: await tx('Lunch'), dinner: await tx('Dinner') };
  });
  return { t, owner, make, ids };
}

describe('Trash', () => {
  it('lists a deleted transaction and restores it', async () => {
    const { owner, ids } = await setup();
    await owner.as.mutation(api.transactions.mutations.softDelete, {
      transactionId: ids.lunch,
      clientMutationId: 'del-1',
    });
    const listed = await owner.as.query(api.trash.list, {});
    expect(listed.retentionDays).toBe(30);
    expect(listed.items).toEqual([
      expect.objectContaining({ kind: 'transaction', id: String(ids.lunch), title: 'Lunch' }),
    ]);
    expect(listed.items[0]!.purgeAt).toBe(listed.items[0]!.deletedAt + 30 * DAY);
    await owner.as.mutation(api.trash.restore, { kind: 'transaction', id: String(ids.lunch) });
    expect((await owner.as.query(api.trash.list, {})).items).toHaveLength(0);
  });

  it('deletes a category with its transactions and restores them together', async () => {
    const { t, owner, ids } = await setup();
    await owner.as.mutation(api.categories.mutations.archive, {
      categoryId: ids.categoryId,
      deleteTransactions: true,
    });
    const kinds = (await owner.as.query(api.trash.list, {})).items.map((item) => item.kind).sort();
    expect(kinds).toEqual(['category', 'transaction', 'transaction']);
    const restored = await owner.as.mutation(api.trash.restore, {
      kind: 'category',
      id: String(ids.categoryId),
    });
    expect(restored.restored).toBe(3);
    const rows = await t.run((ctx) => ctx.db.query('transactions').collect());
    expect(rows.every((row) => row.deletedAt === undefined && row.trashedWith === undefined)).toBe(
      true,
    );
  });

  it('keeps transactions when a category is deleted without them', async () => {
    const { owner, ids } = await setup();
    await owner.as.mutation(api.categories.mutations.archive, { categoryId: ids.categoryId });
    const items = (await owner.as.query(api.trash.list, {})).items;
    expect(items.map((item) => item.kind)).toEqual(['category']);
  });

  it('refuses to restore a transaction whose account is in Trash', async () => {
    const { t, owner, ids } = await setup();
    await owner.as.mutation(api.transactions.mutations.softDelete, {
      transactionId: ids.lunch,
      clientMutationId: 'del-2',
    });
    await t.run((ctx) => ctx.db.patch(ids.accountId, { archivedAt: Date.now() }));
    await expect(
      owner.as.mutation(api.trash.restore, { kind: 'transaction', id: String(ids.lunch) }),
    ).rejects.toThrow('ACCOUNT_IN_TRASH');
  });

  it('purging an account deletes its transactions too', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    await t.run((ctx) => ctx.db.patch(ids.accountId, { archivedAt: Date.now() }));
    await owner.as.mutation(api.trash.purge, { kind: 'account', id: String(ids.accountId) });
    await expect(
      owner.as.mutation(api.trash.restore, { kind: 'account', id: String(ids.accountId) }),
    ).rejects.toThrow('PURGE_IN_PROGRESS');
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(await t.run((ctx) => ctx.db.query('transactions').collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.get(ids.accountId))).toBeNull();
  });

  it('only owners can restore or purge', async () => {
    const { owner, make, ids } = await setup();
    const other = await make('other');
    await owner.as.mutation(api.transactions.mutations.softDelete, {
      transactionId: ids.lunch,
      clientMutationId: 'del-3',
    });
    await expect(
      other.as.mutation(api.trash.restore, { kind: 'transaction', id: String(ids.lunch) }),
    ).rejects.toThrow('NOT_FOUND');
    expect(
      (await other.as.mutation(api.trash.purge, { kind: 'transaction', id: String(ids.lunch) }))
        .purged,
    ).toBe(0);
  });

  it('purges expired items daily according to retention', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    await owner.as.mutation(api.trash.setRetention, { days: 7 });
    await owner.as.mutation(api.transactions.mutations.softDelete, {
      transactionId: ids.lunch,
      clientMutationId: 'del-4',
    });
    vi.advanceTimersByTime(3 * DAY);
    await t.mutation(internal.trash.purgeExpired, {});
    expect(await t.run((ctx) => ctx.db.get(ids.lunch))).not.toBeNull();
    vi.advanceTimersByTime(5 * DAY);
    await t.mutation(internal.trash.purgeExpired, {});
    expect(await t.run((ctx) => ctx.db.get(ids.lunch))).toBeNull();
  });

  it('never purges when retention is "never", and empties on request', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    await owner.as.mutation(api.trash.setRetention, { days: 0 });
    await owner.as.mutation(api.transactions.mutations.softDelete, {
      transactionId: ids.lunch,
      clientMutationId: 'del-5',
    });
    vi.advanceTimersByTime(400 * DAY);
    await t.mutation(internal.trash.purgeExpired, {});
    expect(await t.run((ctx) => ctx.db.get(ids.lunch))).not.toBeNull();
    expect(await owner.as.mutation(api.trash.empty, {})).toEqual({ purged: 1, more: false });
  });

  it('moves a recurring rule to Trash and restores its enabled state', async () => {
    const { t, owner } = await setup();
    const ruleId = await t.run((ctx) =>
      ctx.db.insert('recurringRules', {
        ownerId: owner.userId,
        name: 'Rent',
        template: {},
        frequency: 'monthly',
        interval: 1,
        nextOccurrence: Date.now() + DAY,
        autoCreate: true,
        reminderSettings: {},
        enabled: true,
        createdAt: 1,
        updatedAt: 1,
      }),
    );
    await owner.as.mutation(api.recurring.mutations.remove, { ruleId, clientMutationId: 'rr-1' });
    expect((await t.run((ctx) => ctx.db.get(ruleId)))?.enabled).toBe(false);
    await owner.as.mutation(api.trash.restore, { kind: 'recurring', id: String(ruleId) });
    const restored = await t.run((ctx) => ctx.db.get(ruleId));
    expect(restored?.enabled).toBe(true);
    expect(restored?.archivedAt).toBeUndefined();
  });

  it('pages category transaction trashing and companion restores', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 55; index++)
        await ctx.db.insert('transactions', {
          ownerId: owner.userId,
          accountId: ids.accountId,
          type: 'expense',
          amountMinor: 100n,
          currency: 'INR',
          categoryId: String(ids.categoryId),
          title: `Extra ${index}`,
          occurredAt: now + index,
          status: 'posted',
          createdAt: now,
          updatedAt: now,
        });
    });
    await owner.as.mutation(api.categories.mutations.archive, {
      categoryId: ids.categoryId,
      deleteTransactions: true,
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const trashed = await t.run((ctx) =>
      ctx.db
        .query('transactions')
        .withIndex('by_owner_category_occurredAt', (q) =>
          q.eq('ownerId', owner.userId).eq('categoryId', String(ids.categoryId)),
        )
        .collect(),
    );
    expect(trashed).toHaveLength(57);
    expect(trashed.every((row) => row.deletedAt !== undefined)).toBe(true);

    await owner.as.mutation(api.trash.restore, {
      kind: 'category',
      id: String(ids.categoryId),
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const restored = await t.run((ctx) =>
      ctx.db
        .query('transactions')
        .withIndex('by_owner_category_occurredAt', (q) =>
          q.eq('ownerId', owner.userId).eq('categoryId', String(ids.categoryId)),
        )
        .collect(),
    );
    expect(restored.every((row) => row.deletedAt === undefined)).toBe(true);
  });

  it('ignores delayed category transaction work from an earlier archive generation', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    const firstArchiveAt = Date.UTC(2026, 1, 1);
    vi.setSystemTime(firstArchiveAt);
    await owner.as.mutation(api.categories.mutations.archive, {
      categoryId: ids.categoryId,
      deleteTransactions: true,
    });
    await owner.as.mutation(api.trash.restore, {
      kind: 'category',
      id: String(ids.categoryId),
    });
    vi.setSystemTime(firstArchiveAt + 1_000);
    await owner.as.mutation(api.categories.mutations.archive, {
      categoryId: ids.categoryId,
      deleteTransactions: false,
    });
    await t.mutation(internal.categories.mutations.continueTrashTransactions, {
      userId: owner.userId,
      categoryId: ids.categoryId,
      keys: [String(ids.categoryId)],
      keyIndex: 0,
      cursor: null,
      now: firstArchiveAt,
    });
    const rows = await t.run((ctx) =>
      ctx.db
        .query('transactions')
        .withIndex('by_owner_category_occurredAt', (q) =>
          q.eq('ownerId', owner.userId).eq('categoryId', String(ids.categoryId)),
        )
        .collect(),
    );
    expect(rows.every((row) => row.deletedAt === undefined)).toBe(true);
  });

  it('restores category defaults only when no replacement was chosen', async () => {
    const { t, owner, ids } = await setup();
    const replacement = await t.run((ctx) =>
      ctx.db.insert('categories', {
        ownerId: owner.userId,
        name: 'Other',
        kind: 'expense',
        isSystem: false,
        sortOrder: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    await t.run((ctx) =>
      ctx.db.patch(owner.userId, {
        defaultExpenseCategoryId: ids.categoryId,
        defaultIncomeCategoryId: ids.categoryId,
      }),
    );
    await owner.as.mutation(api.categories.mutations.archive, { categoryId: ids.categoryId });
    expect(
      await t.run(async (ctx) => {
        const user = await ctx.db.get(owner.userId);
        return {
          expense: user?.defaultExpenseCategoryId ?? null,
          income: user?.defaultIncomeCategoryId ?? null,
        };
      }),
    ).toEqual({ expense: null, income: null });
    await t.run((ctx) => ctx.db.patch(owner.userId, { defaultExpenseCategoryId: replacement }));
    await owner.as.mutation(api.trash.restore, {
      kind: 'category',
      id: String(ids.categoryId),
    });
    expect(
      await t.run(async (ctx) => {
        const user = await ctx.db.get(owner.userId);
        return {
          expense: user?.defaultExpenseCategoryId ?? null,
          income: user?.defaultIncomeCategoryId ?? null,
        };
      }),
    ).toEqual({ expense: replacement, income: ids.categoryId });
  });

  it('restores the default account when no replacement was chosen', async () => {
    const { t, owner, ids } = await setup();
    await t.run((ctx) => ctx.db.patch(owner.userId, { defaultAccountId: ids.accountId }));
    await owner.as.mutation(api.accounts.mutations.archive, { accountId: ids.accountId });
    expect(
      (await t.run((ctx) => ctx.db.get(owner.userId)))?.defaultAccountId,
    ).toBeUndefined();
    await owner.as.mutation(api.trash.restore, {
      kind: 'account',
      id: String(ids.accountId),
    });
    expect(
      (await t.run((ctx) => ctx.db.get(owner.userId)))?.defaultAccountId,
    ).toBe(ids.accountId);
  });

  it('does not restore category companions while their accounts are trashed', async () => {
    const { t, owner, ids } = await setup();
    await owner.as.mutation(api.categories.mutations.archive, {
      categoryId: ids.categoryId,
      deleteTransactions: true,
    });
    await owner.as.mutation(api.accounts.mutations.archive, { accountId: ids.accountId });
    await owner.as.mutation(api.trash.restore, {
      kind: 'category',
      id: String(ids.categoryId),
    });
    expect((await t.run((ctx) => ctx.db.get(ids.lunch)))?.deletedAt).toBeDefined();
    await owner.as.mutation(api.trash.restore, {
      kind: 'account',
      id: String(ids.accountId),
    });
    expect((await t.run((ctx) => ctx.db.get(ids.lunch)))?.deletedAt).toBeDefined();
    await owner.as.mutation(api.trash.restore, {
      kind: 'transaction',
      id: String(ids.lunch),
    });
    expect((await t.run((ctx) => ctx.db.get(ids.lunch)))?.deletedAt).toBeUndefined();
  });

  it('fills transaction Trash pages after group tombstones', async () => {
    const { t, owner, ids } = await setup();
    const personalId = await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 205; index++)
        await ctx.db.insert('transactions', {
          ownerId: owner.userId,
          accountId: ids.accountId,
          type: 'expense',
          amountMinor: 1n,
          currency: 'INR',
          title: `Group ${index}`,
          groupId: 'legacy-group',
          occurredAt: now,
          status: 'posted',
          createdAt: now,
          updatedAt: now,
          deletedAt: now + 1_000 + index,
        });
      return ctx.db.insert('transactions', {
        ownerId: owner.userId,
        accountId: ids.accountId,
        type: 'expense',
        amountMinor: 1n,
        currency: 'INR',
        title: 'Personal',
        occurredAt: now,
        status: 'posted',
        createdAt: now,
        updatedAt: now,
        deletedAt: now,
      });
    });
    const items = (await owner.as.query(api.trash.list, { kind: 'transaction' })).items;
    expect(items).toEqual([
      expect.objectContaining({ id: String(personalId), title: 'Personal' }),
    ]);
  });

  it('continues expiry past a page of never-expiring transactions', async () => {
    vi.useFakeTimers();
    const { t, owner, make, ids } = await setup();
    const other = await make('expiry-target');
    const targetAccount = await t.run((ctx) =>
      ctx.db.insert('accounts', {
        ownerId: other.userId,
        name: 'Target',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const target = await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 25; index++)
        await ctx.db.insert('transactions', {
          ownerId: owner.userId,
          accountId: ids.accountId,
          type: 'expense',
          amountMinor: 1n,
          currency: 'INR',
          title: `Never ${index}`,
          occurredAt: now,
          status: 'posted',
          createdAt: now,
          updatedAt: now,
          deletedAt: now - 32 * DAY + index * 1_000,
        });
      return ctx.db.insert('transactions', {
        ownerId: other.userId,
        accountId: targetAccount,
        type: 'expense',
        amountMinor: 1n,
        currency: 'INR',
        title: 'Expired',
        occurredAt: now,
        status: 'posted',
        createdAt: now,
        updatedAt: now,
        deletedAt: now - 31 * DAY,
      });
    });
    await owner.as.mutation(api.trash.setRetention, { days: 0 });
    await t.mutation(internal.trash.purgeExpired, {});
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1_000));
    expect(await t.run((ctx) => ctx.db.get(target))).toBeNull();
  });

  it('does not automatically expire legacy account or category archives', async () => {
    vi.useFakeTimers();
    const { t, ids } = await setup();
    const legacyArchiveAt = Date.now() - 31 * DAY;
    await t.run(async (ctx) => {
      await ctx.db.patch(ids.categoryId, {
        archivedAt: legacyArchiveAt,
        updatedAt: legacyArchiveAt,
      });
      await ctx.db.patch(ids.accountId, {
        archivedAt: legacyArchiveAt,
        updatedAt: legacyArchiveAt,
      });
    });
    await t.mutation(internal.trash.purgeExpired, { kindIndex: 1 });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1_000));
    expect(await t.run((ctx) => ctx.db.get(ids.accountId))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.get(ids.categoryId))).not.toBeNull();
  });

  it('purges transaction tags, receipt metadata and storage with sync tombstones', async () => {
    const { t, owner, ids } = await setup();
    await owner.as.mutation(api.transactions.mutations.softDelete, {
      transactionId: ids.lunch,
      clientMutationId: 'purge-with-dependents',
    });
    const { tagId, receiptId, storageId } = await t.run(async (ctx) => {
      const storageId = await ctx.storage.store(
        new Blob([new Uint8Array([1])], { type: 'image/jpeg' }),
      );
      const tagId = await ctx.db.insert('transactionTags', {
        transactionId: ids.lunch,
        tag: 'receipt',
      });
      const receiptId = await ctx.db.insert('receipts', {
        transactionId: ids.lunch,
        ownerId: owner.userId,
        storageId,
        mimeType: 'image/jpeg',
        size: 1,
        createdAt: Date.now(),
      });
      return { tagId, receiptId, storageId };
    });
    await owner.as.mutation(api.trash.purge, {
      kind: 'transaction',
      id: String(ids.lunch),
    });
    expect(await t.run((ctx) => ctx.db.get(tagId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(receiptId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.system.get('_storage', storageId))).toBeNull();
    const changes = await t.run((ctx) => ctx.db.query('syncChanges').collect());
    expect(
      changes.filter(
        (change) =>
          ['transactions', 'transactionTags', 'receipts'].includes(change.entityType) &&
          change.deletedAt !== undefined,
      ).map((change) => change.entityType),
    ).toEqual(expect.arrayContaining(['transactions', 'transactionTags', 'receipts']));
  });

  it('purges inbound and self transfers only once when deleting an account', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    const sourceAccount = await t.run((ctx) =>
      ctx.db.insert('accounts', {
        ownerId: owner.userId,
        name: 'Source',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    const transfers = await t.run(async (ctx) => {
      const now = Date.now();
      const insert = (accountId: typeof sourceAccount, title: string) =>
        ctx.db.insert('transactions', {
          ownerId: owner.userId,
          accountId,
          type: 'transfer' as const,
          amountMinor: 500n,
          currency: 'INR',
          title,
          transferAccountId: String(ids.accountId),
          occurredAt: now,
          status: 'posted' as const,
          createdAt: now,
          updatedAt: now,
        });
      return {
        inbound: await insert(sourceAccount, 'Inbound'),
        self: await insert(ids.accountId, 'Self'),
      };
    });
    await owner.as.mutation(api.accounts.mutations.archive, { accountId: ids.accountId });
    await owner.as.mutation(api.trash.purge, {
      kind: 'account',
      id: String(ids.accountId),
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect(await t.run((ctx) => ctx.db.get(transfers.inbound))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(transfers.self))).toBeNull();
    const deletionChanges = await t.run(async (ctx) =>
      (await ctx.db.query('syncChanges').collect()).filter(
        (change) =>
          change.entityType === 'transactions' &&
          [String(transfers.inbound), String(transfers.self)].includes(change.documentId) &&
          change.deletedAt !== undefined,
      ),
    );
    expect(deletionChanges).toHaveLength(2);
  });

  it('keeps group expenses in their ledger deletion path during account purges', async () => {
    vi.useFakeTimers();
    const { t, owner, ids } = await setup();
    const { groupId, expenseId } = await t.run(async (ctx) => {
      const now = Date.now();
      const groupId = await ctx.db.insert('groups', {
        ownerId: owner.userId,
        name: 'Trip',
        currency: 'INR',
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('groupMembers', {
        groupId,
        userId: owner.userId,
        role: 'owner',
        joinedAt: now,
      });
      const expenseId = await ctx.db.insert('transactions', {
        ownerId: owner.userId,
        accountId: ids.accountId,
        type: 'expense',
        amountMinor: 500n,
        currency: 'INR',
        title: 'Shared lunch',
        groupId: String(groupId),
        occurredAt: now,
        status: 'posted',
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('expensePayers', {
        transactionId: expenseId,
        userId: owner.userId,
        amountMinor: 500n,
      });
      await ctx.db.insert('expenseParticipants', {
        transactionId: expenseId,
        userId: owner.userId,
        amountMinor: 500n,
        method: 'equal',
      });
      return { groupId, expenseId };
    });
    await owner.as.mutation(api.accounts.mutations.archive, { accountId: ids.accountId });
    await expect(
      owner.as.mutation(api.trash.purge, {
        kind: 'account',
        id: String(ids.accountId),
      }),
    ).rejects.toThrow('ACCOUNT_IN_USE_BY_GROUP_EXPENSE');
    expect(await t.run((ctx) => ctx.db.get(ids.accountId))).not.toBeNull();
    expect((await t.run((ctx) => ctx.db.get(expenseId)))?.deletedAt).toBeUndefined();
    await owner.as.mutation(api.groups.mutations.deleteExpense, { transactionId: expenseId });
    await expect(
      owner.as.mutation(api.trash.restore, { kind: 'transaction', id: String(expenseId) }),
    ).rejects.toThrow('NOT_IN_TRASH');
    await owner.as.mutation(api.trash.purge, {
      kind: 'account',
      id: String(ids.accountId),
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    expect((await t.run((ctx) => ctx.db.get(expenseId)))?.deletedAt).toBeDefined();
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('ledgerEvents')
          .withIndex('by_group_createdAt', (q) => q.eq('groupId', groupId))
          .collect(),
      ),
    ).toHaveLength(1);
  });
});

describe('friend notifications', () => {
  it('notifies on a new request and when it is accepted', async () => {
    const { t, make } = await setup();
    const asha = await make('asha');
    const ben = await make('ben');
    const { requestId } = await asha.as.mutation(api.social.mutations.sendRequest, {
      recipientId: ben.userId,
    });
    await ben.as.mutation(api.social.mutations.respondToRequest, { requestId, response: 'accept' });
    const notes = await t.run((ctx) => ctx.db.query('notifications').collect());
    expect(notes.map((note) => [note.recipientId, note.type, note.title])).toEqual([
      [ben.userId, 'social', 'New friend request'],
      [asha.userId, 'social', 'Friend request accepted'],
    ]);
  });
});
