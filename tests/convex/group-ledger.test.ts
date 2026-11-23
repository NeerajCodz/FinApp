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

  it('deletes an expense for the creator or an admin and drops it from balances', async () => {
    const { t, ids, as, groupId, addExpense } = await setupGroup();
    const expenseId = await addExpense('owner', 'Taxi', 800n, [ids.owner, ids.member]);
    await expect(
      as('member').mutation(api.groups.mutations.deleteExpense, { transactionId: expenseId }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await as('admin').mutation(api.groups.mutations.deleteExpense, {
      transactionId: expenseId,
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
    expect(state.expense).toMatchObject({ deletedBy: ids.admin, version: 2 });
    expect(state.events.map((event) => event.kind)).toEqual(['expense.created', 'expense.deleted']);
    expect(state.notifications.some((item) => item.eventKey === `split-delete:${expenseId}`)).toBe(
      true,
    );
    const detail = await as('owner').query(api.groups.queries.detail, { groupId });
    expect(detail?.expenses).toEqual([]);
    await expect(
      as('owner').mutation(api.groups.mutations.deleteExpense, { transactionId: expenseId }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
  });

  it('undoes a settlement, reopening the debt, and keeps the note', async () => {
    const { t, ids, as, accounts, groupId, addExpense } = await setupGroup();
    await addExpense('owner', 'Power bill', 2000n, [ids.owner, ids.member]);
    const settle = {
      groupId,
      fromUserId: ids.member,
      toUserId: ids.owner,
      accountId: accounts.member,
      amountMinor: 1000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 2),
      note: '  UPI ref 42  ',
    };
    const settlementId = await as('member').mutation(api.settlements.mutations.create, {
      ...settle,
      clientMutationId: 'pay-1',
    });
    expect(await t.run((ctx) => ctx.db.get(settlementId))).toMatchObject({
      note: 'UPI ref 42',
      createdBy: ids.member,
    });
    await expect(
      as('admin').mutation(api.settlements.mutations.create, {
        ...settle,
        accountId: accounts.admin,
        clientMutationId: 'pay-2',
      }),
    ).rejects.toThrow();
    await expect(
      as('member').mutation(api.settlements.mutations.create, {
        ...settle,
        clientMutationId: 'pay-3',
      }),
    ).rejects.toThrow('SETTLEMENT_EXCEEDS_BALANCE');
    await as('admin').mutation(api.settlements.mutations.remove, { settlementId });
    expect(await t.run((ctx) => ctx.db.get(settlementId))).toMatchObject({
      deletedBy: ids.admin,
      deletedAt: expect.any(Number),
    });
    // The debt is open again, so the same payment can be recorded once more.
    await as('member').mutation(api.settlements.mutations.create, {
      ...settle,
      clientMutationId: 'pay-4',
    });
    await expect(
      as('member').mutation(api.settlements.mutations.remove, { settlementId }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    const kinds = (await t.run((ctx) => ctx.db.query('ledgerEvents').collect())).map(
      (event) => event.kind,
    );
    expect(kinds).toEqual([
      'expense.created',
      'settlement.created',
      'settlement.deleted',
      'settlement.created',
    ]);
  });

  it('leaves past expenses alone when someone joins, until an admin opts them in', async () => {
    const { t, ids, as, groupId, addExpense } = await setupGroup();
    const expenseId = await addExpense('owner', 'Wifi', 900n, [ids.owner, ids.member]);
    const linkToken = await t.run(async (ctx) => {
      const token = 'a'.repeat(64);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const tokenHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      await ctx.db.insert('groupInvitationLinks', {
        groupId,
        creatorId: ids.owner,
        tokenHash,
        expiresAt: Date.now() + 60_000,
        createdAt: Date.now(),
      });
      return token;
    });
    await as('late').mutation(api.groups.mutations.joinByInvitationLink, { token: linkToken });
    const participantsAfterJoin = await t.run((ctx) =>
      ctx.db
        .query('expenseParticipants')
        .withIndex('by_transaction', (q) => q.eq('transactionId', expenseId))
        .collect(),
    );
    expect(participantsAfterJoin.map((row) => row.userId)).toEqual([ids.owner, ids.member]);
    const joinNotices = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_createdAt', (q) => q.eq('recipientId', ids.member))
        .collect(),
    );
    expect(joinNotices.some((item) => item.title === 'Late joined Flat')).toBe(true);
    const detail = await as('owner').query(api.groups.queries.detail, { groupId });
    expect(detail?.members.find((member) => member.id === ids.late)?.joinedAt).toEqual(
      expect.any(Number),
    );

    await expect(
      as('member').mutation(api.groups.mutations.addMembersToExpenses, {
        groupId,
        expenseIds: [expenseId],
        userIds: [ids.late],
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    expect(
      await as('admin').mutation(api.groups.mutations.addMembersToExpenses, {
        groupId,
        expenseIds: [expenseId],
        userIds: [ids.late],
      }),
    ).toBe(1);
    const rows = await t.run((ctx) =>
      ctx.db
        .query('expenseParticipants')
        .withIndex('by_transaction', (q) => q.eq('transactionId', expenseId))
        .collect(),
    );
    expect(rows.map((row) => [row.userId, row.amountMinor])).toEqual([
      [ids.owner, 300n],
      [ids.member, 300n],
      [ids.late, 300n],
    ]);
    expect(await t.run((ctx) => ctx.db.get(expenseId))).toMatchObject({ version: 2 });
    const lateNotices = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_createdAt', (q) => q.eq('recipientId', ids.late))
        .collect(),
    );
    expect(lateNotices.map((item) => item.title)).toContain('Added to past expenses in Flat');
  });

  it('asks for a manual edit when an exact split gains a member', async () => {
    const { ids, as, accounts, groupId } = await setupGroup();
    const expenseId = await as('owner').mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId: accounts.owner,
      title: 'Tickets',
      amountMinor: 1000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: [
        { userId: ids.owner, amountMinor: 700n, method: 'exact', basisValue: '700' },
        { userId: ids.member, amountMinor: 300n, method: 'exact', basisValue: '300' },
      ],
    });
    await expect(
      as('owner').mutation(api.groups.mutations.addMembersToExpenses, {
        groupId,
        expenseIds: [expenseId],
        userIds: [ids.admin],
      }),
    ).rejects.toThrow('MANUAL_SPLIT_REQUIRED');
  });

  it('blocks leaving or removal until the balance is settled, then keeps history', async () => {
    const { t, ids, as, accounts, groupId, addExpense } = await setupGroup();
    await addExpense('owner', 'Snacks', 600n, [ids.owner, ids.member]);
    await expect(
      as('admin').mutation(api.groups.mutations.removeMember, {
        groupId,
        memberUserId: ids.member,
      }),
    ).rejects.toThrow('OUTSTANDING_BALANCE');
    await expect(
      as('member').mutation(api.groups.mutations.leaveGroup, { groupId }),
    ).rejects.toThrow('OUTSTANDING_BALANCE');
    await expect(
      as('owner').mutation(api.groups.mutations.leaveGroup, { groupId }),
    ).rejects.toThrow('OWNER_CANNOT_LEAVE');
    await as('member').mutation(api.settlements.mutations.create, {
      groupId,
      fromUserId: ids.member,
      toUserId: ids.owner,
      accountId: accounts.member,
      amountMinor: 300n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 2),
      clientMutationId: 'clear-before-leave',
    });
    await as('member').mutation(api.groups.mutations.leaveGroup, { groupId });
    const detail = await as('owner').query(api.groups.queries.detail, { groupId });
    expect(detail?.members.map((member) => member.id)).not.toContain(ids.member);
    expect(detail?.formerMembers).toMatchObject([{ id: ids.member, displayName: 'Member' }]);
    expect(await as('member').query(api.groups.queries.detail, { groupId })).toBeNull();
    const events = await t.run((ctx) => ctx.db.query('ledgerEvents').collect());
    expect(events.at(-1)).toMatchObject({ kind: 'member.left', entityId: String(ids.member) });
  });

  it('reports balances with a suggested plan to settle everyone', async () => {
    const { ids, as, groupId, addExpense } = await setupGroup();
    await addExpense('owner', 'Cab', 900n, [ids.owner, ids.admin, ids.member]);
    const view = await as('member').query(api.groups.queries.balances, { groupId });
    expect(view).toMatchObject({ currency: 'INR', status: 'ready' });
    expect(view?.members.map((row) => [row.userId, row.amountMinor])).toEqual([
      [ids.owner, 600n],
      [ids.admin, -300n],
      [ids.member, -300n],
    ]);
    expect(view?.transfers).toHaveLength(2);
    expect(await as('late').query(api.groups.queries.balances, { groupId })).toBeNull();
    expect(await as('owner').query(api.groups.queries.balances, { groupId: 'bad' })).toBeNull();
  });

  it('returns the audit trail of an expense to members only', async () => {
    const { ids, as, accounts, groupId, equal, addExpense } = await setupGroup();
    const expenseId = await addExpense('owner', 'Dinner', 900n, [ids.owner, ids.member]);
    await as('admin').mutation(api.groups.mutations.updateExpense, {
      transactionId: expenseId,
      accountId: accounts.owner,
      title: 'Team dinner',
      amountMinor: 1200n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: equal(1200n, [ids.owner, ids.member, ids.admin]),
      expectedVersion: 1,
    });
    await as('owner').mutation(api.groups.mutations.deleteExpense, {
      transactionId: expenseId,
      expectedVersion: 2,
    });
    // Another expense's events must not leak into this history.
    await addExpense('member', 'Taxi', 300n, [ids.owner, ids.member]);
    const history = await as('member').query(api.groups.queries.expenseHistory, {
      transactionId: expenseId,
    });
    expect(history?.map((event) => [event.kind, event.actorName, event.version])).toEqual([
      ['expense.created', 'Owner', 1],
      ['expense.updated', 'Admin', 2],
      ['expense.deleted', 'Owner', 3],
    ]);
    expect(history?.[1]).toMatchObject({
      summary: 'Team dinner',
      balanceDeltas: { [ids.owner]: '350', [ids.member]: '50', [ids.admin]: '-400' },
    });
    expect(
      await as('late').query(api.groups.queries.expenseHistory, { transactionId: expenseId }),
    ).toBeNull();
    expect(
      await as('owner').query(api.groups.queries.expenseHistory, { transactionId: 'bad' }),
    ).toBeNull();
    expect(
      await as('owner').query(api.groups.queries.expenseHistory, {
        transactionId: String(groupId),
      }),
    ).toBeNull();
  });
});
