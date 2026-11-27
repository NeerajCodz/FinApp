import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';
import { manageTools } from '../../convex/ai/manageTools';

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

  it('continues list_trash through more than 200 records without losing older items', async () => {
    const { t, owner, ids } = await setup();
    const count = 225;
    const base = Date.UTC(2025, 0, 1);
    await t.run(async (ctx) => {
      for (let index = 0; index < count; index++) {
        await ctx.db.insert('transactions', {
          ownerId: owner.userId,
          accountId: ids.accountId,
          type: 'expense',
          amountMinor: 100n,
          currency: 'INR',
          categoryId: String(ids.categoryId),
          title: `Trash ${index}`,
          occurredAt: base + index,
          status: 'posted',
          createdAt: base + index,
          updatedAt: base + index,
          deletedAt: base + index,
        });
      }
    });

    expect((await owner.as.query(api.trash.list, {})).items).toHaveLength(200);
    const tool = manageTools.find((candidate) => candidate.name === 'list_trash')!;
    const ctx = {
      run: {
        runQuery: (ref: never, args: never) => owner.as.query(ref, args),
      } as never,
      userId: owner.userId,
      scope: { type: 'assistant' as const, id: 'conversation' },
      messageId: 'message-1',
      defaultCurrency: 'INR',
      timeZone: 'UTC',
    };
    const seen = new Set<string>();
    let cursor: string | undefined;
    let nextCursor: string | null = 'start';
    let pages = 0;
    while (nextCursor && pages < 10) {
      pages++;
      const result = await tool.run(ctx, cursor ? { cursor } : {});
      const data = result.data as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      for (const item of data.items) seen.add(item.id);
      nextCursor = data.nextCursor;
      cursor = nextCursor ?? undefined;
    }
    expect(nextCursor).toBeNull();
    expect(seen).toHaveLength(count);
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
    const { t, owner, ids } = await setup();
    await t.run((ctx) => ctx.db.patch(ids.accountId, { archivedAt: Date.now() }));
    await owner.as.mutation(api.trash.purge, { kind: 'account', id: String(ids.accountId) });
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
