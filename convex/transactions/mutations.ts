import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { DomainError } from '../shared/errors';
import { requireUser } from '../shared/auth';
import { requireOwner } from '../shared/permissions';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { assertAccountCanReceiveTransaction, type AccountDraft } from '../accounts/mutations';
import { assertMutationAvailable, transactionSignedAmount } from './domain';
import { getMutationReceipt, recordSyncChange, storeMutationReceipt } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { aggregateBudgetSpending, budgetAlertThresholdCrossed } from '../budgets/domain';
import { assertClientId, assertClientIdAvailable } from '../shared/clientId';

export type TransactionDraft = {
  ownerId: string;
  accountId: string;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  amountMinor: bigint;
  currency: string;
  title: string;
  merchant?: string;
  note?: string;
  categoryId?: string;
  transferAccountId?: string;
  occurredAt: number;
  hasTime?: boolean;
  clientMutationId: string;
};
export type TransactionDependencies = {
  account: AccountDraft & { archivedAt?: number };
  transferAccount?: AccountDraft & { archivedAt?: number };
  processedMutation: { clientMutationId: string } | null;
  category?: { ownerId: string; archivedAt?: number };
};

export function createTransaction(
  actorId: string,
  draft: TransactionDraft,
  dependencies: TransactionDependencies,
) {
  requireOwner(actorId, draft.ownerId);
  assertMutationAvailable(dependencies.processedMutation, draft.clientMutationId);
  assertCurrency(draft.currency);
  assertPositiveAmount(draft.amountMinor);
  if (dependencies.account.ownerId !== draft.ownerId)
    throw new DomainError('INSUFFICIENT_PERMISSION');
  assertAccountCanReceiveTransaction(dependencies.account);
  if (dependencies.account.currency !== draft.currency) throw new DomainError('INVALID_CURRENCY');
  if (draft.categoryId !== undefined) {
    const category = dependencies.category;
    if (
      !category ||
      category.ownerId !== draft.ownerId ||
      category.archivedAt !== undefined ||
      (draft.type !== 'expense' && draft.type !== 'income')
    )
      throw new Error('INVALID_CATEGORY');
  }
  if (draft.type === 'transfer') {
    if (
      !dependencies.transferAccount ||
      dependencies.transferAccount.currency !== draft.currency ||
      dependencies.transferAccount.ownerId !== draft.ownerId ||
      dependencies.transferAccount.name === dependencies.account.name
    )
      throw new DomainError('INVALID_CURRENCY');
  } else if (draft.transferAccountId) {
    throw new DomainError('INVALID_SPLIT');
  }
  return {
    ...draft,
    status: 'posted' as const,
    signedAmountMinor: transactionSignedAmount(draft.type, draft.amountMinor),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export const create = mutation({
  args: {
    accountId: v.id('accounts'),
    type: v.union(
      v.literal('expense'),
      v.literal('income'),
      v.literal('transfer'),
      v.literal('refund'),
      v.literal('adjustment'),
    ),
    amountMinor: v.int64(),
    currency: v.string(),
    categoryId: v.optional(v.id('categories')),
    title: v.string(),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    transferAccountId: v.optional(v.id('accounts')),
    occurredAt: v.number(),
    hasTime: v.optional(v.boolean()),
    clientMutationId: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertClientId(args.clientId);
    if (!user) throw new DomainError('AUTH_REQUIRED');
    const previousReceipt = await getMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'transaction.create',
    );
    if (previousReceipt) {
      const previousId = ctx.db.normalizeId('transactions', previousReceipt.resultEntityId ?? '');
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    await assertClientIdAvailable(args.clientId, () =>
      ctx.db
        .query('transactions')
        .withIndex('by_clientId', (query) => query.eq('clientId', args.clientId!))
        .unique(),
    );
    const account = await ctx.db.get(args.accountId);
    const transferAccount = args.transferAccountId
      ? ((await ctx.db.get(args.transferAccountId)) ?? undefined)
      : undefined;
    if (!user || !account) throw new DomainError('AUTH_REQUIRED');
    const category = args.categoryId
      ? ((await ctx.db.get(args.categoryId)) ?? undefined)
      : undefined;
    const processedMutation = null;
    const result = createTransaction(
      user._id,
      {
        ...args,
        ownerId: user._id,
        accountId: args.accountId,
        transferAccountId: args.transferAccountId,
        merchant: args.merchant,
        note: args.note,
      },
      { account, transferAccount, processedMutation, category },
    );
    const {
      clientMutationId: _clientMutationId,
      signedAmountMinor: _signedAmountMinor,
      ...resultRecord
    } = result;
    const record = {
      ...resultRecord,
      ownerId: user._id,
      clientId: args.clientId,
      accountId: args.accountId,
      transferAccountId: args.transferAccountId,
      ...(args.hasTime !== undefined ? { hasTime: args.hasTime } : {}),
    };
    const transactionId = await ctx.db.insert('transactions', record);
    const updatedAt = record.updatedAt;
    const revision = await recordSyncChange(
      ctx,
      user._id,
      'transactions',
      transactionId,
      updatedAt,
      { ...record, _id: transactionId },
      undefined,
      args.clientMutationId,
    );
    await storeMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'transaction.create',
      transactionId,
      transactionId,
      revision,
      updatedAt,
    );
    if (args.type === 'expense') {
      const budgets = await ctx.db
        .query('budgets')
        .withIndex('by_owner_period', (query) => query.eq('ownerId', user._id))
        .collect();
      const categories = await ctx.db
        .query('categories')
        .withIndex('by_owner', (query) => query.eq('ownerId', user._id))
        .collect();
      const excludedCategoryIds = new Set(
        categories
          .filter((entry) => entry.includeInBudgets === false)
          .map((entry) => String(entry._id)),
      );
      const active = budgets.filter(
        (budget) =>
          budget.archivedAt === undefined &&
          budget.currency === args.currency &&
          args.occurredAt >= budget.startAt &&
          args.occurredAt < budget.endAt &&
          (budget.period !== 'category' || budget.categoryId === args.categoryId) &&
          (budget.period !== 'account' || budget.accountId === args.accountId) &&
          (!budget.accountIds?.length || budget.accountIds.includes(String(args.accountId))) &&
          (args.categoryId === undefined || !excludedCategoryIds.has(String(args.categoryId))),
      );
      if (active.length) {
        const startAt = Math.min(...active.map((budget) => budget.startAt));
        const endAt = Math.max(...active.map((budget) => budget.endAt));
        const spending = await ctx.db
          .query('transactions')
          .withIndex('by_owner_occurredAt', (query) =>
            query.eq('ownerId', user._id).gte('occurredAt', startAt).lt('occurredAt', endAt),
          )
          .collect();
        for (const budget of active) {
          const current = aggregateBudgetSpending(spending, budget, excludedCategoryIds);
          const previous = current - args.amountMinor;
          const configuredThreshold = budget.alertThreshold ?? 80;
          const threshold =
            previous < budget.amountMinor && current >= budget.amountMinor
              ? 100
              : budgetAlertThresholdCrossed(
                    previous,
                    current,
                    budget.amountMinor,
                    configuredThreshold,
                  )
                ? configuredThreshold
                : null;
          if (threshold !== null)
            await createNotification(
              ctx,
              user._id,
              `budget:${budget._id}:${budget.startAt}:${threshold}`,
              'budget',
              'budget',
              String(budget._id),
              `${budget.name}: ${threshold}% used`,
              threshold === 100
                ? 'You reached this budget limit.'
                : 'You are nearing this budget limit.',
            );
        }
      }
    }
    await createNotification(
      ctx,
      user._id,
      `transaction:${transactionId}`,
      'transaction',
      'transaction',
      String(transactionId),
      'Transaction recorded',
      record.title,
    );
    return transactionId;
  },
});
export const update = mutation({
  args: {
    transactionId: v.id('transactions'),
    accountId: v.id('accounts'),
    type: v.union(v.literal('expense'), v.literal('income'), v.literal('transfer')),
    amountMinor: v.int64(),
    currency: v.string(),
    categoryId: v.optional(v.id('categories')),
    title: v.string(),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    transferAccountId: v.optional(v.id('accounts')),
    occurredAt: v.number(),
    hasTime: v.optional(v.boolean()),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new DomainError('AUTH_REQUIRED');
    const previousReceipt = await getMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'transaction.update',
    );
    if (previousReceipt) {
      const previousId = ctx.db.normalizeId('transactions', previousReceipt.resultEntityId ?? '');
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const transaction = await ctx.db.get(args.transactionId);
    if (
      !transaction ||
      transaction.ownerId !== user._id ||
      transaction.deletedAt !== undefined ||
      transaction.groupId !== undefined
    )
      throw new DomainError('INSUFFICIENT_PERMISSION');
    const [account, transferAccount, category] = await Promise.all([
      ctx.db.get(args.accountId),
      args.transferAccountId ? ctx.db.get(args.transferAccountId) : Promise.resolve(null),
      args.categoryId ? ctx.db.get(args.categoryId) : Promise.resolve(null),
    ]);
    if (!account || account.ownerId !== user._id) throw new DomainError('INSUFFICIENT_PERMISSION');
    assertCurrency(args.currency);
    assertPositiveAmount(args.amountMinor);
    assertAccountCanReceiveTransaction(account);
    if (account.currency !== args.currency) throw new DomainError('INVALID_CURRENCY');
    if (args.categoryId !== undefined) {
      if (
        !category ||
        category.ownerId !== user._id ||
        category.archivedAt !== undefined ||
        (args.type !== 'expense' && args.type !== 'income')
      )
        throw new Error('INVALID_CATEGORY');
    }
    if (args.type === 'transfer') {
      if (
        !transferAccount ||
        transferAccount.ownerId !== user._id ||
        transferAccount.archivedAt !== undefined ||
        transferAccount.currency !== args.currency ||
        String(transferAccount._id) === String(account._id)
      )
        throw new DomainError('INVALID_CURRENCY');
    } else if (args.transferAccountId !== undefined) {
      throw new DomainError('INVALID_SPLIT');
    }
    if (args.type !== 'transfer' && !args.categoryId) throw new Error('INVALID_CATEGORY');
    if (!args.title.trim() || !Number.isSafeInteger(args.occurredAt) || args.occurredAt <= 0)
      throw new Error('INVALID_TRANSACTION');
    const updatedAt = Date.now();
    const patch = {
      accountId: args.accountId,
      type: args.type,
      amountMinor: args.amountMinor,
      currency: args.currency,
      categoryId: args.categoryId,
      title: args.title.trim(),
      merchant: args.merchant?.trim() || undefined,
      note: args.note?.trim() || undefined,
      transferAccountId: args.transferAccountId,
      occurredAt: args.occurredAt,
      hasTime: args.hasTime,
      updatedAt,
    };
    await ctx.db.patch(args.transactionId, patch);
    const updated = await ctx.db.get(args.transactionId);
    if (!updated) throw new DomainError('INSUFFICIENT_PERMISSION');
    const revision = await recordSyncChange(
      ctx,
      user._id,
      'transactions',
      args.transactionId,
      updatedAt,
      { ...updated, _id: args.transactionId },
      undefined,
      args.clientMutationId,
    );
    await storeMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'transaction.update',
      args.transactionId,
      args.transactionId,
      revision,
      updatedAt,
    );
    return args.transactionId;
  },
});
export const softDelete = mutation({
  args: {
    transactionId: v.id('transactions'),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new DomainError('AUTH_REQUIRED');
    const previousReceipt = await getMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'transaction.delete',
    );
    if (previousReceipt) {
      const previousId = ctx.db.normalizeId('transactions', previousReceipt.resultEntityId ?? '');
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const transaction = await ctx.db.get(args.transactionId);
    if (
      !transaction ||
      transaction.ownerId !== user._id ||
      transaction.deletedAt !== undefined ||
      transaction.groupId !== undefined
    )
      throw new DomainError('INSUFFICIENT_PERMISSION');
    const deletedAt = Date.now();
    await ctx.db.patch(args.transactionId, { deletedAt, updatedAt: deletedAt });
    const updated = await ctx.db.get(args.transactionId);
    if (!updated) throw new DomainError('INSUFFICIENT_PERMISSION');
    const revision = await recordSyncChange(
      ctx,
      user._id,
      'transactions',
      args.transactionId,
      deletedAt,
      { ...updated, _id: args.transactionId },
      undefined,
      args.clientMutationId,
    );
    await storeMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'transaction.delete',
      args.transactionId,
      args.transactionId,
      revision,
      deletedAt,
    );
    return args.transactionId;
  },
});
