import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser, requireIdentity } from '../shared/auth';
import { composeDashboard, type DashboardInput } from './domain';

export function getDashboard(input: DashboardInput) {
  return composeDashboard(input);
}

export const summary = query({
  args: { startAt: v.number(), endAt: v.number() },
  handler: async (ctx, { startAt, endAt }) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    if (
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      endAt <= startAt ||
      endAt - startAt > 366 * 86400000
    )
      throw new Error('INVALID_DATE_RANGE');
    const currency = user.defaultCurrency ?? 'INR';
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (q) => q.eq('ownerId', user._id))
      .order('desc')
      .collect();
    let incomeMinor = 0n;
    let spentMinor = 0n;
    const chart = Array<number>(8).fill(0);
    const recent = [];
    for (const transaction of transactions) {
      if (transaction.status !== 'posted' || transaction.deletedAt !== undefined) continue;
      if (recent.length < 4) recent.push(transaction);
      if (
        transaction.currency !== currency ||
        transaction.occurredAt < startAt ||
        transaction.occurredAt >= endAt
      )
        continue;
      if (transaction.type === 'income') incomeMinor += transaction.amountMinor;
      if (transaction.type === 'expense') {
        spentMinor += transaction.amountMinor;
        const bucket = Math.min(
          7,
          Math.floor(((transaction.occurredAt - startAt) / (endAt - startAt)) * 8),
        );
        chart[bucket] = (chart[bucket] ?? 0) + Number(transaction.amountMinor) / 100;
      }
    }
    return { currency, incomeMinor, spentMinor, chart, recent };
  },
});
