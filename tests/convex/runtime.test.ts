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
