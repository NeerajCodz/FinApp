import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser, requireIdentity } from '../shared/auth';

export type AccountSummary = {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  currency: string;
  balanceMinor: bigint;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
  createdAt: number;
  archivedAt?: number;
};
export function visibleAccounts(accounts: readonly AccountSummary[]): AccountSummary[] {
  return accounts.filter((account) => account.archivedAt === undefined);
}

export const detail = query({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, { accountId }) => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const account = await ctx.db.get(accountId);
    if (!account || account.ownerId !== user._id || account.archivedAt !== undefined) return null;
    const [ownedAccounts, transactions] = await Promise.all([
      ctx.db
        .query('accounts')
        .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
        .collect(),
      ctx.db
        .query('transactions')
        .withIndex('by_owner_occurredAt', (q) => q.eq('ownerId', user._id))
        .order('desc')
        .collect(),
    ]);
    const balances = new Map(ownedAccounts.map((item) => [item._id, item.openingBalanceMinor]));
    const posted = transactions.filter(
      (transaction) => transaction.status === 'posted' && transaction.deletedAt === undefined,
    );
    for (const transaction of posted) {
      const outgoing = transaction.type === 'expense' || transaction.type === 'transfer';
      const source = balances.get(transaction.accountId);
      if (source !== undefined) {
        balances.set(
          transaction.accountId,
          source + (outgoing ? -transaction.amountMinor : transaction.amountMinor),
        );
      }
      if (transaction.type === 'transfer' && transaction.transferAccountId) {
        const destinationId = ctx.db.normalizeId('accounts', transaction.transferAccountId);
        if (destinationId) {
          const destination = balances.get(destinationId);
          if (destination !== undefined)
            balances.set(destinationId, destination + transaction.amountMinor);
        }
      }
    }
    const accountTransactions = posted
      .filter(
        (transaction) =>
          transaction.accountId === accountId || transaction.transferAccountId === accountId,
      )
      .slice(0, 50);
    return {
      account,
      balanceMinor: balances.get(accountId) ?? account.openingBalanceMinor,
      transactions: accountTransactions,
    };
  },
});
export const list = query({
  args: {},
  handler: async (ctx): Promise<AccountSummary[]> => {
    await requireIdentity(ctx);
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const accounts = await ctx.db
      .query('accounts')
      .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
      .collect();
    const balances = new Map(accounts.map((account) => [account._id, account.openingBalanceMinor]));
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_occurredAt', (q) => q.eq('ownerId', user._id))
      .collect();
    for (const transaction of transactions) {
      if (transaction.status !== 'posted' || transaction.deletedAt !== undefined) continue;
      const sourceBalance = balances.get(transaction.accountId);
      if (sourceBalance !== undefined) {
        const outgoing = transaction.type === 'expense' || transaction.type === 'transfer';
        balances.set(
          transaction.accountId,
          sourceBalance + (outgoing ? -transaction.amountMinor : transaction.amountMinor),
        );
      }
      if (transaction.type === 'transfer' && transaction.transferAccountId) {
        const destinationId = ctx.db.normalizeId('accounts', transaction.transferAccountId);
        if (destinationId) {
          const destinationBalance = balances.get(destinationId);
          if (destinationBalance !== undefined)
            balances.set(destinationId, destinationBalance + transaction.amountMinor);
        }
      }
    }
    return visibleAccounts(
      accounts.map((account) => ({
        id: account._id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        balanceMinor: balances.get(account._id) ?? account.openingBalanceMinor,
        icon: account.icon,
        color: account.color,
        isIncludedInTotal: account.isIncludedInTotal,
        createdAt: account.createdAt,
        archivedAt: account.archivedAt,
      })),
    );
  },
});
