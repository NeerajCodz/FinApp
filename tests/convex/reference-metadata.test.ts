import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');
async function setup() {
  const t = convexTest(schema, modules);
  for (const subject of ['metadata-owner', 'metadata-other']) {
    await t.run((ctx) => ctx.db.insert('users', {
      identityId: subject, email: `${subject}@example.com`, emailVerificationTime: 1,
      defaultCurrency: 'USD',
    }));
  }
  const owner = t.withIdentity({ subject: 'metadata-owner' });
  const other = t.withIdentity({ subject: 'metadata-other' });
  return { t, owner, other };
}
const accountDraft = {
  name: 'Savings', type: 'bank' as const, currency: 'USD',
  openingBalanceMinor: 0n, isIncludedInTotal: true,
};
const goalDraft = { name: 'Trip', targetAmountMinor: 100000n, currency: 'USD' };
const budgetDraft = {
  name: 'Food', amountMinor: 10000n, currency: 'USD', period: 'category' as const,
  startAt: 100, endAt: 200,
};

describe('reference form persistence', () => {
  it('preserves omitted account/category metadata and explicitly clears optional fields', async () => {
    const { t, owner } = await setup();
    const accountId = await owner.mutation(api.accounts.mutations.create, {
      ...accountDraft, notes: 'Emergency savings', provider: 'Credit union',
      accountNumber: '123456789', openedAt: 42, includeInAnalytics: false,
    });
    await owner.mutation(api.accounts.mutations.updateDetails, { ...accountDraft, accountId });
    expect(await t.run((ctx) => ctx.db.get(accountId))).toMatchObject({
      notes: 'Emergency savings', provider: 'Credit union', accountNumber: '123456789',
      openedAt: 42, includeInAnalytics: false,
    });
    await owner.mutation(api.accounts.mutations.updateDetails, {
      ...accountDraft, accountId, notes: null, provider: null, accountNumber: null,
      openedAt: null, includeInAnalytics: true,
    });
    const cleared = await t.run((ctx) => ctx.db.get(accountId));
    expect(cleared?.notes).toBeUndefined();
    expect(cleared?.provider).toBeUndefined();
    expect(cleared?.accountNumber).toBeUndefined();
    expect(cleared?.openedAt).toBeUndefined();
    expect(cleared?.includeInAnalytics).toBe(true);
    const categoryId = await owner.mutation(api.categories.mutations.create, {
      name: 'Food', notes: 'Groceries only', includeInBudgets: false,
      monthlyLimitMinor: 5000n, limitCurrency: 'USD',
    });
    await owner.mutation(api.categories.mutations.setPreferences, {
      categoryId, kind: 'expense', color: null,
    });
    expect(await t.run((ctx) => ctx.db.get(categoryId))).toMatchObject({
      notes: 'Groceries only', includeInBudgets: false, monthlyLimitMinor: 5000n,
      limitCurrency: 'USD',
    });
    await owner.mutation(api.categories.mutations.setPreferences, {
      categoryId, kind: 'expense', color: null, notes: null, includeInBudgets: true,
    });
    expect((await t.run((ctx) => ctx.db.get(categoryId)))?.notes).toBeUndefined();
  });

  it('preserves goal plans on legacy updates, clears optional metadata, and replays receipts', async () => {
    const { t, owner } = await setup();
    const accountId = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const goalId = await owner.mutation(api.goals.mutations.create, {
      ...goalDraft, goalType: 'travel', monthlyContributionMinor: 5000n, accountId,
      priority: 'high', notes: 'Summer trip', reminderFrequency: 'monthly',
      clientMutationId: 'metadata-goal-create',
    });
    await owner.mutation(api.goals.mutations.update, {
      goalId, name: 'Long trip', targetAmountMinor: 150000n, clientMutationId: 'metadata-goal-update',
    });
    expect(await t.run((ctx) => ctx.db.get(goalId))).toMatchObject({
      name: 'Long trip', goalType: 'travel', monthlyContributionMinor: 5000n, accountId,
      priority: 'high', notes: 'Summer trip', reminderFrequency: 'monthly',
    });
    const clear = {
      goalId, name: 'Trip', targetAmountMinor: 100000n, goalType: null,
      monthlyContributionMinor: null, accountId: null, notes: null,
      clientMutationId: 'metadata-goal-clear',
    };
    await owner.mutation(api.goals.mutations.update, clear);
    await owner.mutation(api.goals.mutations.update, { ...clear, notes: 'Replay must not restore' });
    const goal = await t.run((ctx) => ctx.db.get(goalId));
    expect(goal?.goalType).toBeUndefined();
    expect(goal?.monthlyContributionMinor).toBeUndefined();
    expect(goal?.accountId).toBeUndefined();
    expect(goal?.notes).toBeUndefined();
    expect(goal?.reminderFrequency).toBe('monthly');
  });

  it('rejects foreign, archived, mismatched and currency-breaking linked accounts', async () => {
    const { t, owner, other } = await setup();
    const foreign = await other.mutation(api.accounts.mutations.create, accountDraft);
    const euro = await owner.mutation(api.accounts.mutations.create, { ...accountDraft, currency: 'EUR' });
    const archived = await owner.mutation(api.accounts.mutations.create, accountDraft);
    await owner.mutation(api.accounts.mutations.archive, { accountId: archived });
    const categoryId = await owner.mutation(api.categories.mutations.create, { name: 'Food' });
    for (const [accountId, error] of [[foreign, 'INSUFFICIENT_PERMISSION'], [euro, 'CURRENCY_MISMATCH'], [archived, 'INSUFFICIENT_PERMISSION']] as const) {
      await expect(owner.mutation(api.goals.mutations.create, {
        ...goalDraft, accountId, clientMutationId: `goal-invalid-${accountId}`,
      })).rejects.toThrow(error);
      await expect(owner.mutation(api.budgets.mutations.create, {
        ...budgetDraft, categoryId, accountIds: [accountId],
      })).rejects.toThrow(error);
    }
    const accountId = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const goalId = await owner.mutation(api.goals.mutations.create, {
      ...goalDraft, accountId, clientMutationId: 'linked-goal',
    });
    await expect(owner.mutation(api.accounts.mutations.updateDetails, {
      ...accountDraft, accountId, currency: 'EUR',
    })).rejects.toThrow('ACCOUNT_CURRENCY_IN_USE');
    await expect(other.mutation(api.goals.mutations.update, {
      goalId, name: 'Stolen', targetAmountMinor: 1n, accountId: null, clientMutationId: 'foreign-goal-update',
    })).rejects.toThrow('INVALID_GOAL');
    expect((await t.run((ctx) => ctx.db.get(goalId)))?.accountId).toBe(accountId);
  });

  it('consumes budget account scope and category exclusions, preserving/clearing metadata', async () => {
    const { t, owner } = await setup();
    const accountId = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const otherAccount = await owner.mutation(api.accounts.mutations.create, { ...accountDraft, name: 'Cash' });
    const categoryId = await owner.mutation(api.categories.mutations.create, { name: 'Food' });
    const excludedCategory = await owner.mutation(api.categories.mutations.create, {
      name: 'Excluded', includeInBudgets: false,
    });
    for (const [source, category, amountMinor] of [[accountId, categoryId, 500n], [otherAccount, categoryId, 700n], [accountId, excludedCategory, 900n]] as const) {
      await owner.mutation(api.transactions.mutations.create, {
        accountId: source, categoryId: category, type: 'expense', title: 'Meal', amountMinor,
        currency: 'USD', occurredAt: 150, clientMutationId: `spend-${source}-${category}`,
      });
    }
    const budgetId = await owner.mutation(api.budgets.mutations.create, {
      ...budgetDraft, period: 'monthly', accountIds: [accountId], icon: 'wallet',
      alertThreshold: 0, notes: 'Selected accounts', includeInAnalytics: false,
    });
    expect(await owner.query(api.budgets.queries.detail, { budgetId })).toMatchObject({
      spentMinor: 500n, accountIds: [accountId], alertThreshold: 0, includeInAnalytics: false,
    });
    const update = { ...budgetDraft, categoryId, budgetId };
    await owner.mutation(api.budgets.mutations.update, update);
    expect(await t.run((ctx) => ctx.db.get(budgetId))).toMatchObject({
      accountIds: [accountId], icon: 'wallet', notes: 'Selected accounts', alertThreshold: 0,
    });
    await expect(owner.mutation(api.budgets.mutations.update, {
      ...update, currency: 'EUR',
    })).rejects.toThrow('CURRENCY_MISMATCH');
    for (const alertThreshold of [-1, 101, Number.NaN, Infinity]) {
      await expect(owner.mutation(api.budgets.mutations.update, {
        ...update, alertThreshold,
      })).rejects.toThrow('INVALID_BUDGET');
    }
    await owner.mutation(api.budgets.mutations.update, {
      ...update, icon: null, notes: null, alertThreshold: null, accountIds: null,
    });
    const cleared = await owner.query(api.budgets.queries.detail, { budgetId });
    expect(cleared?.spentMinor).toBe(1200n);
    expect(cleared?.icon).toBeUndefined();
    expect(cleared?.notes).toBeUndefined();
    expect(cleared?.alertThreshold).toBeUndefined();
    expect(cleared?.accountIds).toBeUndefined();
  });

  it('excludes account analytics transactions in both periods while legacy accounts remain included', async () => {
    const { owner } = await setup();
    const included = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const excluded = await owner.mutation(api.accounts.mutations.create, {
      ...accountDraft, includeInAnalytics: false,
    });
    const startAt = Date.UTC(2026, 0, 12);
    const week = 7 * 24 * 60 * 60 * 1000;
    for (const [accountId, amountMinor] of [[included, 300n], [excluded, 900n]] as const) {
      for (const occurredAt of [startAt + 1000, startAt - week + 1000]) {
        await owner.mutation(api.transactions.mutations.create, {
          accountId, amountMinor, occurredAt, type: 'expense', currency: 'USD', title: 'Meal',
          clientMutationId: `analytics-${accountId}-${occurredAt}`,
        });
      }
    }
    const summary = await owner.query(api.analytics.queries.summary, {
      period: 'week', startAt, endAt: startAt + week, previousStartAt: startAt - week,
    });
    expect(summary?.spentMinor).toBe(300n);
    expect(summary?.previousSpentMinor).toBe(300n);
  });

  it('uses configured budget notifications without counting excluded categories or other accounts', async () => {
    const { t, owner } = await setup();
    const accountId = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const otherAccount = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const categoryId = await owner.mutation(api.categories.mutations.create, { name: 'Included' });
    const excluded = await owner.mutation(api.categories.mutations.create, {
      name: 'Excluded', includeInBudgets: false,
    });
    const budgetId = await owner.mutation(api.budgets.mutations.create, {
      ...budgetDraft, period: 'monthly', amountMinor: 1000n,
      accountIds: [accountId], alertThreshold: 25.5,
    });
    for (const [source, category, amountMinor, clientMutationId] of [
      [otherAccount, categoryId, 900n, 'outside-account'],
      [accountId, excluded, 900n, 'outside-category'],
      [accountId, categoryId, 254n, 'before-threshold'],
    ] as const) {
      await owner.mutation(api.transactions.mutations.create, {
        accountId: source, categoryId: category, amountMinor, clientMutationId,
        type: 'expense', title: 'Meal', currency: 'USD', occurredAt: 150,
      });
    }
    expect((await t.run((ctx) => ctx.db.query('notifications').collect()))
      .filter((notification) => notification.eventKey?.startsWith(`budget:${budgetId}:`))).toEqual([]);
    const crossing = {
      accountId, categoryId, amountMinor: 1n, clientMutationId: 'cross-threshold',
      type: 'expense' as const, title: 'Meal', currency: 'USD', occurredAt: 150,
    };
    await owner.mutation(api.transactions.mutations.create, crossing);
    await owner.mutation(api.transactions.mutations.create, crossing);
    const alerts = (await t.run((ctx) => ctx.db.query('notifications').collect()))
      .filter((notification) => notification.eventKey?.startsWith(`budget:${budgetId}:`));
    expect(alerts.map((notification) => notification.eventKey)).toEqual([`budget:${budgetId}:100:25.5`]);
  });

  it('preserves and clears group metadata, and validates expense category ownership', async () => {
    const { t, owner, other } = await setup();
    const accountId = await owner.mutation(api.accounts.mutations.create, accountDraft);
    const categoryId = await owner.mutation(api.categories.mutations.create, { name: 'Food' });
    const foreign = await other.mutation(api.categories.mutations.create, { name: 'Foreign' });
    const groupId = await owner.mutation(api.groups.mutations.create, {
      name: 'Trip', currency: 'USD', memberUsernames: [], description: 'Summer holiday',
      groupType: 'trip', purpose: 'Travel', location: 'Paris', startAt: 100, endAt: 200,
    });
    await owner.mutation(api.groups.mutations.updateSettings, { groupId, name: 'Summer trip' });
    expect(await t.run((ctx) => ctx.db.get(groupId))).toMatchObject({
      description: 'Summer holiday', groupType: 'trip', purpose: 'Travel',
      location: 'Paris', startAt: 100, endAt: 200,
    });
    const members = await t.run((ctx) => ctx.db.query('groupMembers').collect());
    const expense = {
      groupId, accountId, title: 'Dinner', amountMinor: 100n, currency: 'USD', occurredAt: 150,
      merchant: 'Cafe', note: 'Shared dinner',
      participants: [{ userId: members[0]!.userId, amountMinor: 100n, method: 'equal' as const }],
    };
    await expect(owner.mutation(api.groups.mutations.addExpense, {
      ...expense, categoryId: foreign,
    })).rejects.toThrow('INVALID_CATEGORY');
    const transactionId = await owner.mutation(api.groups.mutations.addExpense, { ...expense, categoryId });
    expect(await t.run((ctx) => ctx.db.get(transactionId))).toMatchObject({
      categoryId, merchant: 'Cafe', note: 'Shared dinner', occurredAt: 150,
    });
    await owner.mutation(api.groups.mutations.updateSettings, {
      groupId, description: null, groupType: null, purpose: null, location: null, startAt: null, endAt: null,
    });
    const group = await t.run((ctx) => ctx.db.get(groupId));
    expect(group?.description).toBeUndefined();
    expect(group?.groupType).toBeUndefined();
    expect(group?.purpose).toBeUndefined();
    expect(group?.location).toBeUndefined();
    expect(group?.startAt).toBeUndefined();
    expect(group?.endAt).toBeUndefined();
    await expect(owner.mutation(api.groups.mutations.updateSettings, {
      groupId, description: 'x'.repeat(201),
    })).rejects.toThrow('INVALID_GROUP');
  });
});
