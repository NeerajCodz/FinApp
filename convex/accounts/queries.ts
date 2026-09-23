import { query } from '../_generated/server';
import { getOptionalUser, requireIdentity } from '../shared/auth';

export type AccountSummary = {
  id: string;
  name: string;
  currency: string;
  balanceMinor: bigint;
  archivedAt?: number;
};
export function visibleAccounts(accounts: readonly AccountSummary[]): AccountSummary[] {
  return accounts.filter((account) => account.archivedAt === undefined);
}

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
        currency: account.currency,
        balanceMinor: balances.get(account._id) ?? account.openingBalanceMinor,
        archivedAt: account.archivedAt,
      })),
    );
  },
});
