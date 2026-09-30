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

export const frequentPeople = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .collect();
    const people = new Map<string, { count: number; amountMinor: bigint }>();
    const since = Date.now() - 90 * 86_400_000;
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (!group || group.archivedAt !== undefined) continue;
      const transactions = await ctx.db
        .query('transactions')
        .withIndex('by_group_occurredAt', (q) =>
          q.eq('groupId', membership.groupId).gte('occurredAt', since),
        )
        .order('desc')
        .take(12);
      for (const transaction of transactions) {
        if (
          transaction.type !== 'expense' ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined ||
          transaction.currency !== (user.defaultCurrency ?? 'INR')
        )
          continue;
        const participants = await ctx.db
          .query('expenseParticipants')
          .withIndex('by_transaction', (q) => q.eq('transactionId', transaction._id))
          .collect();
        if (!participants.some((participant) => participant.userId === user._id)) continue;
        for (const participant of participants) {
          if (participant.userId === user._id) continue;
          const id = String(participant.userId);
          const current = people.get(id) ?? { count: 0, amountMinor: 0n };
          current.count += 1;
          current.amountMinor += participant.amountMinor;
          people.set(id, current);
        }
      }
    }
    const ranked = [...people.entries()]
      .sort(
        ([leftId, left], [rightId, right]) =>
          right.count - left.count ||
          (right.amountMinor > left.amountMinor
            ? 1
            : right.amountMinor < left.amountMinor
              ? -1
              : 0) ||
          leftId.localeCompare(rightId),
      )
      .slice(0, 6);
    return Promise.all(
      ranked.map(async ([id, activity]) => {
        const profile = await ctx.db.get(id as typeof user._id);
        if (!profile) return null;
        const image =
          profile.image ??
          (profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null);
        return {
          id,
          username: profile.username,
          name: profile.displayName ?? profile.name ?? profile.username ?? 'Finapp user',
          image,
          transactionCount: activity.count,
          amountMinor: activity.amountMinor,
        };
      }),
    ).then((rows) => rows.filter((row): row is NonNullable<typeof row> => row !== null));
  },
});
