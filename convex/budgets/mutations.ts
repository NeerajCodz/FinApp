import { mutation, type MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { publishMutationResult, replayMutationResult } from '../sync/common';

const period = v.union(
  v.literal('monthly'),
  v.literal('category'),
  v.literal('account'),
  v.literal('custom'),
);

function assertBudgetMetadata(args: { icon?: string | null; alertThreshold?: number | null }) {
  if (
    (args.icon !== undefined && args.icon !== null && (!args.icon || args.icon.length > 80)) ||
    (args.alertThreshold !== undefined && args.alertThreshold !== null &&
      (!Number.isFinite(args.alertThreshold) || args.alertThreshold < 0 || args.alertThreshold > 100))
  ) throw new Error('INVALID_BUDGET');
}

async function assertBudgetAccounts(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  currency: string,
  accountIds: readonly string[] | undefined,
) {
  for (const value of accountIds ?? []) {
    const accountId = ctx.db.normalizeId('accounts', value);
    const account = accountId ? await ctx.db.get(accountId) : null;
    if (!account || account.ownerId !== ownerId || account.archivedAt !== undefined)
      throw new Error('INSUFFICIENT_PERMISSION');
    if (account.currency !== currency) throw new Error('CURRENCY_MISMATCH');
  }
}

export const create = mutation({
  args: {
    name: v.string(),
    amountMinor: v.int64(),
    currency: v.string(),
    period,
    categoryId: v.optional(v.id('categories')),
    accountId: v.optional(v.id('accounts')),
    startAt: v.number(),
    endAt: v.number(),
    icon: v.optional(v.string()),
    alertThreshold: v.optional(v.number()),
    notes: v.optional(v.string()),
    includeInAnalytics: v.optional(v.boolean()),
    accountIds: v.optional(v.array(v.string())),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'budget.create',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('budgets', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const name = args.name.trim();
    assertPositiveAmount(args.amountMinor);
    if (!name || args.endAt <= args.startAt) throw new Error('INVALID_BUDGET');
    assertCurrency(args.currency);
    assertBudgetMetadata(args);
    await assertBudgetAccounts(ctx, user._id, args.currency, args.accountIds);
    if (
      (args.period === 'category') !== Boolean(args.categoryId) ||
      (args.period === 'account') !== Boolean(args.accountId)
    )
      throw new Error('INVALID_BUDGET_SCOPE');

    if (args.categoryId) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
        throw new Error('INSUFFICIENT_PERMISSION');
    }
    if (args.accountId) {
      const account = await ctx.db.get(args.accountId);
      if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
        throw new Error('INSUFFICIENT_PERMISSION');
      if (account.currency !== args.currency) throw new Error('CURRENCY_MISMATCH');
    }

    const now = Date.now();
    const record = {
      ownerId: user._id,
      name,
      amountMinor: args.amountMinor,
      currency: args.currency,
      period: args.period,
      categoryId: args.categoryId,
      accountId: args.accountId,
      startAt: args.startAt,
      endAt: args.endAt,
      icon: args.icon,
      alertThreshold: args.alertThreshold,
      notes: args.notes,
      includeInAnalytics: args.includeInAnalytics,
      accountIds: args.accountIds,
      createdAt: now,
      updatedAt: now,
    };
    const budgetId = await ctx.db.insert('budgets', record);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'budget.create',
      budgetId,
      'budgets',
      String(budgetId),
      now,
      { ...record, _id: budgetId },
    );
    return budgetId;
  },
});

export const update = mutation({
  args: {
    budgetId: v.id('budgets'),
    name: v.string(),
    amountMinor: v.int64(),
    currency: v.string(),
    categoryId: v.id('categories'),
    startAt: v.number(),
    endAt: v.number(),
    icon: v.optional(v.union(v.string(), v.null())),
    alertThreshold: v.optional(v.union(v.number(), v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    includeInAnalytics: v.optional(v.boolean()),
    accountIds: v.optional(v.union(v.array(v.string()), v.null())),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'budget.update',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('budgets', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const budget = await ctx.db.get(args.budgetId);
    if (!budget) throw new Error('BUDGET_NOT_FOUND');
    if (budget.ownerId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    if (budget.archivedAt !== undefined) throw new Error('BUDGET_ARCHIVED');
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
      throw new Error('INSUFFICIENT_PERMISSION');
    const name = args.name.trim();
    assertPositiveAmount(args.amountMinor);
    assertCurrency(args.currency);
    if (!name || args.endAt <= args.startAt) throw new Error('INVALID_BUDGET');
    assertBudgetMetadata(args);
    await assertBudgetAccounts(ctx, user._id, args.currency,
      args.accountIds === null ? undefined : (args.accountIds ?? budget.accountIds));
    const now = Date.now();
    await ctx.db.patch(args.budgetId, {
      name,
      amountMinor: args.amountMinor,
      currency: args.currency,
      period: 'category',
      categoryId: args.categoryId,
      accountId: undefined,
      startAt: args.startAt,
      endAt: args.endAt,
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.alertThreshold !== undefined ? { alertThreshold: args.alertThreshold ?? undefined } : {}),
      ...(args.notes !== undefined ? { notes: args.notes ?? undefined } : {}),
      ...(args.includeInAnalytics !== undefined ? { includeInAnalytics: args.includeInAnalytics } : {}),
      ...(args.accountIds !== undefined ? { accountIds: args.accountIds ?? undefined } : {}),
      updatedAt: now,
    });
    const updated = await ctx.db.get(args.budgetId);
    if (!updated) throw new Error('BUDGET_NOT_FOUND');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'budget.update',
      args.budgetId,
      'budgets',
      String(args.budgetId),
      now,
      updated,
    );
    return args.budgetId;
  },
});

export const archive = mutation({
  args: { budgetId: v.id('budgets'), clientMutationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'budget.archive',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('budgets', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const { budgetId } = args;
    const budget = await ctx.db.get(budgetId);
    if (!budget) throw new Error('AUTH_REQUIRED');
    if (budget.ownerId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    if (budget.archivedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(budgetId, { archivedAt: now, updatedAt: now });
      await publishMutationResult(
        ctx,
        user._id,
        args.clientMutationId,
        'budget.archive',
        budgetId,
        'budgets',
        String(budgetId),
        now,
        { ...budget, archivedAt: now, updatedAt: now, _id: budgetId },
      );
    } else if (args.clientMutationId !== undefined) {
      await publishMutationResult(
        ctx,
        user._id,
        args.clientMutationId,
        'budget.archive',
        budgetId,
        'budgets',
        String(budgetId),
        budget.updatedAt,
        { ...budget, _id: budgetId },
      );
    }
    return budgetId;
  },
});
