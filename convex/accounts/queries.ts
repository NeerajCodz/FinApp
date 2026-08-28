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
    return visibleAccounts(
      accounts.map((account) => ({
        id: account._id,
        name: account.name,
        currency: account.currency,
        balanceMinor: account.openingBalanceMinor,
        archivedAt: account.archivedAt,
      })),
    );
  },
});
