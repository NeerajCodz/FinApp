import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import {
  defaultNotificationPreferences,
  notificationRoute,
} from '../../convex/notifications/domain';
import {
  categorySpending,
  limitAlertFor,
  limitStatus,
  planBudgetMigration,
} from '../../convex/categories/limits';
import { assistantTools } from '../../convex/ai/assistantTools';
import { manageTools } from '../../convex/ai/manageTools';
import { FINAI_SCOPE_TOOLS } from '../../convex/shared/finaiSettings';
import { financeTools } from '@finapp/mcp/tools/finance';

const modules = import.meta.glob('../../convex/**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const make = async (key: string) => {
    const userId = await t.run((ctx) =>
      ctx.db.insert('users', {
        identityId: key,
        email: `${key}@example.com`,
        emailVerificationTime: 1,
        displayName: key,
        defaultCurrency: 'INR',
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
  const owner = await make('limit-owner');
  const accountId = await owner.as.mutation(api.accounts.mutations.create, {
    name: 'Wallet',
    type: 'cash',
    currency: 'INR',
    openingBalanceMinor: 0n,
    isIncludedInTotal: true,
  });
  const food = await owner.as.mutation(api.categories.mutations.create, { name: 'Food' });
  const travel = await owner.as.mutation(api.categories.mutations.create, { name: 'Travel' });
  let counter = 0;
  const spend = (categoryId: Id<'categories'>, amountMinor: bigint, occurredAt = Date.now()) =>
    owner.as.mutation(api.transactions.mutations.create, {
      accountId,
      categoryId,
      type: 'expense',
      amountMinor,
      currency: 'INR',
      title: 'Spend',
      occurredAt,
      clientMutationId: `spend-${(counter += 1)}`,
    });
  const notifications = () =>
    t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_createdAt', (q) => q.eq('recipientId', owner.userId))
        .collect(),
    );
  const insertBudget = (fields: {
    name: string;
    amountMinor: bigint;
    categoryId?: string;
    period?: 'monthly' | 'category';
    alertThreshold?: number;
    archivedAt?: number;
  }) =>
    t.run((ctx) =>
      ctx.db.insert('budgets', {
        ownerId: owner.userId,
        currency: 'INR',
        period: fields.categoryId ? 'category' : 'monthly',
        startAt: 0,
        endAt: 1,
        createdAt: 1,
        updatedAt: 1,
        ...fields,
      }),
    );
  return { t, make, owner, accountId, food, travel, spend, notifications, insertBudget };
}

describe('category limit domain', () => {
  it('grades usage and picks the alert an expense triggers', () => {
    expect(limitStatus(50n, 100n)).toBe('normal');
    expect(limitStatus(85n, 100n)).toBe('warning');
    expect(limitStatus(95n, 100n)).toBe('near-limit');
    expect(limitStatus(101n, 100n)).toBe('exceeded');
    expect(limitAlertFor(80n, 10n, 100n)).toBe(80);
    expect(limitAlertFor(79n, 10n, 100n)).toBeNull();
    expect(limitAlertFor(100n, 30n, 100n)).toBe(100);
    expect(limitAlertFor(95n, 5n, 100n)).toBeNull();
    expect(limitAlertFor(60n, 10n, 100n, 55)).toBe(55);
  });

  it('counts posted expenses of the category in the limit currency and window', () => {
    const base = {
      type: 'expense',
      status: 'posted',
      currency: 'INR',
      occurredAt: 150,
      categoryId: 'food',
      amountMinor: 100n,
    };
    const rows = [
      base,
      { ...base, categoryId: 'food-client' },
      { ...base, type: 'income' },
      { ...base, status: 'pending' },
      { ...base, deletedAt: 1 },
      { ...base, currency: 'USD' },
      { ...base, occurredAt: 200 },
      { ...base, categoryId: 'travel' },
    ];
    expect(
      categorySpending(rows, {
        categoryIds: ['food', 'food-client'],
        currency: 'INR',
        startAt: 100,
        endAt: 200,
      }),
    ).toBe(200n);
  });

  it('plans the budget migration', () => {
    const budget = {
      _id: 'b',
      name: 'Food',
      amountMinor: 500n,
      currency: 'INR',
      period: 'category',
    };
    const category = { _id: 'c' };
    expect(
      planBudgetMigration({ ...budget, categoryId: 'c', alertThreshold: 70 }, category),
    ).toEqual({
      action: 'set-limit',
      categoryId: 'c',
      monthlyLimitMinor: 500n,
      limitCurrency: 'INR',
      limitAlertPercent: 70,
    });
    expect(
      planBudgetMigration({ ...budget, categoryId: 'c' }, { _id: 'c', monthlyLimitMinor: 1n }),
    ).toMatchObject({ action: 'keep-category' });
    expect(planBudgetMigration(budget, null)).toMatchObject({ action: 'retire-overall' });
    expect(
      planBudgetMigration({ ...budget, categoryId: 'c' }, { _id: 'c', archivedAt: 1 }),
    ).toMatchObject({ action: 'retire-overall' });
    expect(planBudgetMigration({ ...budget, migratedAt: 1 }, category)).toMatchObject({
      action: 'skip',
    });
    expect(planBudgetMigration({ ...budget, archivedAt: 1 }, category)).toMatchObject({
      action: 'skip',
    });
    expect(
      planBudgetMigration({ ...budget, categoryId: 'c' }, category, {
        monthlyLimitMinor: 400n,
        limitCurrency: 'INR',
      }),
    ).toMatchObject({ action: 'set-limit', monthlyLimitMinor: 500n });
    expect(
      planBudgetMigration({ ...budget, categoryId: 'c' }, category, {
        monthlyLimitMinor: 900n,
        limitCurrency: 'INR',
      }),
    ).toMatchObject({ action: 'keep-category' });
  });

  it('routes limit alerts to the category and old budget alerts to Categories', () => {
    expect(notificationRoute({ type: 'budget', entityType: 'category', entityId: 'c1' })).toBe(
      '/category/c1',
    );
    expect(notificationRoute({ type: 'budget', entityType: 'budget', entityId: 'b1' })).toBe(
      '/categories',
    );
  });
});

describe('category limits', () => {
  it('sets, edits and removes a limit with its alert level', async () => {
    const { t, owner, food } = await setup();
    await owner.as.mutation(api.categories.mutations.setLimit, {
      categoryId: food,
      amountMinor: 10_000n,
      alertPercent: 70,
    });
    expect(await t.run((ctx) => ctx.db.get(food))).toMatchObject({
      monthlyLimitMinor: 10_000n,
      limitCurrency: 'INR',
      limitAlertPercent: 70,
    });
    await owner.as.mutation(api.categories.mutations.setLimit, {
      categoryId: food,
      amountMinor: 12_000n,
    });
    expect((await t.run((ctx) => ctx.db.get(food)))?.limitAlertPercent).toBe(70);
    for (const alertPercent of [0, 101, Number.NaN])
      await expect(
        owner.as.mutation(api.categories.mutations.setLimit, {
          categoryId: food,
          amountMinor: 12_000n,
          alertPercent,
        }),
      ).rejects.toThrow('INVALID_CATEGORY');
    await owner.as.mutation(api.categories.mutations.setLimit, {
      categoryId: food,
      amountMinor: null,
    });
    const cleared = await t.run((ctx) => ctx.db.get(food));
    expect(cleared?.monthlyLimitMinor).toBeUndefined();
    expect(cleared?.limitAlertPercent).toBeUndefined();
    const created = await owner.as.mutation(api.categories.mutations.create, {
      name: 'Fuel',
      monthlyLimitMinor: 5_000n,
      limitAlertPercent: 90,
    });
    expect(await owner.as.query(api.categories.queries.limits, {})).toMatchObject([
      { categoryId: created, limitMinor: 5_000n, alertPercent: 90, status: 'normal' },
    ]);
  });

  it('alerts once at the alert level and once at the limit, only for that category', async () => {
    const { owner, food, travel, spend, notifications } = await setup();
    await owner.as.mutation(api.categories.mutations.setLimit, {
      categoryId: food,
      amountMinor: 1_000n,
    });
    const alerts = async () =>
      (await notifications()).filter((row) => row.eventKey?.startsWith('category-limit:'));
    await spend(travel, 5_000n);
    await spend(food, 700n);
    expect(await alerts()).toEqual([]);
    await spend(food, 100n);
    await spend(food, 50n);
    expect((await alerts()).map((row) => row.title)).toEqual(['Food: 80% of limit used']);
    await spend(food, 200n);
    await spend(food, 10n);
    const rows = await alerts();
    expect(rows.map((row) => row.title)).toEqual([
      'Food: 80% of limit used',
      'Food: 100% of limit used',
    ]);
    expect(rows.every((row) => row.type === 'budget' && row.entityType === 'category')).toBe(true);
    expect(rows[0]?.entityId).toBe(String(food));
  });

  it('ignores expenses from earlier months and honours a custom alert level', async () => {
    const { owner, food, spend, notifications } = await setup();
    await owner.as.mutation(api.categories.mutations.setLimit, {
      categoryId: food,
      amountMinor: 1_000n,
      alertPercent: 50,
    });
    await spend(food, 900n, Date.now() - 40 * 86_400_000);
    const before = (await notifications()).filter((row) =>
      row.eventKey?.startsWith('category-limit:'),
    );
    expect(before).toEqual([]);
    await spend(food, 500n);
    const after = (await notifications()).filter((row) =>
      row.eventKey?.startsWith('category-limit:'),
    );
    expect(after.map((row) => row.title)).toEqual(['Food: 50% of limit used']);
  });
});

describe('budgets → category limits migration', () => {
  it('folds budgets into category limits idempotently and retires overall budgets', async () => {
    const { t, owner, food, travel, insertBudget, notifications } = await setup();
    const fuel = await owner.as.mutation(api.categories.mutations.create, {
      name: 'Fuel',
      monthlyLimitMinor: 9_000n,
    });
    const foodBudget = await insertBudget({
      name: 'Food',
      amountMinor: 4_000n,
      categoryId: String(food),
      alertThreshold: 75,
    });
    const biggerFood = await insertBudget({
      name: 'Food 2',
      amountMinor: 6_000n,
      categoryId: String(food),
    });
    const fuelBudget = await insertBudget({
      name: 'Fuel',
      amountMinor: 1_000n,
      categoryId: String(fuel),
    });
    const overall = await insertBudget({ name: 'Everything', amountMinor: 50_000n });
    const trashed = await insertBudget({
      name: 'Travel',
      amountMinor: 3_000n,
      categoryId: String(travel),
      archivedAt: 5,
    });

    const first = await t.mutation(internal.migrations.foldBudgetsIntoCategoryLimits, {
      cursor: null,
    });
    expect(first).toMatchObject({ done: true, converted: 1, kept: 2, retired: 1, skipped: 1 });
    expect(await t.run((ctx) => ctx.db.get(food))).toMatchObject({
      monthlyLimitMinor: 6_000n,
      limitCurrency: 'INR',
    });
    expect((await t.run((ctx) => ctx.db.get(fuel)))?.monthlyLimitMinor).toBe(9_000n);
    expect((await t.run((ctx) => ctx.db.get(travel)))?.monthlyLimitMinor).toBeUndefined();
    for (const id of [foodBudget, biggerFood, fuelBudget, overall])
      expect((await t.run((ctx) => ctx.db.get(id)))?.migratedAt).toEqual(expect.any(Number));
    expect((await t.run((ctx) => ctx.db.get(trashed)))?.migratedAt).toBeUndefined();
    const retiredNotice = (await notifications()).filter((row) =>
      row.eventKey?.startsWith('budget-retired:'),
    );
    expect(retiredNotice.map((row) => row.title)).toEqual([
      'Budget “Everything” moved to categories',
    ]);

    const second = await t.mutation(internal.migrations.foldBudgetsIntoCategoryLimits, {
      cursor: null,
    });
    expect(second).toMatchObject({ done: true, converted: 0, kept: 0, retired: 0, skipped: 5 });
    expect((await t.run((ctx) => ctx.db.get(food)))?.monthlyLimitMinor).toBe(6_000n);
    expect(
      (await notifications()).filter((row) => row.eventKey?.startsWith('budget-retired:')),
    ).toHaveLength(1);

    // A budget left in Trash comes back as its category's limit.
    expect((await owner.as.query(api.trash.list, { kind: 'budget' })).items).toHaveLength(1);
    await owner.as.mutation(api.trash.restore, { kind: 'budget', id: String(trashed) });
    expect(await t.run((ctx) => ctx.db.get(travel))).toMatchObject({
      monthlyLimitMinor: 3_000n,
    });
    const restored = await t.run((ctx) => ctx.db.get(trashed));
    expect(restored?.archivedAt).toBeUndefined();
    expect(restored?.migratedAt).toEqual(expect.any(Number));
    expect((await owner.as.query(api.trash.list, { kind: 'budget' })).items).toHaveLength(0);
  });
});

describe('FinAI category limit tools', () => {
  const tool = (name: string) =>
    [...assistantTools, ...manageTools].find((candidate) => candidate.name === name)!;

  it('replaces the budget tools', () => {
    const names = [...assistantTools, ...manageTools].map((candidate) => candidate.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_category_limits', 'propose_category_limit']),
    );
    expect(names.filter((name) => name.includes('budget'))).toEqual([]);
    expect(FINAI_SCOPE_TOOLS.planning).toEqual(['list_category_limits', 'list_goals']);
  });

  it('lists limits and proposes a confirmed limit change', async () => {
    const { t, owner, food, spend } = await setup();
    const run = {
      runQuery: (ref: never, args: never) => owner.as.query(ref, args),
      runMutation: (ref: never, args: never) => owner.as.mutation(ref, args),
    };
    const ctx = {
      run: run as never,
      userId: owner.userId,
      scope: { type: 'assistant' as const, id: 'conversation' },
      messageId: 'message-1',
      defaultCurrency: 'INR',
      timeZone: 'UTC',
    };
    const proposed = await tool('propose_category_limit').run(ctx, {
      categoryId: String(food),
      amount: '50',
      alertAt: 60,
    });
    expect(proposed.data).toMatchObject({ status: 'awaiting_confirmation' });
    const actionId = (proposed.data as { actionId: Id<'finaiActions'> }).actionId;
    const action = await t.run((ctx) => ctx.db.get(actionId));
    expect(action?.kind).toBe('category.limit');
    const confirmed = await owner.as.action(api.ai.actions.confirm, { actionId });
    expect(confirmed.status).toBe('done');
    expect(await t.run((ctx) => ctx.db.get(food))).toMatchObject({
      monthlyLimitMinor: 5_000n,
      limitAlertPercent: 60,
    });

    await spend(food, 1_000n);
    const listed = await tool('list_category_limits').run(ctx, {});
    expect(listed.data).toMatchObject({
      items: [{ categoryId: food, limitMinor: 5_000n, spentMinor: 1_000n, percentUsed: 20 }],
    });

    const removal = await tool('propose_category_limit').run(
      { ...ctx, messageId: 'message-2' },
      { categoryId: String(food), amount: '0' },
    );
    const removalId = (removal.data as { actionId: Id<'finaiActions'> }).actionId;
    expect((await owner.as.action(api.ai.actions.confirm, { actionId: removalId })).status).toBe(
      'done',
    );
    expect((await t.run((ctx) => ctx.db.get(food)))?.monthlyLimitMinor).toBeUndefined();
  });
});

describe('MCP category limit tools', () => {
  it('lists limits and sets one with an alert level, with no budget tools left', async () => {
    const { t, owner, food } = await setup();
    const client = {
      query: (ref: never, args: never) => owner.as.query(ref, args),
      mutation: (ref: never, args: never) => owner.as.mutation(ref, args),
    };
    const tools = financeTools(client as never);
    expect(tools.filter((candidate) => candidate.name.includes('budget'))).toEqual([]);
    const byName = (name: string) => tools.find((candidate) => candidate.name === name)!;
    await byName('finapp.finance.categories.set_limit').run({
      categoryId: String(food),
      amountMinor: 20_000n,
      alertPercent: 85,
    } as never);
    expect(await t.run((ctx) => ctx.db.get(food))).toMatchObject({
      monthlyLimitMinor: 20_000n,
      limitAlertPercent: 85,
    });
    const listed = (await byName('finapp.finance.category_limits.list').run({} as never)) as {
      items: { categoryId: string; alertPercent: number }[];
    };
    expect(listed.items).toMatchObject([{ categoryId: food, alertPercent: 85 }]);
    const overview = (await byName('finapp.finance.overview').run({} as never)) as {
      categoryLimits: { categoryId: string; limitMinor: bigint }[];
    };
    expect(overview.categoryLimits).toMatchObject([{ categoryId: food, limitMinor: 20_000n }]);
  });
});
