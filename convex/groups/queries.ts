import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser } from '../shared/auth';
import { normalizeUsername } from '../users/domain';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const groups = await ctx.db
      .query('groups')
      .withIndex('by_owner', (query) => query.eq('ownerId', user._id))
      .collect();
    return groups
      .filter((group) => group.archivedAt === undefined)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const personTimeline = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const username = normalizeUsername(args.username);
    const person = await ctx.db
      .query('users')
      .withIndex('by_username', (query) => query.eq('username', username))
      .unique();
    if (!person) return [];
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect();
    const groupIds = new Set<string>();
    for (const membership of memberships) {
      const otherMembership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (query) =>
          query.eq('groupId', membership.groupId).eq('userId', person._id),
        )
        .unique();
      if (otherMembership) groupIds.add(membership.groupId);
    }
    const transactions = [];
    for (const groupId of groupIds) {
      const groupTransactions = await ctx.db
        .query('transactions')
        .withIndex('by_group_occurredAt', (query) => query.eq('groupId', groupId))
        .collect();
      transactions.push(...groupTransactions);
    }
    return transactions
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((transaction) => ({
        id: transaction._id,
        title: transaction.title,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        type: transaction.type,
        occurredAt: transaction.occurredAt,
        status: transaction.status,
      }));
  },
});

export const detail = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) return null;
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) return null;
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
      .collect();
    const members = [];
    for (const member of memberships) {
      const profile = await ctx.db.get(member.userId);
      members.push({
        id: member.userId,
        displayName: profile?.displayName ?? profile?.name ?? 'Finapp user',
        username: profile?.username,
        role: member.role,
      });
    }
    const expenses = await ctx.db
      .query('transactions')
      .withIndex('by_group_occurredAt', (query) => query.eq('groupId', args.groupId))
      .collect();
    return {
      ...group,
      members,
      expenses: expenses
        .filter((expense) => expense.deletedAt === undefined && expense.status !== 'voided')
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 20),
    };
  },
});
