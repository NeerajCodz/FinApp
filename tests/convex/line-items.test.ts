import { afterAll, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { allocateItemized } from '../../convex/splits/domain';

vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
afterAll(() => vi.unstubAllEnvs());
const modules = import.meta.glob('../../convex/**/*.ts');

type Person = 'owner' | 'member' | 'friend' | 'outsider';
const people: Record<Person, { subject: string; email: string; name: string }> = {
  owner: { subject: 'items-owner', email: 'owner@example.com', name: 'Owner' },
  member: { subject: 'items-member', email: 'member@example.com', name: 'Member' },
  friend: { subject: 'items-friend', email: 'friend@example.com', name: 'Friend' },
  outsider: { subject: 'items-outsider', email: 'outsider@example.com', name: 'Outsider' },
};

/** Group with owner, member and friend joined; `outsider` exists but is not a member. */
async function setup() {
  const t = convexTest(schema, modules);
  const ids = {} as Record<Person, Id<'users'>>;
  for (const [key, person] of Object.entries(people) as [Person, (typeof people)[Person]][])
    ids[key] = await t.run((ctx) =>
      ctx.db.insert('users', {
        emailVerificationTime: 1,
        identityId: person.subject,
        email: person.email,
        name: person.name,
        username: `${key}_user`,
      }),
    );
  const as = (person: Person) => t.withIdentity(people[person]);
  const accountId = await as('owner').mutation(api.accounts.mutations.create, {
    name: 'Owner bank',
    type: 'bank',
    currency: 'INR',
    openingBalanceMinor: 0n,
    isIncludedInTotal: true,
  });
  const categoryId = await t.run((ctx) =>
    ctx.db.insert('categories', {
      ownerId: ids.owner,
      name: 'Food',
      kind: 'expense',
      isSystem: false,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  const groupId = await as('owner').mutation(api.groups.mutations.create, {
    name: 'Lunch club',
    currency: 'INR',
    memberUsernames: [],
  });
  await t.run(async (ctx) => {
    for (const userId of [ids.member, ids.friend])
      await ctx.db.insert('groupMembers', {
        groupId,
        userId,
        role: 'member',
        joinedAt: Date.UTC(2026, 0, 1),
      });
  });
  return { t, ids, as, accountId, categoryId, groupId };
}

const bill = [
  { id: 'starters', title: ' Starters ', amountMinor: 20000n },
  { id: 'juice', title: 'Juice', amountMinor: 30000n, quantity: 2 },
  { id: 'meal', title: 'Meal', amountMinor: 50000n },
];

function itemizedRows(
  items: { amountMinor: bigint; participantIds?: Id<'users'>[] }[],
  userIds: Id<'users'>[],
) {
  return allocateItemized(items, userIds).map((row) => ({
    userId: row.userId as Id<'users'>,
    amountMinor: row.amountMinor,
    method: 'itemized' as const,
  }));
}

describe('personal transaction line items', () => {
  it('stores trimmed items that add up to the total and syncs them', async () => {
    const { t, ids, as, accountId, categoryId } = await setup();
    const transactionId = await as('owner').mutation(api.transactions.mutations.create, {
      accountId,
      type: 'expense',
      amountMinor: 100000n,
      currency: 'INR',
      categoryId,
      title: 'Hotel lunch',
      occurredAt: Date.UTC(2026, 5, 1),
      items: bill,
      clientMutationId: 'items-create',
    });
    const stored = await t.run((ctx) => ctx.db.get(transactionId));
    expect(stored?.items).toEqual([
      { id: 'starters', title: 'Starters', amountMinor: 20000n },
      { id: 'juice', title: 'Juice', amountMinor: 30000n, quantity: 2 },
      { id: 'meal', title: 'Meal', amountMinor: 50000n },
    ]);
    const changes = await as('owner').query(api.sync.queries.changes, {
      paginationOpts: { numItems: 50, cursor: null },
    });
    const change = changes.page.find(
      (entry) => entry.entityType === 'transactions' && entry.documentId === transactionId,
    );
    expect(change?.scopeUserId).toBe(ids.owner);
    expect(change?.document.items).toHaveLength(3);
    expect(change?.document.items[1]).toMatchObject({ title: 'Juice', amountMinor: 30000n });
  });

  it('rejects items that do not add up and invalid items', async () => {
    const { as, accountId, categoryId } = await setup();
    const base = {
      accountId,
      type: 'expense' as const,
      currency: 'INR',
      categoryId,
      title: 'Hotel lunch',
      occurredAt: Date.UTC(2026, 5, 1),
    };
    await expect(
      as('owner').mutation(api.transactions.mutations.create, {
        ...base,
        amountMinor: 90000n,
        items: bill,
        clientMutationId: 'items-mismatch',
      }),
    ).rejects.toThrow('ITEMS_TOTAL_MISMATCH');
    await expect(
      as('owner').mutation(api.transactions.mutations.create, {
        ...base,
        amountMinor: 20000n,
        items: [{ id: 'a', title: '   ', amountMinor: 20000n }],
        clientMutationId: 'items-blank',
      }),
    ).rejects.toThrow('INVALID_ITEMS');
    await expect(
      as('owner').mutation(api.transactions.mutations.create, {
        ...base,
        amountMinor: 20000n,
        items: [
          { id: 'a', title: 'A', amountMinor: 20000n },
          { id: 'b', title: 'B', amountMinor: 0n },
        ],
        clientMutationId: 'items-zero',
      }),
    ).rejects.toThrow('INVALID_ITEMS');
  });

  it('updates, keeps and clears items', async () => {
    const { t, as, accountId, categoryId } = await setup();
    const base = {
      accountId,
      type: 'expense' as const,
      currency: 'INR',
      categoryId,
      title: 'Hotel lunch',
      occurredAt: Date.UTC(2026, 5, 1),
    };
    const transactionId = await as('owner').mutation(api.transactions.mutations.create, {
      ...base,
      amountMinor: 100000n,
      items: bill,
      clientMutationId: 'items-update-create',
    });
    const update = (extra: Record<string, unknown>, key: string) =>
      as('owner').mutation(api.transactions.mutations.update, {
        ...base,
        transactionId,
        amountMinor: 100000n,
        clientMutationId: key,
        ...extra,
      });
    // Omitting items keeps them while they still add up.
    await update({ title: 'Renamed' }, 'items-keep');
    expect((await t.run((ctx) => ctx.db.get(transactionId)))?.items).toHaveLength(3);
    await expect(
      update({ amountMinor: 110000n, items: bill }, 'items-update-mismatch'),
    ).rejects.toThrow('ITEMS_TOTAL_MISMATCH');
    await update(
      { amountMinor: 110000n, items: [...bill, { id: 'tip', title: 'Tip', amountMinor: 10000n }] },
      'items-add-tip',
    );
    expect((await t.run((ctx) => ctx.db.get(transactionId)))?.items).toHaveLength(4);
    // An older client changing only the total drops items that no longer match.
    await update({ amountMinor: 50000n }, 'items-legacy-total');
    expect((await t.run((ctx) => ctx.db.get(transactionId)))?.items).toBeUndefined();
    await update({ items: bill }, 'items-readd');
    await update({ items: [] }, 'items-clear');
    expect((await t.run((ctx) => ctx.db.get(transactionId)))?.items).toBeUndefined();
  });
});

describe('itemized group expenses', () => {
  it('splits each item between the people who had it', async () => {
    const { t, ids, as, accountId, groupId } = await setup();
    const userIds = [ids.owner, ids.member, ids.friend];
    const items = [
      { id: 'starters', title: 'Starters', amountMinor: 20000n },
      {
        id: 'juice',
        title: 'Juice',
        amountMinor: 30000n,
        participantIds: [ids.member, ids.friend],
      },
      { id: 'meal', title: 'Meal', amountMinor: 50000n, participantIds: [ids.owner] },
    ];
    const participants = itemizedRows(items, userIds);
    const expenseId = await as('owner').mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId,
      title: 'Hotel lunch',
      amountMinor: 100000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants,
      items,
    });
    const state = await t.run(async (ctx) => ({
      expense: await ctx.db.get(expenseId),
      rows: await ctx.db
        .query('expenseParticipants')
        .withIndex('by_transaction', (q) => q.eq('transactionId', expenseId))
        .collect(),
    }));
    const share = (userId: Id<'users'>) =>
      state.rows.find((row) => row.userId === userId)?.amountMinor;
    // Starters 200 three ways (66.67/66.67/66.66), juice 300 two ways, meal 500 to owner.
    expect(share(ids.owner)! + share(ids.member)! + share(ids.friend)!).toBe(100000n);
    expect(share(ids.owner)).toBe(50000n + allocateItemized([items[0]!], userIds)[0]!.amountMinor);
    expect(share(ids.member)! - allocateItemized([items[0]!], userIds)[1]!.amountMinor).toBe(
      15000n,
    );
    expect(state.rows.every((row) => row.method === 'itemized' && !row.basisValue)).toBe(true);
    expect(state.expense?.items?.[1]?.participantIds).toEqual([ids.member, ids.friend]);
    // Every member receives the items through sync.
    const memberChanges = await as('friend').query(api.sync.queries.changes, {
      paginationOpts: { numItems: 50, cursor: null },
    });
    expect(
      memberChanges.page.find(
        (entry) => entry.entityType === 'transactions' && entry.documentId === expenseId,
      )?.document.items,
    ).toHaveLength(3);
  });

  it('rejects mismatched totals, wrong shares and unknown participants', async () => {
    const { ids, as, accountId, groupId } = await setup();
    const userIds = [ids.owner, ids.member];
    const items = [
      { id: 'a', title: 'A', amountMinor: 1000n, participantIds: [ids.member] },
      { id: 'b', title: 'B', amountMinor: 501n },
    ];
    const base = {
      groupId,
      accountId,
      title: 'Dinner',
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
    };
    await expect(
      as('owner').mutation(api.groups.mutations.addExpense, {
        ...base,
        amountMinor: 1600n,
        participants: itemizedRows(items, userIds),
        items,
      }),
    ).rejects.toThrow('ITEMS_TOTAL_MISMATCH');
    const wrong = itemizedRows(items, userIds).map((row, index) => ({
      ...row,
      amountMinor: row.amountMinor + (index === 0 ? 1n : -1n),
    }));
    await expect(
      as('owner').mutation(api.groups.mutations.addExpense, {
        ...base,
        amountMinor: 1501n,
        participants: wrong,
        items,
      }),
    ).rejects.toThrow('INVALID_SPLIT');
    // An item naming someone who is not on the expense.
    const stray = [
      { id: 'a', title: 'A', amountMinor: 1000n, participantIds: [ids.friend] },
      { id: 'b', title: 'B', amountMinor: 501n },
    ];
    await expect(
      as('owner').mutation(api.groups.mutations.addExpense, {
        ...base,
        amountMinor: 1501n,
        participants: itemizedRows(items, userIds),
        items: stray,
      }),
    ).rejects.toThrow('INVALID_SPLIT');
    // A non-member as participant.
    const outsiderItems = [{ id: 'a', title: 'A', amountMinor: 1000n }];
    await expect(
      as('owner').mutation(api.groups.mutations.addExpense, {
        ...base,
        amountMinor: 1000n,
        participants: itemizedRows(outsiderItems, [ids.owner, ids.outsider]),
        items: outsiderItems,
      }),
    ).rejects.toThrow('NOT_MEMBER');
    // Itemized without items.
    await expect(
      as('owner').mutation(api.groups.mutations.addExpense, {
        ...base,
        amountMinor: 1000n,
        participants: [
          { userId: ids.owner, amountMinor: 500n, method: 'itemized' },
          { userId: ids.member, amountMinor: 500n, method: 'itemized' },
        ],
      }),
    ).rejects.toThrow('INVALID_SPLIT');
  });

  it('switches an expense to and from an itemized split', async () => {
    const { t, ids, as, accountId, groupId } = await setup();
    const userIds = [ids.owner, ids.member];
    const expenseId = await as('owner').mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId,
      title: 'Dinner',
      amountMinor: 1000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: [
        { userId: ids.owner, amountMinor: 500n, method: 'equal' },
        { userId: ids.member, amountMinor: 500n, method: 'equal' },
      ],
    });
    const items = [
      { id: 'pizza', title: 'Pizza', amountMinor: 900n, participantIds: [ids.member] },
      { id: 'water', title: 'Water', amountMinor: 300n },
    ];
    const edit = (extra: Record<string, unknown>, expectedVersion: number) =>
      as('owner').mutation(api.groups.mutations.updateExpense, {
        transactionId: expenseId,
        accountId,
        title: 'Dinner',
        currency: 'INR',
        occurredAt: Date.UTC(2026, 5, 1),
        expectedVersion,
        ...extra,
      } as never);
    await edit({ amountMinor: 1200n, participants: itemizedRows(items, userIds), items }, 1);
    let state = await t.run(async (ctx) => ({
      expense: await ctx.db.get(expenseId),
      rows: await ctx.db
        .query('expenseParticipants')
        .withIndex('by_transaction', (q) => q.eq('transactionId', expenseId))
        .collect(),
      payers: await ctx.db
        .query('expensePayers')
        .withIndex('by_transaction', (q) => q.eq('transactionId', expenseId))
        .collect(),
      events: await ctx.db.query('ledgerEvents').collect(),
    }));
    expect(state.expense).toMatchObject({ amountMinor: 1200n, version: 2 });
    expect(state.expense?.items).toHaveLength(2);
    expect(state.rows.find((row) => row.userId === ids.member)).toMatchObject({
      amountMinor: 1050n,
      method: 'itemized',
    });
    expect(state.rows.find((row) => row.userId === ids.owner)?.amountMinor).toBe(150n);
    expect(state.payers[0]?.amountMinor).toBe(1200n);
    expect(state.events.find((event) => event.kind === 'expense.updated')).toMatchObject({
      version: 2,
      balanceDeltas: { [ids.owner]: '550', [ids.member]: '-550' },
    });
    // Omitting items reuses the stored ones for an itemized split.
    await edit({ amountMinor: 1200n, participants: itemizedRows(items, userIds) }, 2);
    // Back to equal: items stay as a breakdown without per-person assignments.
    await edit(
      {
        amountMinor: 1200n,
        participants: [
          { userId: ids.owner, amountMinor: 600n, method: 'equal' },
          { userId: ids.member, amountMinor: 600n, method: 'equal' },
        ],
      },
      3,
    );
    state = await t.run(async (ctx) => ({
      ...state,
      expense: await ctx.db.get(expenseId),
      rows: await ctx.db
        .query('expenseParticipants')
        .withIndex('by_transaction', (q) => q.eq('transactionId', expenseId))
        .collect(),
    }));
    expect(state.expense?.items).toEqual([
      { id: 'pizza', title: 'Pizza', amountMinor: 900n },
      { id: 'water', title: 'Water', amountMinor: 300n },
    ]);
    expect(state.rows.every((row) => row.method === 'equal' && row.amountMinor === 600n)).toBe(
      true,
    );
    // Clearing items.
    await edit(
      {
        amountMinor: 1000n,
        items: [],
        participants: [
          { userId: ids.owner, amountMinor: 500n, method: 'equal' },
          { userId: ids.member, amountMinor: 500n, method: 'equal' },
        ],
      },
      4,
    );
    expect((await t.run((ctx) => ctx.db.get(expenseId)))?.items).toBeUndefined();
    // Itemized with mismatching items is rejected.
    await expect(
      edit({ amountMinor: 1000n, participants: itemizedRows(items, userIds), items }, 5),
    ).rejects.toThrow('ITEMS_TOTAL_MISMATCH');
  });
});
