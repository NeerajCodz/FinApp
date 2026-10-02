import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { requireOwner } from '../shared/permissions';
import { assertCurrency } from '../shared/validators';
import { publishMutationResult, replayMutationResult, recordSyncChange } from '../sync/common';
import { assertClientId, assertClientIdAvailable } from '../shared/clientId';

export type AccountDraft<OwnerId extends string = string> = {
  ownerId: OwnerId;
  name: string;
  type: 'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other';
  customType?: string;
  currency: string;
  openingBalanceMinor: bigint;
  icon?: string;
  color?: string;
  isIncludedInTotal: boolean;
  notes?: string;
  provider?: string;
  accountNumber?: string;
  openedAt?: number;
  includeInAnalytics?: boolean;
  clientId?: string;
};

export function createAccountRecord<OwnerId extends string>(
  actorId: OwnerId,
  draft: AccountDraft<OwnerId>,
) {
  requireOwner(actorId, draft.ownerId);
  if (!draft.name.trim() || draft.openingBalanceMinor < 0n) throw new Error('INVALID_ACCOUNT');
  if (draft.openedAt !== undefined && !Number.isFinite(draft.openedAt))
    throw new Error('INVALID_ACCOUNT');
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
    color: v.optional(v.string()),
    notes: v.optional(v.string()),
    provider: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    openedAt: v.optional(v.number()),
    includeInAnalytics: v.optional(v.boolean()),
    clientMutationId: v.optional(v.string()),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertClientId(args.clientId);
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (user.emailVerificationTime === undefined) throw new Error('EMAIL_NOT_VERIFIED');
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
    await assertClientIdAvailable(args.clientId, () =>
      ctx.db
        .query('accounts')
        .withIndex('by_clientId', (query) => query.eq('clientId', args.clientId!))
        .unique(),
    );
    assertCurrency(args.currency);
    if (args.icon !== undefined && (args.icon.length === 0 || args.icon.length > 80))
      throw new Error('INVALID_ACCOUNT');
    if (args.color !== undefined && !/^#[\da-f]{6}$/i.test(args.color))
      throw new Error('INVALID_ACCOUNT');
    const { clientMutationId, clientId, ...accountArgs } = args;
    const record = createAccountRecord(user._id, {
      ...accountArgs,
      ownerId: user._id,
      clientId,
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

export const updateDetails = mutation({
  args: {
    accountId: v.id('accounts'),
    name: v.string(),
    type: v.union(
      v.literal('cash'),
      v.literal('bank'),
      v.literal('card'),
      v.literal('wallet'),
      v.literal('loan'),
      v.literal('other'),
    ),
    customType: v.optional(v.union(v.string(), v.null())),
    currency: v.string(),
    openingBalanceMinor: v.int64(),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
    isIncludedInTotal: v.boolean(),
    notes: v.optional(v.union(v.string(), v.null())),
    provider: v.optional(v.union(v.string(), v.null())),
    accountNumber: v.optional(v.union(v.string(), v.null())),
    openedAt: v.optional(v.union(v.number(), v.null())),
    includeInAnalytics: v.optional(v.boolean()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.updateDetails',
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
    const customType =
      args.type === 'other'
        ? args.customType === undefined
          ? account.customType
          : args.customType?.trim()
        : undefined;
    if (
      !name ||
      name.length > 80 ||
      args.openingBalanceMinor < 0n ||
      (args.type === 'other' && (!customType || customType.length > 40)) ||
      (args.icon !== null && args.icon !== undefined && (!args.icon || args.icon.length > 80)) ||
      (args.color !== undefined && args.color !== null && !/^#[\da-f]{6}$/i.test(args.color))
    )
      throw new Error('INVALID_ACCOUNT');
    assertCurrency(args.currency);
    if (args.openedAt !== undefined && args.openedAt !== null && !Number.isFinite(args.openedAt))
      throw new Error('INVALID_ACCOUNT');
    if (args.currency !== account.currency) {
      const sourceTransaction = await ctx.db
        .query('transactions')
        .withIndex('by_account', (q) => q.eq('accountId', args.accountId))
        .first();
      const destinationTransaction = await ctx.db
        .query('transactions')
        .withIndex('by_transferAccountId', (q) => q.eq('transferAccountId', String(args.accountId)))
        .first();
      if (sourceTransaction || destinationTransaction) throw new Error('ACCOUNT_CURRENCY_IN_USE');
      const [goals, budgets] = await Promise.all([
        ctx.db
          .query('goals')
          .withIndex('by_owner', (q) => q.eq('ownerId', user._id))
          .collect(),
        ctx.db
          .query('budgets')
          .withIndex('by_owner_period', (q) => q.eq('ownerId', user._id))
          .collect(),
      ]);
      const accountId = String(args.accountId);
      if (
        goals.some((goal) => goal.accountId === accountId) ||
        budgets.some(
          (budget) => budget.accountId === accountId || budget.accountIds?.includes(accountId),
        )
      )
        throw new Error('ACCOUNT_CURRENCY_IN_USE');
    }
    const updatedAt = Date.now();
    await ctx.db.patch(args.accountId, {
      name,
      type: args.type,
      customType,
      currency: args.currency,
      openingBalanceMinor: args.openingBalanceMinor,
      ...(args.icon !== undefined ? { icon: args.icon ?? undefined } : {}),
      ...(args.color !== undefined ? { color: args.color ?? undefined } : {}),
      isIncludedInTotal: args.isIncludedInTotal,
      ...(args.notes !== undefined ? { notes: args.notes ?? undefined } : {}),
      ...(args.provider !== undefined ? { provider: args.provider ?? undefined } : {}),
      ...(args.accountNumber !== undefined
        ? { accountNumber: args.accountNumber ?? undefined }
        : {}),
      ...(args.openedAt !== undefined ? { openedAt: args.openedAt ?? undefined } : {}),
      ...(args.includeInAnalytics !== undefined
        ? { includeInAnalytics: args.includeInAnalytics }
        : {}),
      updatedAt,
    });
    const updated = await ctx.db.get(args.accountId);
    if (!updated) throw new Error('ACCOUNT_UNAVAILABLE');
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'account.updateDetails',
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
