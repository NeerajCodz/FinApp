import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');
function identity(subject: string) {
  return { subject, email: `${subject}@example.com`, name: subject };
}
async function authenticatedUser(subject: string) {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', {
      emailVerificationTime: 1,
      identityId: subject,
      email: `${subject}@example.com`,
      displayName: subject,
    }),
  );
  return { t, userId, client: t.withIdentity(identity(subject)) };
}

describe('budget update mutation', () => {
  it('persists category-scoped fields and replays idempotently', async () => {
    const { client, t } = await authenticatedUser('budget-owner');
    const categoryId = await client.mutation(api.categories.mutations.create, { name: 'Food' });
    const budgetId = await client.mutation(api.budgets.mutations.create, {
      name: 'Meals',
      amountMinor: 5000n,
      currency: 'INR',
      period: 'category',
      categoryId,
      startAt: 100,
      endAt: 200,
      clientMutationId: 'budget-create-1',
    });
    const update = {
      budgetId,
      name: 'Dining',
      amountMinor: 7500n,
      currency: 'INR',
      categoryId,
      startAt: 200,
      endAt: 300,
      clientMutationId: 'budget-update-1',
    };
    await client.mutation(api.budgets.mutations.update, update);
    await client.mutation(api.budgets.mutations.update, { ...update, name: 'ignored replay' });
    const persisted = await client.query(api.budgets.queries.detail, { budgetId });
    expect(persisted).toMatchObject({
      name: 'Dining',
      amountMinor: 7500n,
      categoryId,
      period: 'category',
      startAt: 200,
      endAt: 300,
    });
    await client.mutation(api.budgets.mutations.archive, {
      budgetId,
      clientMutationId: 'budget-archive-1',
    });
    const archived = await t.run((ctx) => ctx.db.get(budgetId));
    expect(archived?.archivedAt).toEqual(expect.any(Number));
  });

  it('rejects non-owner updates and invalid budget boundaries', async () => {
    const owner = await authenticatedUser('budget-owner-two');
    const strangerIdentity = identity('budget-stranger');
    await owner.t.run((ctx) =>
      ctx.db.insert('users', {
        emailVerificationTime: 1,
        identityId: strangerIdentity.subject,
        email: strangerIdentity.email,
        displayName: strangerIdentity.name,
      }),
    );
    const stranger = owner.t.withIdentity(strangerIdentity);
    const categoryId = await owner.client.mutation(api.categories.mutations.create, {
      name: 'Food',
    });
    const budgetId = await owner.client.mutation(api.budgets.mutations.create, {
      name: 'Food',
      amountMinor: 5000n,
      currency: 'INR',
      period: 'category',
      categoryId,
      startAt: 100,
      endAt: 200,
      clientMutationId: 'budget-create-2',
    });
    const valid = {
      budgetId,
      name: 'Food',
      amountMinor: 6000n,
      currency: 'INR',
      categoryId,
      startAt: 200,
      endAt: 300,
    };
    await expect(
      stranger.mutation(api.budgets.mutations.update, {
        ...valid,
        clientMutationId: 'foreign-update',
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await expect(
      owner.client.mutation(api.budgets.mutations.update, {
        ...valid,
        startAt: 300,
        endAt: 300,
        clientMutationId: 'invalid-range',
      }),
    ).rejects.toThrow('INVALID_BUDGET');
    await expect(
      owner.client.mutation(api.budgets.mutations.update, {
        ...valid,
        amountMinor: 0n,
        clientMutationId: 'invalid-amount',
      }),
    ).rejects.toThrow();
  });
});
