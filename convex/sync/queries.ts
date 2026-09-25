import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { query } from '../_generated/server';
import { getOptionalUser } from '../shared/auth';

const MAX_PAGE_SIZE = 100;
const sectionValidator = v.union(
  v.literal('accounts'),
  v.literal('categories'),
  v.literal('budgets'),
  v.literal('goals'),
  v.literal('goalContributions'),
  v.literal('recurringRules'),
  v.literal('notifications'),
  v.literal('groupMemberships'),
);
function assertPageSize(numItems: number): void {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > MAX_PAGE_SIZE) {
    throw new Error('INVALID_PAGE_SIZE');
  }
}
function assertRange(startAt: number, endAt: number): void {
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || startAt >= endAt) {
    throw new Error('INVALID_DATE_RANGE');
  }
}
async function authenticatedUser(ctx: Parameters<typeof getOptionalUser>[0]) {
  const user = await getOptionalUser(ctx);
  if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
  return user;
}

export const bootstrapIdentity = query({
  args: {},
  handler: async (ctx) => {
    const user = await authenticatedUser(ctx);
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (index) => index.eq('userId', user._id))
      .unique();
    const {
      identityId: _identityId,
      emailVerificationTime: _emailVerificationTime,
      phoneVerificationTime: _phoneVerificationTime,
      ...profile
    } = user;
    return { profile, settings };
  },
});

export const bootstrapSection = query({
  args: { section: sectionValidator, paginationOpts: paginationOptsValidator },
  handler: async (ctx, { section, paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertPageSize(paginationOpts.numItems);
    if (section === 'accounts') {
      const page = await ctx.db
        .query('accounts')
        .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
        .paginate(paginationOpts);
      const [accountMembers, allAccounts, transactions] = await Promise.all([
        Promise.all(page.page.map((account) =>
          ctx.db.query('accountMembers').withIndex('by_account', (index) => index.eq('accountId', account._id)).collect(),
        )).then((items) => items.flat()),
        ctx.db.query('accounts').withIndex('by_owner', (index) => index.eq('ownerId', user._id)).collect(),
        ctx.db.query('transactions').withIndex('by_owner_occurredAt', (index) => index.eq('ownerId', user._id)).collect(),
      ]);
      const balances = new Map(allAccounts.map((account) => [account._id, account.openingBalanceMinor]));
      for (const transaction of transactions) {
        if (transaction.status !== 'posted' || transaction.deletedAt !== undefined) continue;
        const source = balances.get(transaction.accountId);
        if (source !== undefined) {
          const outgoing = transaction.type === 'expense' || transaction.type === 'transfer';
          balances.set(transaction.accountId, source + (outgoing ? -transaction.amountMinor : transaction.amountMinor));
        }
        if (transaction.type === 'transfer' && transaction.transferAccountId) {
          const destinationId = ctx.db.normalizeId('accounts', transaction.transferAccountId);
          const destination = destinationId ? balances.get(destinationId) : undefined;
          if (destinationId && destination !== undefined)
            balances.set(destinationId, destination + transaction.amountMinor);
        }
      }
      const accountPage = page.page.map((account) => ({
        ...account,
        balanceMinor: balances.get(account._id) ?? account.openingBalanceMinor,
      }));
      return { section, ...page, page: accountPage, related: accountMembers };
    }
    if (section === 'categories') {
      const page = await ctx.db
        .query('categories')
        .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
        .paginate(paginationOpts);
      return { section, ...page };
    }
    if (section === 'budgets') {
      const page = await ctx.db
        .query('budgets')
        .withIndex('by_owner_period', (index) => index.eq('ownerId', user._id))
        .paginate(paginationOpts);
      return { section, ...page };
    }
    if (section === 'goals') {
      const page = await ctx.db
        .query('goals')
        .withIndex('by_owner', (index) => index.eq('ownerId', user._id))
        .paginate(paginationOpts);
      return { section, ...page };
    }
    if (section === 'goalContributions') {
      const page = await ctx.db.query('goalContributions')
        .withIndex('by_owner_occurredAt', (index) => index.eq('ownerId', user._id))
        .paginate(paginationOpts);
      return { section, ...page };
    }
    if (section === 'recurringRules') {
      const page = await ctx.db
        .query('recurringRules')
        .withIndex('by_owner_nextOccurrence', (index) => index.eq('ownerId', user._id))
        .paginate(paginationOpts);
      return { section, ...page };
    }
    if (section === 'notifications') {
      const page = await ctx.db.query('notifications')
        .withIndex('by_recipient_createdAt', (index) => index.eq('recipientId', user._id))
        .paginate(paginationOpts);
      return { section, ...page };
    }
    const page = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (index) => index.eq('userId', user._id))
      .paginate(paginationOpts);
    const groupIds = [...new Set(page.page.map((membership) => membership.groupId))];
    const [groups, members, expenses, settlements] = await Promise.all([
      Promise.all(groupIds.map((groupId) => ctx.db.get(groupId))).then((items) => items.filter(Boolean)),
      Promise.all(groupIds.map((groupId) =>
        ctx.db.query('groupMembers').withIndex('by_group', (index) => index.eq('groupId', groupId)).collect(),
      )).then((items) => items.flat()),
      Promise.all(groupIds.map((groupId) =>
        ctx.db.query('transactions').withIndex('by_group_occurredAt', (index) => index.eq('groupId', groupId)).order('desc').take(MAX_PAGE_SIZE),
      )).then((items) => items.flat()),
      Promise.all(groupIds.map((groupId) =>
        ctx.db.query('settlements').withIndex('by_group', (index) => index.eq('groupId', groupId)).collect(),
      )).then((items) => items.flat()),
    ]);
    const namedMembers = await Promise.all(members.map(async (member) => {
      const person = await ctx.db.get(member.userId);
      return { ...member, displayName: person?.displayName ?? person?.name ?? 'Finapp user',
        username: person?.username };
    }));
    const invites = await Promise.all(groupIds.map((groupId) =>
      ctx.db.query('groupInvites').withIndex('by_group', (index) => index.eq('groupId', groupId)).collect(),
    )).then((items) => items.flat());
    return { section, ...page, related: { groups, members: namedMembers, invites, expenses, settlements } };
  },
});

async function relatedTransactionData(
  ctx: Parameters<typeof getOptionalUser>[0],
  transactions: readonly { accountId: Id<'accounts'>; categoryId?: string; groupId?: string; _id: Id<'transactions'> }[],
) {
  const accountIds = [...new Set(transactions.map((transaction) => transaction.accountId))];
  const categoryIds = [...new Set(transactions.flatMap((transaction) => {
    const id = transaction.categoryId ? ctx.db.normalizeId('categories', transaction.categoryId) : null;
    return id ? [id] : [];
  }))];
  const groupIds = [...new Set(transactions.flatMap((transaction) => {
    const id = transaction.groupId ? ctx.db.normalizeId('groups', transaction.groupId) : null;
    return id ? [id] : [];
  }))];
  const [accounts, categories, groups, payers, participants, tags, receipts] = await Promise.all([
    Promise.all(accountIds.map((id) => ctx.db.get(id))).then((items) => items.flatMap((item) => item ? [item] : [])),
    Promise.all(categoryIds.map((id) => ctx.db.get(id))).then((items) => items.flatMap((item) => item ? [item] : [])),
    Promise.all(groupIds.map((id) => ctx.db.get(id))).then((items) => items.flatMap((item) => item ? [item] : [])),
    Promise.all(transactions.map((transaction) =>
      ctx.db.query('expensePayers').withIndex('by_transaction', (index) => index.eq('transactionId', transaction._id)).collect(),
    )).then((items) => items.flat()),
    Promise.all(transactions.map((transaction) =>
      ctx.db.query('expenseParticipants').withIndex('by_transaction', (index) => index.eq('transactionId', transaction._id)).collect(),
    )).then((items) => items.flat()),
    Promise.all(transactions.map((transaction) =>
      ctx.db.query('transactionTags').withIndex('by_transaction', (index) => index.eq('transactionId', transaction._id)).collect(),
    )).then((items) => items.flat()),
    Promise.all(transactions.map((transaction) =>
      ctx.db.query('receipts').withIndex('by_transaction', (index) => index.eq('transactionId', transaction._id)).collect(),
    )).then((items) => items.flat()),
  ]);
  const personIds = [...new Set([...payers, ...participants].map((entry) => entry.userId))];
  const people = await Promise.all(personIds.map(async (id) => {
    const person = await ctx.db.get(id);
    return person
      ? { _id: person._id, displayName: person.displayName, username: person.username, avatarStorageId: person.avatarStorageId }
      : null;
  })).then((items) => items.filter(Boolean));
  const publicAccounts = accounts.flatMap((account) =>
    account
      ? [{
          _id: account._id,
          name: account.name,
          ownerId: account.ownerId,
          type: account.type,
          customType: account.customType,
          currency: account.currency,
        }]
      : [],
  );
  return { accounts: publicAccounts, categories, groups, payers, participants, tags, receipts, people };
}

export const bootstrapTransactions = query({
  args: {
    windowDays: v.union(v.literal(7), v.literal(30), v.literal(90), v.literal(180), v.literal(365), v.literal(-1)),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { windowDays, paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertPageSize(paginationOpts.numItems);
    const endAt = Date.now();
    const startAt = windowDays === -1 ? 0 : endAt - windowDays * 86_400_000;
    const page = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (index) =>
        index.eq('ownerId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
      )
      .paginate(paginationOpts);
    return { ...page, related: await relatedTransactionData(ctx, page.page) };
  },
});

export const transactionRange = query({
  args: { startAt: v.number(), endAt: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { startAt, endAt, paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertRange(startAt, endAt);
    assertPageSize(paginationOpts.numItems);
    const page = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (index) =>
        index.eq('ownerId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
      )
      .paginate(paginationOpts);
    return { ...page, related: await relatedTransactionData(ctx, page.page) };
  },
});

export const groupRange = query({
  args: {
    groupId: v.id('groups'),
    startAt: v.number(),
    endAt: v.number(),
    paginationOpts: paginationOptsValidator,
    settlementPaginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { groupId, startAt, endAt, paginationOpts, settlementPaginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertRange(startAt, endAt);
    assertPageSize(settlementPaginationOpts.numItems);
    assertPageSize(paginationOpts.numItems);
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (index) => index.eq('groupId', groupId).eq('userId', user._id))
      .unique();
    if (!membership) throw new Error('INSUFFICIENT_PERMISSION');
    const [transactions, settlements] = await Promise.all([
      ctx.db.query('transactions')
        .withIndex('by_group_occurredAt', (index) =>
          index.eq('groupId', groupId).gte('occurredAt', startAt).lt('occurredAt', endAt),
        )
        .paginate(paginationOpts),
      ctx.db.query('settlements')
        .withIndex('by_group_occurredAt', (index) =>
          index.eq('groupId', groupId).gte('occurredAt', startAt).lt('occurredAt', endAt),
        )
        .paginate(settlementPaginationOpts),
    ]);
    const related = await relatedTransactionData(ctx, transactions.page);
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (index) => index.eq('groupId', groupId))
      .collect();
    const groupMembers = await Promise.all(memberships.map(async (member) => {
      const person = await ctx.db.get(member.userId);
      return {
        ...member,
        displayName: person?.displayName ?? 'Finapp user',
        username: person?.username,
      };
    }));
    const [group, payersAndParticipants] = await Promise.all([
      ctx.db.get(groupId),
      Promise.all(transactions.page.map(async (transaction) => {
        const [payers, participants] = await Promise.all([
          ctx.db.query('expensePayers').withIndex('by_transaction', (index) => index.eq('transactionId', transaction._id)).collect(),
          ctx.db.query('expenseParticipants').withIndex('by_transaction', (index) => index.eq('transactionId', transaction._id)).collect(),
        ]);
        return { transactionId: transaction._id, payers, participants };
      })),
    ]);
    return { group, groupMembers, transactions, settlements, related, payersAndParticipants };
  },
});

export const changes = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertPageSize(paginationOpts.numItems);
    const page = await ctx.db
      .query('syncChanges')
      .withIndex('by_user_revision', (index) => index.eq('scopeUserId', user._id))
      .paginate(paginationOpts);
    const state = await ctx.db
      .query('userSyncState')
      .withIndex('by_user', (index) => index.eq('userId', user._id))
      .unique();
    return { ...page, latestRevision: state?.revision ?? 0n };
  },
});

export const mutationReceipt = query({
  args: { clientMutationId: v.string() },
  handler: async (ctx, { clientMutationId }) => {
    const user = await authenticatedUser(ctx);
    const receipt = await ctx.db
      .query('processedMutations')
      .withIndex('by_actor_clientMutationId', (index) =>
        index.eq('actorId', user._id).eq('clientMutationId', clientMutationId),
      )
      .unique();
    if (!receipt) return null;
    return {
      operation: receipt.operation,
      serverId: receipt.resultEntityId,
      revision: receipt.revision?.toString() ?? null,
      updatedAt: receipt.serverUpdatedAt ?? null,
      result: receipt.resultPayload,
    };
  },
});

export const settlementRange = query({
  args: {
    direction: v.union(v.literal('from'), v.literal('to')),
    startAt: v.number(),
    endAt: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { direction, startAt, endAt, paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertRange(startAt, endAt);
    assertPageSize(paginationOpts.numItems);
    const page = direction === 'from'
      ? await ctx.db.query('settlements')
          .withIndex('by_from_user_occurredAt', (index) =>
            index.eq('fromUserId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
          )
          .paginate(paginationOpts)
      : await ctx.db.query('settlements')
          .withIndex('by_to_user_occurredAt', (index) =>
            index.eq('toUserId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
          )
          .paginate(paginationOpts);
    const groupIds = [...new Set(page.page.map((settlement) => settlement.groupId))];
    const groups = await Promise.all(groupIds.map((id) => ctx.db.get(id))).then((items) => items.filter(Boolean));
    return { ...page, groups };
  },
});

export const contributionRange = query({
  args: { startAt: v.number(), endAt: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { startAt, endAt, paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertRange(startAt, endAt);
    assertPageSize(paginationOpts.numItems);
    const page = await ctx.db.query('goalContributions')
      .withIndex('by_owner_occurredAt', (index) =>
        index.eq('ownerId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
      )
      .paginate(paginationOpts);
    const goals = await Promise.all([...new Set(page.page.map((item) => item.goalId))].map((id) => ctx.db.get(id)))
      .then((items) => items.filter(Boolean));
    return { ...page, goals };
  },
});

export const notificationRange = query({
  args: { startAt: v.number(), endAt: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { startAt, endAt, paginationOpts }) => {
    const user = await authenticatedUser(ctx);
    assertRange(startAt, endAt);
    assertPageSize(paginationOpts.numItems);
    return ctx.db.query('notifications')
      .withIndex('by_recipient_createdAt', (index) =>
        index.eq('recipientId', user._id).gte('createdAt', startAt).lt('createdAt', endAt),
      )
      .paginate(paginationOpts);
  },
});
