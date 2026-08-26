import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { DomainError } from '../shared/errors';
import { requireIdentity } from '../shared/auth';
import { requireOwner } from '../shared/permissions';
import { assertCurrency, assertPositiveAmount } from '../shared/validators';
import { assertAccountCanReceiveTransaction, type AccountDraft } from '../accounts/mutations';
import { assertMutationAvailable, transactionSignedAmount } from './domain';

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
  category?: { archivedAt?: number };
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
  assertAccountCanReceiveTransaction(dependencies.account);
  if (dependencies.category) {
    if (dependencies.category.archivedAt !== undefined)
      throw new DomainError('INVALID_SPLIT', 'INVALID_CATEGORY');
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
    categoryId: v.optional(v.string()),
    title: v.string(),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    transferAccountId: v.optional(v.id('accounts')),
    occurredAt: v.number(),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
    const account = await ctx.db.get(args.accountId);
    const transferAccount = args.transferAccountId
      ? ((await ctx.db.get(args.transferAccountId)) ?? undefined)
      : undefined;
    if (!user || !account) throw new DomainError('AUTH_REQUIRED');
    const processedMutation = await ctx.db
      .query('processedMutations')
      .withIndex('by_actor_clientMutationId', (q) =>
        q.eq('actorId', user._id).eq('clientMutationId', args.clientMutationId),
      )
      .unique();
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
      { account, transferAccount, processedMutation },
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
    await ctx.db.insert('processedMutations', {
      actorId: user._id,
      clientMutationId: args.clientMutationId,
      operation: 'transaction.create',
      resultEntityId: transactionId,
      createdAt: Date.now(),
    });
    return transactionId;
  },
});
