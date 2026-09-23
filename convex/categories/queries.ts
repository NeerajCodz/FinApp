import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser, requireIdentity } from '../shared/auth';

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const categories = await ctx.db
      .query('categories')
      .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
      .collect();
    return categories
      .filter((category) => category.archivedAt === undefined)
      .sort((left, right) => left.sortOrder - right.sortOrder || left._id.localeCompare(right._id));
  },
});

export const detail = query({
  args: { categoryId: v.id('categories') },
  handler: async (ctx, { categoryId }) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const category = await ctx.db.get(categoryId);
    if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
      return null;

    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_category_occurredAt', (q) =>
        q.eq('ownerId', user._id).eq('categoryId', categoryId),
      )
      .order('desc')
      .collect();
    const posted = transactions.filter(
      (transaction) => transaction.status === 'posted' && transaction.deletedAt === undefined,
    );
    const now = new Date();
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const nextMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
    const spendingCurrency = category.limitCurrency ?? user.defaultCurrency;
    const monthSpentMinor = posted.reduce(
      (total, transaction) =>
        transaction.type === 'expense' &&
        transaction.occurredAt >= monthStart &&
        transaction.occurredAt < nextMonthStart &&
        (!spendingCurrency || transaction.currency === spendingCurrency)
          ? total + transaction.amountMinor
          : total,
      0n,
    );
    return { category, monthSpentMinor, transactions: posted };
  },
});
