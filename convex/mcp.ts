import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { getOptionalUser } from './shared/auth';
import { query } from './_generated/server';

const resourceValidator = v.union(
  v.literal('accounts'),
  v.literal('categories'),
  v.literal('budgets'),
  v.literal('goals'),
  v.literal('goalContributions'),
  v.literal('recurringRules'),
  v.literal('notifications'),
);

export const listTransactions = query({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    accountId: v.optional(v.string()),
    categoryId: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal('expense'),
        v.literal('income'),
        v.literal('transfer'),
        v.literal('refund'),
        v.literal('adjustment'),
      ),
    ),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isFinite(args.startAt) ||
      !Number.isFinite(args.endAt) ||
      args.endAt <= args.startAt ||
      args.endAt - args.startAt > 366 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const page = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (index) =>
        index.eq('ownerId', user._id).gte('occurredAt', args.startAt).lt('occurredAt', args.endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    const search = args.search?.trim().toLowerCase();
    const results = page.page
      .filter(
        (transaction) =>
          transaction.deletedAt === undefined &&
          transaction.status !== 'voided' &&
          (!args.accountId || String(transaction.accountId) === args.accountId) &&
          (!args.categoryId || transaction.categoryId === args.categoryId) &&
          (!args.type || transaction.type === args.type) &&
          (!search ||
            transaction.title.toLowerCase().includes(search) ||
            transaction.merchant?.toLowerCase().includes(search)),
      )
      .map((transaction) => ({
        id: transaction._id,
        title: transaction.title,
        type: transaction.type,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        merchant: transaction.merchant,
        note: transaction.note,
        occurredAt: transaction.occurredAt,
        status: transaction.status,
      }));
    return {
      items: results,
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const listOwnedRecords = query({
  args: {
    resource: resourceValidator,
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const { numItems } = args.paginationOpts;
    if (!Number.isInteger(numItems) || numItems < 1 || numItems > 100) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    if (
      (args.startAt !== undefined || args.endAt !== undefined) &&
      (!Number.isFinite(args.startAt) ||
        !Number.isFinite(args.endAt) ||
        args.endAt! <= args.startAt! ||
        args.endAt! - args.startAt! > 366 * 86_400_000)
    ) {
      throw new Error('INVALID_DATE_RANGE');
    }

    let page;
    if (args.resource === 'accounts') {
      page = await ctx.db
        .query('accounts')
        .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
        .order('desc')
        .paginate(args.paginationOpts);
      return {
        items: page.page
          .filter((row) => row.archivedAt === undefined)
          .map((row) => ({
            id: row._id,
            name: row.name,
            type: row.type,
            currency: row.currency,
            openingBalanceMinor: row.openingBalanceMinor,
            isIncludedInTotal: row.isIncludedInTotal,
            includeInAnalytics: row.includeInAnalytics,
          })),
        nextCursor: page.isDone ? null : page.continueCursor,
        isDone: page.isDone,
      };
    }
    if (args.resource === 'categories') {
      page = await ctx.db
        .query('categories')
        .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
        .order('desc')
        .paginate(args.paginationOpts);
      return {
        items: page.page
          .filter((row) => row.archivedAt === undefined)
          .map((row) => ({
            id: row._id,
            name: row.name,
            kind: row.kind,
            icon: row.icon,
            color: row.color,
            includeInBudgets: row.includeInBudgets,
            monthlyLimitMinor: row.monthlyLimitMinor,
          })),
        nextCursor: page.isDone ? null : page.continueCursor,
        isDone: page.isDone,
      };
    }
    if (args.resource === 'budgets') {
      page = await ctx.db
        .query('budgets')
        .withIndex('by_owner_period', (index) => index.eq('ownerId', user._id))
        .order('desc')
        .paginate(args.paginationOpts);
      return {
        items: page.page
          .filter((row) => row.archivedAt === undefined)
          .map((row) => ({
            id: row._id,
            name: row.name,
            amountMinor: row.amountMinor,
            currency: row.currency,
            period: row.period,
            categoryId: row.categoryId,
            accountId: row.accountId,
            startAt: row.startAt,
            endAt: row.endAt,
          })),
        nextCursor: page.isDone ? null : page.continueCursor,
        isDone: page.isDone,
      };
    }
    if (args.resource === 'goals') {
      page = await ctx.db
        .query('goals')
        .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
        .order('desc')
        .paginate(args.paginationOpts);
      return {
        items: page.page
          .filter((row) => row.archivedAt === undefined)
          .map((row) => ({
            id: row._id,
            name: row.name,
            targetAmountMinor: row.targetAmountMinor,
            currency: row.currency,
            targetDate: row.targetDate,
            monthlyContributionMinor: row.monthlyContributionMinor,
            completedAt: row.completedAt,
          })),
        nextCursor: page.isDone ? null : page.continueCursor,
        isDone: page.isDone,
      };
    }
    if (args.resource === 'goalContributions') {
      const startAt = args.startAt ?? 0;
      const endAt = args.endAt ?? Date.now();
      page = await ctx.db
        .query('goalContributions')
        .withIndex('by_owner_occurredAt', (index) =>
          index.eq('ownerId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
        )
        .order('desc')
        .paginate(args.paginationOpts);
      return {
        items: page.page.map((row) => ({
          id: row._id,
          goalId: row.goalId,
          amountMinor: row.amountMinor,
          currency: row.currency,
          accountId: row.accountId,
          occurredAt: row.occurredAt,
        })),
        nextCursor: page.isDone ? null : page.continueCursor,
        isDone: page.isDone,
      };
    }
    if (args.resource === 'recurringRules') {
      page = await ctx.db
        .query('recurringRules')
        .withIndex('by_owner_nextOccurrence', (index) => index.eq('ownerId', user._id))
        .order('desc')
        .paginate(args.paginationOpts);
      return {
        items: page.page.map((row) => ({
          id: row._id,
          name: row.name,
          frequency: row.frequency,
          interval: row.interval,
          nextOccurrence: row.nextOccurrence,
          endDate: row.endDate,
          enabled: row.enabled,
          autoCreate: row.autoCreate,
        })),
        nextCursor: page.isDone ? null : page.continueCursor,
        isDone: page.isDone,
      };
    }
    const startAt = args.startAt ?? 0;
    const endAt = args.endAt ?? Date.now();
    page = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_createdAt', (index) =>
        index.eq('recipientId', user._id).gte('createdAt', startAt).lt('createdAt', endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    return {
      items: page.page.map((row) => ({
        id: row._id,
        type: row.type,
        title: row.title,
        body: row.body,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: row.createdAt,
        readAt: row.readAt,
      })),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});
export const listGroups = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isInteger(paginationOpts.numItems) ||
      paginationOpts.numItems < 1 ||
      paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    const membershipPage = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (index) => index.eq('userId', user._id))
      .order('desc')
      .paginate(paginationOpts);
    const groupRows = await Promise.all(
      membershipPage.page.map(async (membership) => ({
        group: await ctx.db.get(membership.groupId),
        membership,
      })),
    );
    return {
      items: groupRows.flatMap(({ group, membership }) =>
        group && group.archivedAt === undefined
          ? [
              {
                id: group._id,
                name: group.name,
                currency: group.currency,
                memberRole: membership.role,
                updatedAt: group.updatedAt,
              },
            ]
          : [],
      ),
      nextCursor: membershipPage.isDone ? null : membershipPage.continueCursor,
      isDone: membershipPage.isDone,
    };
  },
});

export const listGroupExpenses = query({
  args: {
    groupId: v.id('groups'),
    startAt: v.number(),
    endAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isFinite(args.startAt) ||
      !Number.isFinite(args.endAt) ||
      args.endAt <= args.startAt ||
      args.endAt - args.startAt > 366 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (index) =>
        index.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const page = await ctx.db
      .query('transactions')
      .withIndex('by_group_occurredAt', (index) =>
        index
          .eq('groupId', args.groupId)
          .gte('occurredAt', args.startAt)
          .lt('occurredAt', args.endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    return {
      items: page.page
        .filter((row) => row.deletedAt === undefined && row.status !== 'voided')
        .map((row) => ({
          id: row._id,
          title: row.title,
          type: row.type,
          amountMinor: row.amountMinor,
          currency: row.currency,
          occurredAt: row.occurredAt,
          accountId: row.accountId,
          categoryId: row.categoryId,
        })),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const listGroupMessages = query({
  args: {
    groupId: v.id('groups'),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const startAt = args.startAt ?? 0;
    const endAt = args.endAt ?? Date.now() + 1;
    if (
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      endAt <= startAt ||
      endAt - startAt > 366 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (index) =>
        index.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const now = Date.now();
    const page = await ctx.db
      .query('groupMessages')
      .withIndex('by_group_createdAt', (index) =>
        index.eq('groupId', args.groupId).gte('createdAt', startAt).lt('createdAt', endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    const visible = page.page.filter(
      (message) => message.expiresAt === undefined || message.expiresAt > now,
    );
    const senders = await Promise.all(visible.map((message) => ctx.db.get(message.senderId)));
    return {
      items: visible.map((message, index) => ({
        id: message._id,
        kind: message.kind,
        text: message.text,
        createdAt: message.createdAt,
        senderName: senders[index]?.displayName ?? senders[index]?.name ?? 'Finapp user',
      })),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const listFriends = query({
  args: {
    side: v.union(v.literal('low'), v.literal('high')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    const page =
      args.side === 'low'
        ? await ctx.db
            .query('friendships')
            .withIndex('by_low', (index) => index.eq('userLowId', user._id))
            .paginate(args.paginationOpts)
        : await ctx.db
            .query('friendships')
            .withIndex('by_high', (index) => index.eq('userHighId', user._id))
            .paginate(args.paginationOpts);
    const friendIds = page.page.map((row) =>
      args.side === 'low' ? row.userHighId : row.userLowId,
    );
    const friends = await Promise.all(friendIds.map((id) => ctx.db.get(id)));
    return {
      items: friends.flatMap((friend) =>
        friend && friend.deletedAt === undefined
          ? [
              {
                id: friend._id,
                username: friend.username,
                displayName: friend.displayName ?? friend.name ?? 'Finapp user',
              },
            ]
          : [],
      ),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const listFriendRequests = query({
  args: {
    direction: v.union(v.literal('incoming'), v.literal('outgoing')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    const page =
      args.direction === 'incoming'
        ? await ctx.db
            .query('friendRequests')
            .withIndex('by_recipient_status', (index) =>
              index.eq('recipientId', user._id).eq('status', 'pending'),
            )
            .paginate(args.paginationOpts)
        : await ctx.db
            .query('friendRequests')
            .withIndex('by_requester_status', (index) =>
              index.eq('requesterId', user._id).eq('status', 'pending'),
            )
            .paginate(args.paginationOpts);
    const otherIds = page.page.map((row) =>
      args.direction === 'incoming' ? row.requesterId : row.recipientId,
    );
    const people = await Promise.all(otherIds.map((id) => ctx.db.get(id)));
    return {
      items: page.page.flatMap((request, index) => {
        const person = people[index];
        return person && person.deletedAt === undefined
          ? [
              {
                id: request._id,
                createdAt: request.createdAt,
                person: {
                  id: person._id,
                  username: person.username,
                  displayName: person.displayName ?? person.name ?? 'Finapp user',
                },
              },
            ]
          : [];
      }),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});
export const listGroupSettlements = query({
  args: {
    groupId: v.id('groups'),
    startAt: v.number(),
    endAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isFinite(args.startAt) ||
      !Number.isFinite(args.endAt) ||
      args.endAt <= args.startAt ||
      args.endAt - args.startAt > 366 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (index) =>
        index.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const page = await ctx.db
      .query('settlements')
      .withIndex('by_group_occurredAt', (index) =>
        index
          .eq('groupId', args.groupId)
          .gte('occurredAt', args.startAt)
          .lt('occurredAt', args.endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    return {
      items: page.page.map((settlement) => ({
        id: settlement._id,
        fromUserId: settlement.fromUserId,
        toUserId: settlement.toUserId,
        amountMinor: settlement.amountMinor,
        currency: settlement.currency,
        occurredAt: settlement.occurredAt,
        accountId: settlement.accountId,
      })),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});
export const dashboardPreview = query({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isFinite(args.startAt) ||
      !Number.isFinite(args.endAt) ||
      args.endAt <= args.startAt ||
      args.endAt - args.startAt > 366 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const page = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (index) =>
        index.eq('ownerId', user._id).gte('occurredAt', args.startAt).lt('occurredAt', args.endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    let incomeMinor = 0n;
    let spentMinor = 0n;
    for (const transaction of page.page) {
      if (transaction.deletedAt !== undefined || transaction.status !== 'posted') continue;
      if (transaction.currency !== (user.defaultCurrency ?? 'INR')) continue;
      if (transaction.type === 'income') incomeMinor += transaction.amountMinor;
      if (transaction.type === 'expense') spentMinor += transaction.amountMinor;
    }
    return {
      currency: user.defaultCurrency ?? 'INR',
      incomeMinor,
      spentMinor,
      pageCount: page.page.length,
      partial: !page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      startAt: args.startAt,
      endAt: args.endAt,
    };
  },
});

export const groupSummary = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, { groupId }) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (index) => index.eq('groupId', groupId).eq('userId', user._id))
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const group = await ctx.db.get(groupId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    return {
      id: group._id,
      name: group.name,
      currency: group.currency,
      description: group.description,
      groupType: group.groupType,
      purpose: group.purpose,
      location: group.location,
      startAt: group.startAt,
      endAt: group.endAt,
      memberRole: membership.role,
      updatedAt: group.updatedAt,
    };
  },
});

export const searchPeople = query({
  args: { query: v.string() },
  handler: async (ctx, { query: rawQuery }) => {
    const current = await getOptionalUser(ctx);
    if (!current || current.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const prefix = rawQuery.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9_]{2,32}$/.test(prefix)) throw new Error('INVALID_SEARCH');
    const matches = await ctx.db
      .query('users')
      .withIndex('by_username', (index) =>
        index.gte('username', prefix).lt('username', `${prefix}\uffff`),
      )
      .take(21);
    return matches
      .filter((person) => person._id !== current._id && person.deletedAt === undefined)
      .slice(0, 20)
      .map((person) => ({
        id: person._id,
        username: person.username,
        displayName: person.displayName ?? person.name ?? 'Finapp user',
      }));
  },
});
export const analyticsPreview = query({
  args: {
    startAt: v.number(),
    endAt: v.number(),
    previousStartAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isFinite(args.startAt) ||
      !Number.isFinite(args.endAt) ||
      !Number.isFinite(args.previousStartAt) ||
      args.endAt <= args.startAt ||
      args.startAt <= args.previousStartAt ||
      args.endAt - args.startAt > 366 * 86_400_000 ||
      args.endAt - args.previousStartAt > 732 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const page = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (index) =>
        index
          .eq('ownerId', user._id)
          .gte('occurredAt', args.previousStartAt)
          .lt('occurredAt', args.endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    const accountIds = [...new Set(page.page.map((transaction) => transaction.accountId))];
    const accounts = await Promise.all(accountIds.map((accountId) => ctx.db.get(accountId)));
    const includedAccounts = new Set(
      accounts
        .filter((account) => account?.includeInAnalytics !== false)
        .map((account) => String(account?._id)),
    );
    let currentIncomeMinor = 0n;
    let currentSpentMinor = 0n;
    let previousIncomeMinor = 0n;
    let previousSpentMinor = 0n;
    for (const transaction of page.page) {
      if (
        transaction.deletedAt !== undefined ||
        transaction.status !== 'posted' ||
        transaction.currency !== user.defaultCurrency ||
        !includedAccounts.has(String(transaction.accountId))
      ) {
        continue;
      }
      const current = transaction.occurredAt >= args.startAt;
      if (transaction.type === 'income') {
        if (current) currentIncomeMinor += transaction.amountMinor;
        else previousIncomeMinor += transaction.amountMinor;
      } else if (transaction.type === 'expense') {
        if (current) currentSpentMinor += transaction.amountMinor;
        else previousSpentMinor += transaction.amountMinor;
      }
    }
    return {
      currency: user.defaultCurrency,
      currentIncomeMinor,
      currentSpentMinor,
      previousIncomeMinor,
      previousSpentMinor,
      recordsRead: page.page.length,
      partial: !page.isDone,
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      previousStartAt: args.previousStartAt,
      startAt: args.startAt,
      endAt: args.endAt,
    };
  },
});
export const listGroupMembers = query({
  args: { groupId: v.id('groups'), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (index) =>
        index.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const page = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (index) => index.eq('groupId', args.groupId))
      .paginate(args.paginationOpts);
    const profiles = await Promise.all(page.page.map((member) => ctx.db.get(member.userId)));
    return {
      items: page.page.flatMap((member, index) => {
        const profile = profiles[index];
        return profile && profile.deletedAt === undefined
          ? [
              {
                id: member.userId,
                role: member.role,
                joinedAt: member.joinedAt,
                username: profile.username,
                displayName: profile.displayName ?? profile.name ?? 'Finapp user',
              },
            ]
          : [];
      }),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const listGroupInvitations = query({
  args: {
    lookup: v.union(v.literal('user'), v.literal('username'), v.literal('email')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    let page;
    if (args.lookup === 'user') {
      page = await ctx.db
        .query('groupInvites')
        .withIndex('by_invitee_user_status', (index) =>
          index.eq('inviteeUserId', user._id).eq('status', 'pending'),
        )
        .paginate(args.paginationOpts);
    } else if (args.lookup === 'username') {
      if (!user.username) throw new Error('USERNAME_UNAVAILABLE');
      page = await ctx.db
        .query('groupInvites')
        .withIndex('by_invitee_username', (index) =>
          index.eq('inviteeUsername', user.username!.toLowerCase()),
        )
        .paginate(args.paginationOpts);
    } else {
      if (!user.email) throw new Error('EMAIL_UNAVAILABLE');
      page = await ctx.db
        .query('groupInvites')
        .withIndex('by_invitee_email', (index) =>
          index.eq('inviteeEmail', user.email!.trim().toLowerCase()),
        )
        .paginate(args.paginationOpts);
    }
    const pending = page.page.filter((invite) => invite.status === 'pending');
    const groups = await Promise.all(pending.map((invite) => ctx.db.get(invite.groupId)));
    const inviters = await Promise.all(pending.map((invite) => ctx.db.get(invite.inviterId)));
    return {
      items: pending.flatMap((invite, index) => {
        const group = groups[index];
        const inviter = inviters[index];
        return group && group.archivedAt === undefined
          ? [
              {
                id: invite._id,
                groupId: group._id,
                groupName: group.name,
                createdAt: invite.createdAt,
                inviter: inviter
                  ? {
                      id: inviter._id,
                      displayName: inviter.displayName ?? inviter.name ?? 'Finapp user',
                    }
                  : null,
              },
            ]
          : [];
      }),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      lookup: args.lookup,
    };
  },
});
export const listDirectConversations = query({
  args: {
    side: v.union(v.literal('low'), v.literal('high')),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_PAGE_SIZE');
    }
    const page =
      args.side === 'low'
        ? await ctx.db
            .query('directConversations')
            .withIndex('by_pair', (index) => index.eq('userLowId', user._id))
            .paginate(args.paginationOpts)
        : await ctx.db
            .query('directConversations')
            .withIndex('by_high', (index) => index.eq('userHighId', user._id))
            .paginate(args.paginationOpts);
    const people = await Promise.all(
      page.page.map((conversation) =>
        ctx.db.get(args.side === 'low' ? conversation.userHighId : conversation.userLowId),
      ),
    );
    return {
      items: page.page.flatMap((conversation, index) => {
        const person = people[index];
        if (!person || person.deletedAt !== undefined) return [];
        return [
          {
            id: conversation._id,
            updatedAt: conversation.updatedAt,
            person: {
              id: person._id,
              username: person.username,
              displayName: person.displayName ?? person.name ?? 'Finapp user',
            },
          },
        ];
      }),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const listDirectMessages = query({
  args: {
    conversationId: v.id('directConversations'),
    startAt: v.number(),
    endAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    if (
      !Number.isFinite(args.startAt) ||
      !Number.isFinite(args.endAt) ||
      args.endAt <= args.startAt ||
      args.endAt - args.startAt > 366 * 86_400_000 ||
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 100
    ) {
      throw new Error('INVALID_FILTERS');
    }
    const conversation = await ctx.db.get(args.conversationId);
    if (
      !conversation ||
      (conversation.userLowId !== user._id && conversation.userHighId !== user._id)
    ) {
      throw new Error('CONVERSATION_UNAVAILABLE');
    }
    const page = await ctx.db
      .query('directMessages')
      .withIndex('by_conversation_createdAt', (index) =>
        index
          .eq('conversationId', args.conversationId)
          .gte('createdAt', args.startAt)
          .lt('createdAt', args.endAt),
      )
      .order('desc')
      .paginate(args.paginationOpts);
    const senders = await Promise.all(page.page.map((message) => ctx.db.get(message.senderId)));
    return {
      items: page.page.map((message, index) => ({
        id: message._id,
        kind: message.kind,
        text: message.text,
        createdAt: message.createdAt,
        senderName: senders[index]?.displayName ?? senders[index]?.name ?? 'Finapp user',
      })),
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});
