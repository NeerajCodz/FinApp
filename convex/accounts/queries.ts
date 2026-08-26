import { query } from '../_generated/server';
import { requireIdentity } from '../shared/auth';

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
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
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
