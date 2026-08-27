import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');
const identity = { subject: 'runtime-user', email: 'runtime@example.com', name: 'Runtime User' };

describe('Convex public runtime functions', () => {
  it('requires authentication for every public query', async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.accounts.queries.list, {})).rejects.toThrow('AUTH_REQUIRED');
    await expect(t.query(api.categories.queries.list, {})).rejects.toThrow('AUTH_REQUIRED');
  });

  it('runs the account and category mutation lifecycles', async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
      }),
    );
    const authenticated = t.withIdentity(identity);

    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'HDFC',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 125000n,
      isIncludedInTotal: true,
    });
    expect(await authenticated.query(api.accounts.queries.list, {})).toMatchObject([
      { id: accountId, name: 'HDFC', currency: 'INR', balanceMinor: 125000n },
    ]);

    const categoryId = await authenticated.mutation(api.categories.mutations.create, {
      name: 'Food',
      kind: 'expense',
    });
    expect(await authenticated.query(api.categories.queries.list, {})).toMatchObject([
      { _id: categoryId, name: 'Food', kind: 'expense', isSystem: false },
    ]);

    expect(await authenticated.mutation(api.categories.mutations.archive, { categoryId })).toBe(
      categoryId,
    );
    const categories = await authenticated.query(api.categories.queries.list, {});
    expect(categories.find((category) => category._id === categoryId)?.archivedAt).toEqual(
      expect.any(Number),
    );

    expect(await authenticated.mutation(api.accounts.mutations.archive, { accountId })).toBe(
      accountId,
    );
    expect(await authenticated.query(api.accounts.queries.list, {})).toEqual([]);
  });

  it('persists a transaction and rejects replayed client mutation IDs', async () => {
    const t = convexTest(schema, modules);
    await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
      }),
    );
    const authenticated = t.withIdentity(identity);
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Cash',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });

    const input = {
      accountId,
      type: 'expense' as const,
      amountMinor: 42000n,
      currency: 'INR',
      title: 'Dinner',
      merchant: 'Local kitchen',
      occurredAt: Date.UTC(2026, 7, 27),
      clientMutationId: 'runtime-transaction-1',
    };
    const transactionId = await authenticated.mutation(api.transactions.mutations.create, input);
    const transferAccountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Savings',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    const transferId = await authenticated.mutation(api.transactions.mutations.create, {
      accountId,
      transferAccountId,
      type: 'transfer',
      amountMinor: 10000n,
      currency: 'INR',
      title: 'Move to savings',
      occurredAt: Date.UTC(2026, 7, 27),
      clientMutationId: 'runtime-transfer-1',
    });
    expect(await t.run((ctx) => ctx.db.get(transferId))).toMatchObject({
      accountId,
      transferAccountId,
      type: 'transfer',
      amountMinor: 10000n,
      status: 'posted',
    });
    expect(transactionId).toEqual(expect.any(String));
    await expect(authenticated.mutation(api.transactions.mutations.create, input)).rejects.toThrow(
      'DUPLICATE_MUTATION',
    );

    const transaction = await t.run((ctx) => ctx.db.get(transactionId));
    expect(transaction).toMatchObject({
      ownerId: expect.any(String),
      accountId,
      type: 'expense',
      amountMinor: 42000n,
      status: 'posted',
      title: 'Dinner',
    });
  });
  it('updates profile identity and discovers tagged users', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert('userSettings', {
        userId,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'dark',
        notificationPreferences: {},
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        updatedAt: Date.now(),
      }),
    );
    const otherUserId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: 'other-runtime-user',
        email: 'rahul@example.com',
        name: 'Rahul',
        username: 'rahul_42',
      }),
    );
    const authenticated = t.withIdentity(identity);

    const updated = await authenticated.mutation(api.users.mutations.update, {
      username: '@Neeraj_27',
      phone: '+91 (98765) 43210',
      defaultCurrency: 'USD',
    });
    expect(updated).toMatchObject({
      _id: userId,
      username: 'neeraj_27',
      phone: '+919876543210',
      defaultCurrency: 'USD',
    });
    expect(await authenticated.query(api.users.queries.current, {})).toMatchObject({
      username: 'neeraj_27',
      phone: '+919876543210',
      defaultCurrency: 'USD',
    });
    expect(await t.run((ctx) => ctx.db.get(userId))).toMatchObject({
      defaultCurrency: 'USD',
    });
    expect(await authenticated.query(api.users.queries.search, { query: '@rah' })).toEqual([
      {
        id: otherUserId,
        displayName: 'Rahul',
        username: 'rahul_42',
        image: undefined,
      },
    ]);

    await expect(
      authenticated.mutation(api.users.mutations.update, { username: '@rahul_42' }),
    ).rejects.toThrow('USERNAME_TAKEN');
  });
  it('creates username groups and persists shared expenses', async () => {
    const t = convexTest(schema, modules);
    const ownerId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: identity.subject,
        email: identity.email,
        name: identity.name,
        username: 'neeraj',
      }),
    );
    const memberId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: 'group-member',
        email: 'rahul@example.com',
        name: 'Rahul',
        username: 'rahul_42',
      }),
    );
    const authenticated = t.withIdentity(identity);
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'HDFC',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 100000n,
      isIncludedInTotal: true,
    });
    const groupId = await authenticated.mutation(api.groups.mutations.create, {
      name: 'Goa Trip',
      currency: 'INR',
      memberUsernames: ['@rahul_42'],
    });
    expect(await authenticated.query(api.groups.queries.list, {})).toMatchObject([
      { _id: groupId, name: 'Goa Trip', currency: 'INR', ownerId },
    ]);
    const transactionId = await authenticated.mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId,
      title: 'Hotel',
      amountMinor: 240000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 7, 27),
      participantUsernames: ['@rahul_42'],
    });
    const detail = await authenticated.query(api.groups.queries.detail, { groupId });
    expect(detail).toMatchObject({
      _id: groupId,
      members: [
        { id: ownerId, role: 'owner' },
        { id: memberId, username: 'rahul_42', role: 'member' },
      ],
      expenses: [{ _id: transactionId, title: 'Hotel', amountMinor: 240000n }],
    });
    expect(
      await authenticated.query(api.groups.queries.personTimeline, { username: '@rahul_42' }),
    ).toMatchObject([{ id: transactionId, title: 'Hotel', amountMinor: 240000n }]);
  });

  it('rejects mutation attempts without an authenticated identity', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.accounts.mutations.create, {
        name: 'Cash',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
      }),
    ).rejects.toThrow('AUTH_REQUIRED');
  });
});
