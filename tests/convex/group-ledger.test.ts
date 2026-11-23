import { afterAll, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';

vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
afterAll(() => vi.unstubAllEnvs());
const modules = import.meta.glob('../../convex/**/*.ts');

type Person = 'owner' | 'admin' | 'member' | 'late';
const people: Record<Person, { subject: string; email: string; name: string }> = {
  owner: { subject: 'ledger-owner', email: 'owner@example.com', name: 'Owner' },
  admin: { subject: 'ledger-admin', email: 'admin@example.com', name: 'Admin' },
  member: { subject: 'ledger-member', email: 'member@example.com', name: 'Member' },
  late: { subject: 'ledger-late', email: 'late@example.com', name: 'Late' },
};

/** Group with owner, admin and member already joined; `late` exists but is not a member. */
async function setupGroup() {
  const t = convexTest(schema, modules);
  const ids = {} as Record<Person, Id<'users'>>;
  for (const [key, person] of Object.entries(people) as [Person, (typeof people)[Person]][]) {
    ids[key] = await t.run((ctx) =>
      ctx.db.insert('users', {
        emailVerificationTime: 1,
        identityId: person.subject,
        email: person.email,
        name: person.name,
        username: `${key}_user`,
      }),
    );
  }
  const as = (person: Person) => t.withIdentity(people[person]);
  const accounts = {} as Record<Person, Id<'accounts'>>;
  for (const person of Object.keys(people) as Person[])
    accounts[person] = await as(person).mutation(api.accounts.mutations.create, {
      name: `${person} bank`,
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
  const groupId = await as('owner').mutation(api.groups.mutations.create, {
    name: 'Flat',
    currency: 'INR',
    memberUsernames: [],
  });
  await t.run(async (ctx) => {
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: ids.admin,
      role: 'admin',
      joinedAt: Date.UTC(2026, 0, 1),
    });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: ids.member,
      role: 'member',
      joinedAt: Date.UTC(2026, 0, 1),
    });
  });
  const equal = (total: bigint, users: Id<'users'>[]) => {
    const base = total / BigInt(users.length);
    let remainder = total % BigInt(users.length);
    return [...users]
      .sort()
      .map((userId) => {
        const extra = remainder > 0n ? 1n : 0n;
        remainder -= extra;
        return { userId, amountMinor: base + extra, method: 'equal' as const };
      })
      .sort((left, right) => users.indexOf(left.userId) - users.indexOf(right.userId));
  };
  const addExpense = (payer: Person, title: string, total: bigint, users: Id<'users'>[]) =>
    as(payer).mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId: accounts[payer],
      title,
      amountMinor: total,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: equal(total, users),
    });
  return { t, ids, as, accounts, groupId, equal, addExpense };
}

describe('group ledger integrity', () => {
  it('keeps settlements as payments when an expense is edited afterwards', async () => {
    const { t, ids, as, accounts, groupId, equal, addExpense } = await setupGroup();
    const expenseId = await addExpense('owner', 'Groceries', 3000n, [ids.owner, ids.member]);
    await as('member').mutation(api.settlements.mutations.create, {
      groupId,
      fromUserId: ids.member,
      toUserId: ids.owner,
      accountId: accounts.member,
      amountMinor: 1500n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 2),
      clientMutationId: 'settle-1',
    });
    // Member's share drops from 1500 to 500 after they already paid 1500.
    await as('owner').mutation(api.groups.mutations.updateExpense, {
      transactionId: expenseId,
      accountId: accounts.owner,
      title: 'Groceries',
      amountMinor: 1000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: equal(1000n, [ids.owner, ids.member]),
      expectedVersion: 1,
    });
    const state = await t.run(async (ctx) => ({
      expense: await ctx.db.get(expenseId),
      events: await ctx.db.query('ledgerEvents').collect(),
      notifications: await ctx.db
        .query('notifications')
        .withIndex('by_recipient_createdAt', (q) => q.eq('recipientId', ids.member))
        .collect(),
    }));
    expect(state.expense).toMatchObject({ version: 2, updatedBy: ids.owner });
    expect(state.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'expense.updated',
          entityId: String(expenseId),
          version: 2,
          balanceDeltas: { [ids.owner]: '-1000', [ids.member]: '1000' },
        }),
      ]),
    );
    expect(
      state.notifications.find((item) => item.eventKey?.startsWith('split-edit:')),
    ).toMatchObject({
      entityType: 'transaction',
      entityId: String(expenseId),
      body: expect.stringContaining('You are now owed'),
    });
  });

  it('rejects stale edits and lets admins, but not plain members, edit', async () => {
    const { ids, as, accounts, equal, addExpense } = await setupGroup();
    const expenseId = await addExpense('owner', 'Rent', 900n, [ids.owner, ids.admin, ids.member]);
    const edit = {
      transactionId: expenseId,
      accountId: accounts.owner,
      title: 'Rent',
      amountMinor: 600n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: equal(600n, [ids.owner, ids.admin, ids.member]),
    };
    await expect(as('member').mutation(api.groups.mutations.updateExpense, edit)).rejects.toThrow(
      'INSUFFICIENT_PERMISSION',
    );
    await expect(
      as('admin').mutation(api.groups.mutations.updateExpense, {
        ...edit,
        accountId: accounts.admin,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await as('admin').mutation(api.groups.mutations.updateExpense, { ...edit, expectedVersion: 1 });
    await expect(
      as('owner').mutation(api.groups.mutations.updateExpense, { ...edit, expectedVersion: 1 }),
    ).rejects.toThrow('TRANSACTION_CHANGED');
  });

  it('lets the editor change who paid', async () => {
    const { t, ids, as, accounts, equal, addExpense } = await setupGroup();
    const expenseId = await addExpense('owner', 'Dinner', 1000n, [ids.owner, ids.member]);
    await as('owner').mutation(api.groups.mutations.updateExpense, {
      transactionId: expenseId,
      accountId: accounts.owner,
      title: 'Dinner',
      amountMinor: 1000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: equal(1000n, [ids.owner, ids.member]),
      payers: [
        { userId: ids.owner, amountMinor: 400n },
        { userId: ids.member, amountMinor: 600n },
      ],
    });
    const payers = await t.run((ctx) => ctx.db.query('expensePayers').collect());
    expect(payers.map((row) => [row.userId, row.amountMinor])).toEqual([
      [ids.owner, 400n],
      [ids.member, 600n],
    ]);
    await expect(
      as('owner').mutation(api.groups.mutations.updateExpense, {
        transactionId: expenseId,
        accountId: accounts.owner,
        title: 'Dinner',
        amountMinor: 1000n,
        currency: 'INR',
        occurredAt: Date.UTC(2026, 5, 1),
        participants: equal(1000n, [ids.owner, ids.member]),
        payers: [{ userId: ids.late, amountMinor: 1000n }],
      }),
    ).rejects.toThrow('NOT_MEMBER');
  });
});
