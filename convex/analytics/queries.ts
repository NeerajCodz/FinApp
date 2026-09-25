import { v } from 'convex/values';
import { query } from '../_generated/server';
import { getOptionalUser, requireIdentity } from '../shared/auth';
import { aggregateAnalytics, validateAnalyticsRange, type AnalyticsPeriod } from './domain';

const periodValidator = v.union(v.literal('week'), v.literal('month'), v.literal('year'));

export const summary = query({
  args: {
    period: periodValidator,
    startAt: v.number(),
    endAt: v.number(),
    previousStartAt: v.number(),
  },
  handler: async (ctx, { period, startAt, endAt, previousStartAt }) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    validateAnalyticsRange(period as AnalyticsPeriod, startAt, endAt);
    validateAnalyticsRange(period as AnalyticsPeriod, previousStartAt, startAt);
    const currency = user.defaultCurrency;
    if (!currency) throw new Error('DEFAULT_CURRENCY_REQUIRED');
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (q) =>
        q.eq('ownerId', user._id).gte('occurredAt', previousStartAt).lt('occurredAt', endAt),
      )
      .collect();
    const categories = await ctx.db
      .query('categories')
      .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
      .collect();
    const accounts = await ctx.db
      .query('accounts')
      .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
      .collect();
    const accountNames = accounts.map((account) => ({ id: account._id, name: account.name }));
    const categoryNames = categories.map((category) => ({ id: category._id, name: category.name }));
    const analyticsPeriod = period as AnalyticsPeriod;
    const timeZone = user.timezone ?? 'UTC';
    const current = aggregateAnalytics(
      transactions,
      categoryNames,
      currency,
      analyticsPeriod,
      startAt,
      endAt,
      timeZone,
      accountNames,
    );
    const previous = aggregateAnalytics(
      transactions,
      categoryNames,
      currency,
      analyticsPeriod,
      previousStartAt,
      startAt,
      timeZone,
      accountNames,
    );
    return { currency, ...current, previousSpentMinor: previous.spentMinor };
  },
});
