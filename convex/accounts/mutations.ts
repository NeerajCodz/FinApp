import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireIdentity } from '../shared/auth';
import { requireOwner } from '../shared/permissions';

export type AccountDraft<OwnerId extends string = string> = {
  ownerId: OwnerId;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  currency: string;
  openingBalanceMinor: bigint;
  isIncludedInTotal: boolean;
};

export function createAccountRecord<OwnerId extends string>(
  actorId: OwnerId,
  draft: AccountDraft<OwnerId>,
) {
  requireOwner(actorId, draft.ownerId);
  if (!draft.name.trim() || draft.openingBalanceMinor < 0n) throw new Error('INVALID_ACCOUNT');
  return {
    ...draft,
    name: draft.name.trim(),
    archivedAt: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function archiveAccountRecord(
  actorId: string,
  account: AccountDraft & { ownerId: string; archivedAt?: number },
) {
  requireOwner(actorId, account.ownerId);
  return { ...account, archivedAt: Date.now(), updatedAt: Date.now() };
}

export function assertAccountCanReceiveTransaction(account: { archivedAt?: number }): void {
  if (account.archivedAt !== undefined) throw new Error('ACCOUNT_ARCHIVED');
}

export const create = mutation({
  args: {
    name: v.string(),
    type: v.string(),
    currency: v.string(),
    openingBalanceMinor: v.int64(),
    isIncludedInTotal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
    if (!user) throw new Error('AUTH_REQUIRED');
    const record = createAccountRecord(user._id, {
      ...args,
      ownerId: user._id,
      type: args.type as AccountDraft['type'],
    });
    return ctx.db.insert('accounts', record);
  },
});

export const archive = mutation({
  args: { accountId: v.id('accounts') },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const user = await ctx.db
      .query('users')
      .withIndex('by_identityId', (q) => q.eq('identityId', identity.subject))
      .unique();
    const account = await ctx.db.get(args.accountId);
    if (!user || !account) throw new Error('AUTH_REQUIRED');
    requireOwner(user._id, account.ownerId);
    await ctx.db.patch(args.accountId, { archivedAt: Date.now(), updatedAt: Date.now() });
    return args.accountId;
  },
});
