import { mutation } from '../_generated/server';
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
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'budget.create');
    if (replay.found) {
      const previousId = ctx.db.normalizeId('budgets', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const name = args.name.trim();
    assertPositiveAmount(args.amountMinor);
    if (!name || args.endAt <= args.startAt) throw new Error('INVALID_BUDGET');
    assertCurrency(args.currency);
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

export const archive = mutation({
  args: { budgetId: v.id('budgets'), clientMutationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'budget.archive');
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
