import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';

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
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
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
    return ctx.db.insert('budgets', {
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
    });
  },
});

export const archive = mutation({
  args: { budgetId: v.id('budgets') },
  handler: async (ctx, { budgetId }) => {
    const user = await requireUser(ctx);
    const budget = await ctx.db.get(budgetId);
    if (!user || !budget) throw new Error('AUTH_REQUIRED');
    if (budget.ownerId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    if (budget.archivedAt === undefined) {
      const now = Date.now();
      await ctx.db.patch(budgetId, { archivedAt: now, updatedAt: now });
    }
    return budgetId;
  },
});
