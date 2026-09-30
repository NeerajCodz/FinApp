import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { requireOwner } from '../shared/permissions';
import { assertCurrency } from '../shared/validators';
import { publishMutationResult, replayMutationResult, recordSyncChange } from '../sync/common';

export type AccountDraft<OwnerId extends string = string> = {
  ownerId: OwnerId;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  customType?: string;
  currency: string;
  openingBalanceMinor: bigint;
  icon?: string;
  isIncludedInTotal: boolean;
};

export function createAccountRecord<OwnerId extends string>(
  actorId: OwnerId,
  draft: AccountDraft<OwnerId>,
) {
  requireOwner(actorId, draft.ownerId);
  if (!draft.name.trim() || draft.openingBalanceMinor < 0n) throw new Error('INVALID_ACCOUNT');
  const customType = draft.type === 'other' ? draft.customType?.trim() : undefined;
  if (draft.type === 'other' && (!customType || customType.length > 40))
    throw new Error('INVALID_ACCOUNT');
  return {
    ...draft,
    name: draft.name.trim(),
    customType,
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
    type: v.union(
      v.literal('cash'),
      v.literal('bank'),
      v.literal('card'),
      v.literal('wallet'),
      v.literal('loan'),
      v.literal('other'),
    ),
    customType: v.optional(v.string()),
    currency: v.string(),
    openingBalanceMinor: v.int64(),
    isIncludedInTotal: v.boolean(),
    icon: v.optional(v.string()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.create',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('accounts', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    assertCurrency(args.currency);
    if (args.icon !== undefined && (args.icon.length === 0 || args.icon.length > 80))
      throw new Error('INVALID_ACCOUNT');
    const { clientMutationId, ...accountArgs } = args;
    const record = createAccountRecord(user._id, {
      ...accountArgs,
      ownerId: user._id,
      type: args.type as AccountDraft['type'],
    });
    const accountId = await ctx.db.insert('accounts', record);
    await publishMutationResult(
      ctx,
      user._id,
      clientMutationId,
      'account.create',
      accountId,
      'accounts',
      String(accountId),
      record.updatedAt,
      { ...record, _id: accountId },
    );
    return accountId;
  },
});

export const rename = mutation({
  args: { accountId: v.id('accounts'), name: v.string(), clientMutationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.rename',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('accounts', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
      throw new Error('ACCOUNT_UNAVAILABLE');
    const name = args.name.trim();
    if (!name) throw new Error('INVALID_ACCOUNT');
    const updatedAt = Date.now();
    await ctx.db.patch(args.accountId, { name, updatedAt });
    const updated = { ...account, name, updatedAt };
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.rename',
      args.accountId,
      'accounts',
      String(args.accountId),
      updatedAt,
      { ...updated, _id: args.accountId },
    );
    return args.accountId;
  },
});
export const setIcon = mutation({
  args: {
    accountId: v.id('accounts'),
    icon: v.union(v.string(), v.null()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.setIcon',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('accounts', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
      throw new Error('ACCOUNT_UNAVAILABLE');
    if (args.icon !== null && (args.icon.length === 0 || args.icon.length > 80))
      throw new Error('INVALID_ACCOUNT');
    const updatedAt = Date.now();
    await ctx.db.patch(args.accountId, { icon: args.icon ?? undefined, updatedAt });
    const updated = await ctx.db.get(args.accountId);
    if (!updated) throw new Error('ACCOUNT_UNAVAILABLE');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.setIcon',
      args.accountId,
      'accounts',
      String(args.accountId),
      updatedAt,
      { ...updated, _id: args.accountId },
    );
    return args.accountId;
  },
});

export const setColor = mutation({
  args: {
    accountId: v.id('accounts'),
    color: v.union(v.string(), v.null()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.setColor',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('accounts', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const account = await ctx.db.get(args.accountId);
    if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
      throw new Error('ACCOUNT_UNAVAILABLE');
    if (args.color !== null && !/^#[\da-f]{6}$/i.test(args.color))
      throw new Error('INVALID_ACCOUNT');
    const updatedAt = Date.now();
    await ctx.db.patch(args.accountId, { color: args.color ?? undefined, updatedAt });
    const updated = await ctx.db.get(args.accountId);
    if (!updated) throw new Error('ACCOUNT_UNAVAILABLE');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.setColor',
      args.accountId,
      'accounts',
      String(args.accountId),
      updatedAt,
      { ...updated, _id: args.accountId },
    );
    return args.accountId;
  },
});

export const archive = mutation({
  args: { accountId: v.id('accounts'), clientMutationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.archive',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('accounts', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const account = await ctx.db.get(args.accountId);
    if (!account) throw new Error('AUTH_REQUIRED');
    requireOwner(user._id, account.ownerId);
    const now = Date.now();
    await ctx.db.patch(args.accountId, { archivedAt: now, updatedAt: now });
    if (user.defaultAccountId === args.accountId) {
      const userUpdated = { ...user, defaultAccountId: undefined, updatedAt: now };
      await ctx.db.patch(user._id, { defaultAccountId: undefined, updatedAt: now });
      await recordSyncChange(ctx, user._id, 'users', String(user._id), now, userUpdated);
    }
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.archive',
      args.accountId,
      'accounts',
      String(args.accountId),
      now,
      { ...account, archivedAt: now, updatedAt: now, _id: args.accountId },
    );
    return args.accountId;
  },
});
