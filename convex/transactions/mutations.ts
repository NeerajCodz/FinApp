import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { DomainError } from '../shared/errors';
import { requireUser } from '../shared/auth';
import { requireOwner } from '../shared/permissions';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { assertAccountCanReceiveTransaction, type AccountDraft } from '../accounts/mutations';
import { assertMutationAvailable, transactionSignedAmount } from './domain';
import { getMutationReceipt, recordSyncChange, storeMutationReceipt } from '../sync/common';

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
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
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
      accountId: args.accountId,
      transferAccountId: args.transferAccountId,
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
    return transactionId;
  },
});
