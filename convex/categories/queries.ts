import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser, requireIdentity } from '../shared/auth';
import type { Doc } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { DEFAULT_LIMIT_ALERT_PERCENT, limitStatus, monthWindow } from './limits';

function publicCategory({ kind: legacyKind, ...category }: Doc<'categories'>) {
  void legacyKind;
  return category;
}

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
      .sort((left, right) => left.sortOrder - right.sortOrder || left._id.localeCompare(right._id))
      .map(publicCategory);
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
    const categoryCurrency = category.limitCurrency ?? user.defaultCurrency;
    const monthTotals = posted.reduce(
      (totals, transaction) => {
        if (
          transaction.occurredAt < monthStart ||
          transaction.occurredAt >= nextMonthStart ||
          (categoryCurrency && transaction.currency !== categoryCurrency)
        )
          return totals;
        if (transaction.type === 'expense') totals.spentMinor += transaction.amountMinor;
        if (transaction.type === 'income') totals.receivedMinor += transaction.amountMinor;
        return totals;
      },
      { spentMinor: 0n, receivedMinor: 0n },
    );
    return {
      category: publicCategory(category),
      monthSpentMinor: monthTotals.spentMinor,
      monthReceivedMinor: monthTotals.receivedMinor,
      transactions: posted,
    };
  },
});
async function monthOverview(ctx: QueryCtx, user: Doc<'users'>) {
  const categories = await ctx.db
    .query('categories')
    .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
    .collect();
  const active = categories
    .filter((category) => category.archivedAt === undefined)
    .sort((left, right) => left.sortOrder - right.sortOrder || left._id.localeCompare(right._id));
  const { startAt, endAt } = monthWindow(Date.now());
  const categoryByKey = new Map<string, (typeof active)[number]>();
  for (const category of active) {
    categoryByKey.set(String(category._id), category);
    if (category.clientId) categoryByKey.set(category.clientId, category);
  }
  const totals = new Map<string, { spentMinor: bigint; receivedMinor: bigint }>();
  const transactions = await ctx.db
    .query('transactions')
    .withIndex('by_owner_occurredAt', (q) =>
      q.eq('ownerId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
    )
    .collect();
  for (const transaction of transactions) {
    if (
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      transaction.categoryId === undefined ||
      (transaction.type !== 'expense' && transaction.type !== 'income')
    )
      continue;
    const category = categoryByKey.get(transaction.categoryId);
    if (!category || transaction.currency !== (category.limitCurrency ?? user.defaultCurrency))
      continue;
    const total = totals.get(category._id) ?? { spentMinor: 0n, receivedMinor: 0n };
    if (transaction.type === 'expense') total.spentMinor += transaction.amountMinor;
    else total.receivedMinor += transaction.amountMinor;
    totals.set(category._id, total);
  }
  return {
    startAt,
    endAt,
    rows: active.map((category) => {
      const total = totals.get(category._id);
      return {
        ...publicCategory(category),
        monthSpentMinor: total?.spentMinor ?? 0n,
        monthReceivedMinor: total?.receivedMinor ?? 0n,
        monthCurrency: category.limitCurrency ?? user.defaultCurrency ?? null,
      };
    }),
  };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    return (await monthOverview(ctx, user)).rows;
  },
});

/**
 * Category limits (each category's monthly budget) with this month's usage: spent, remaining,
 * percent used, alert level and severity. Only categories that have a limit.
 */
export const limits = query({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const { rows, startAt, endAt } = await monthOverview(ctx, user);
    return rows.flatMap((category) => {
      if (category.monthlyLimitMinor === undefined || !category.limitCurrency) return [];
      const limitMinor = category.monthlyLimitMinor;
      const spentMinor = category.monthSpentMinor;
      const alertPercent = category.limitAlertPercent ?? DEFAULT_LIMIT_ALERT_PERCENT;
      return [
        {
          categoryId: category._id,
          name: category.name,
          icon: category.icon,
          color: category.color,
          currency: category.limitCurrency,
          limitMinor,
          spentMinor,
          remainingMinor: limitMinor - spentMinor,
          percentUsed: limitMinor > 0n ? Number((spentMinor * 10_000n) / limitMinor) / 100 : 0,
          alertPercent,
          status: limitStatus(spentMinor, limitMinor, alertPercent),
          startAt,
          endAt,
        },
      ];
    });
  },
});
