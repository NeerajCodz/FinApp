import { query, type QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { v } from 'convex/values';
import { getOptionalUser, requireIdentity } from '../shared/auth';
import { aggregateBudgetSpending } from './domain';

async function excludedCategories(ctx: QueryCtx, ownerId: Doc<'users'>['_id']) {
  const categories = await ctx.db
    .query('categories')
    .withIndex('by_owner', (q) => q.eq('ownerId', ownerId))
    .collect();
  return new Set(
    categories
      .filter((category) => category.includeInBudgets === false)
      .map((category) => String(category._id)),
  );
}

async function withSpending(ctx: QueryCtx, ownerId: Doc<'users'>['_id'], budget: Doc<'budgets'>) {
  const transactions = await ctx.db
    .query('transactions')
    .withIndex('by_owner_occurredAt', (q) => q.eq('ownerId', ownerId))
    .collect();
  const spentMinor = aggregateBudgetSpending(
    transactions,
    budget,
    await excludedCategories(ctx, ownerId),
  );
  return { ...budget, spentMinor, remainingMinor: budget.amountMinor - spentMinor };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const budgets = await ctx.db
      .query('budgets')
      .withIndex('by_owner_period', (q) => q.eq('ownerId', user._id))
      .collect();
    const active = budgets.filter((budget) => budget.archivedAt === undefined);
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (q) => q.eq('ownerId', user._id))
      .collect();
    const excludedCategoryIds = await excludedCategories(ctx, user._id);
    return active
      .map((budget) => {
        const spentMinor = aggregateBudgetSpending(transactions, budget, excludedCategoryIds);
        return { ...budget, spentMinor, remainingMinor: budget.amountMinor - spentMinor };
      })
      .sort((left, right) => left.startAt - right.startAt || left.name.localeCompare(right.name));
  },
});

export const detail = query({
  args: { budgetId: v.id('budgets') },
  handler: async (ctx, { budgetId }) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const budget = await ctx.db.get(budgetId);
    if (!budget || budget.ownerId !== user._id || budget.archivedAt !== undefined) return null;
    return withSpending(ctx, user._id, budget);
  },
});
