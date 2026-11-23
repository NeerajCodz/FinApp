import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Id } from '../../convex/_generated/dataModel';

const modules = import.meta.glob('../../convex/**/*.ts');
const DAY = 86_400_000;

async function fixture() {
  const t = convexTest(schema, modules);
  const user = async (subject: string) =>
    t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: subject,
        email: `${subject}@example.com`,
        emailVerificationTime: 1,
        displayName: subject,
        defaultCurrency: 'INR',
      }),
    );
  const ownerId = await user('owner');
  const friendId = await user('friend');
  const strangerId = await user('stranger');
  const as = (subject: string) =>
    t.withIdentity({ subject, email: `${subject}@example.com`, name: subject });
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const accountId = await ctx.db.insert('accounts', {
      ownerId,
      name: 'Wallet',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
      createdAt: now,
      updatedAt: now,
    });
    const groupId = await ctx.db.insert('groups', {
      ownerId,
      name: 'Trip',
      currency: 'INR',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('groupMembers', { groupId, userId: ownerId, role: 'owner', joinedAt: now });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: friendId,
      role: 'member',
      joinedAt: now,
    });
    const base = {
      ownerId,
      accountId,
      currency: 'INR',
      status: 'posted' as const,
      createdAt: now,
      updatedAt: now,
    };
    const coffee = await ctx.db.insert('transactions', {
      ...base,
      type: 'expense',
      amountMinor: 25_000n,
      title: 'Coffee',
      note: 'oat flat white',
      occurredAt: now - DAY,
    });
    const rent = await ctx.db.insert('transactions', {
      ...base,
      type: 'expense',
      amountMinor: 2_000_000n,
      title: 'Rent',
      occurredAt: now - 2 * DAY,
    });
    const dinner = await ctx.db.insert('transactions', {
      ...base,
      type: 'expense',
      amountMinor: 120_000n,
      title: 'Dinner',
      groupId,
      version: 3,
      occurredAt: now - 3 * DAY,
    });
    await ctx.db.insert('expensePayers', {
      transactionId: dinner,
      userId: ownerId,
      amountMinor: 120_000n,
    });
    for (const userId of [ownerId, friendId]) {
      await ctx.db.insert('expenseParticipants', {
        transactionId: dinner,
        userId,
        amountMinor: 60_000n,
        method: 'equal',
      });
    }
    return { accountId, groupId, coffee, rent, dinner };
  });
  return { t, as, ownerId, friendId, strangerId, ...ids };
}

const page = { numItems: 25, cursor: null };

describe('MCP transaction search', () => {
  it('filters by amount range and searches notes', async () => {
    const { as } = await fixture();
    const now = Date.now();
    const window = { startAt: now - 30 * DAY, endAt: now + DAY, paginationOpts: page };
    const small = await as('owner').query(api.mcp.listTransactions, {
      ...window,
      maxAmountMinor: 200_000n,
    });
    expect(small.items.map((item) => item.title)).toEqual(['Coffee', 'Dinner']);
    const large = await as('owner').query(api.mcp.listTransactions, {
      ...window,
      minAmountMinor: 1_000_000n,
    });
    expect(large.items.map((item) => item.title)).toEqual(['Rent']);
    const byNote = await as('owner').query(api.mcp.listTransactions, {
      ...window,
      search: 'flat white',
    });
    expect(byNote.items.map((item) => item.title)).toEqual(['Coffee']);
  });

  it('rejects an inverted amount range', async () => {
    const { as } = await fixture();
    const now = Date.now();
    await expect(
      as('owner').query(api.mcp.listTransactions, {
        startAt: now - DAY,
        endAt: now,
        minAmountMinor: 10n,
        maxAmountMinor: 1n,
        paginationOpts: page,
      }),
    ).rejects.toThrow('INVALID_FILTERS');
  });
});

describe('MCP transaction detail', () => {
  it('returns a personal transaction with account context to its owner only', async () => {
    const { as, coffee } = await fixture();
    const detail = await as('owner').query(api.mcp.getTransaction, { transactionId: coffee });
    expect(detail).toMatchObject({ title: 'Coffee', accountName: 'Wallet', group: null });
    await expect(
      as('friend').query(api.mcp.getTransaction, { transactionId: coffee }),
    ).rejects.toThrow('TRANSACTION_UNAVAILABLE');
  });

  it('shows the split of a group expense to members without leaking the payer account', async () => {
    const { as, dinner, friendId } = await fixture();
    const detail = await as('friend').query(api.mcp.getTransaction, { transactionId: dinner });
    expect(detail.accountId).toBeUndefined();
    expect(detail.group).toMatchObject({ name: 'Trip', version: 3 });
    expect(detail.group?.payers).toEqual([
      expect.objectContaining({ displayName: 'owner', amountMinor: 120_000n }),
    ]);
    expect(detail.group?.participants).toContainEqual(
      expect.objectContaining({ userId: friendId as Id<'users'>, amountMinor: 60_000n }),
    );
    await expect(
      as('stranger').query(api.mcp.getTransaction, { transactionId: dinner }),
    ).rejects.toThrow('TRANSACTION_UNAVAILABLE');
  });

  it('treats malformed ids as unavailable', async () => {
    const { as } = await fixture();
    await expect(
      as('owner').query(api.mcp.getTransaction, { transactionId: 'not-an-id' }),
    ).rejects.toThrow('TRANSACTION_UNAVAILABLE');
  });
});
