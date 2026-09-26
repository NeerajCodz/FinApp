import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency } from '../shared/validators';
import {
  normalizePhone,
  normalizeUsername,
  validateProfileUpdate,
  type ProfileUpdate,
  type UserSettings,
} from './domain';
import { publishMutationResult, replayMutationResult, recordSyncChange } from '../sync/common';

type UserMutationContext = Parameters<typeof requireUser>[0];

type ProfileUpdateArgs = {
  displayName?: string;
  username?: string;
  phone?: string;
  defaultCurrency?: string;
  clientMutationId?: string;
};

function normalizeProfileUpdate(update: ProfileUpdate): ProfileUpdate {
  const normalized: ProfileUpdate = {};
  if (update.displayName !== undefined) normalized.displayName = update.displayName.trim();
  if (update.username !== undefined) normalized.username = normalizeUsername(update.username);
  if (update.phone !== undefined) normalized.phone = normalizePhone(update.phone);
  if (update.defaultCurrency !== undefined)
    normalized.defaultCurrency = update.defaultCurrency.toUpperCase();
  if (update.timezone !== undefined) normalized.timezone = update.timezone.trim();
  return normalized;
}

function profilePatch(user: { phone?: string }, update: ProfileUpdate, updatedAt: number) {
  return {
    ...update,
    ...(update.phone !== undefined && update.phone !== user.phone
      ? { phoneVerificationTime: undefined }
      : {}),
    updatedAt,
  };
}

export async function updateProfile(ctx: UserMutationContext, update: ProfileUpdate) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  const normalized = normalizeProfileUpdate(update);
  validateProfileUpdate(normalized);
  if (normalized.defaultCurrency !== undefined) assertCurrency(normalized.defaultCurrency);
  const updatedAt = Date.now();
  const patch = profilePatch(user, normalized, updatedAt);
  await ctx.db.patch(user._id, patch);
  return { ...user, ...patch };
}

export const update = mutation({
  args: {
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    phone: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args: ProfileUpdateArgs) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'user.update');
    if (replay.found) return replay.result;
    const normalized = normalizeProfileUpdate(args);
    validateProfileUpdate(normalized);
    if (normalized.defaultCurrency !== undefined) assertCurrency(normalized.defaultCurrency);
    if (normalized.username !== undefined && normalized.username !== user.username) {
      const taken = await ctx.db
        .query('users')
        .withIndex('by_username', (query) => query.eq('username', normalized.username))
        .unique();
      if (taken && taken._id !== user._id) throw new Error('USERNAME_TAKEN');
    }
    const updatedAt = Date.now();
    const patch = profilePatch(user, normalized, updatedAt);
    await ctx.db.patch(user._id, patch);
    let settingsSyncChange: { id: string; document: unknown } | null = null;
    if (normalized.defaultCurrency !== undefined) {
      const settings = await ctx.db
        .query('userSettings')
        .withIndex('by_user', (query) => query.eq('userId', user._id))
        .unique();
      if (settings) {
        settingsSyncChange = {
          id: String(settings._id),
          document: { ...settings, currency: normalized.defaultCurrency, updatedAt },
        };
        await ctx.db.patch(settings._id, { currency: normalized.defaultCurrency, updatedAt });
      }
    }
    const updated = { ...user, ...patch };
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'user.update',
      updated,
      'users',
      String(user._id),
      updatedAt,
      { ...updated, _id: user._id },
    );
    if (settingsSyncChange) {
      await recordSyncChange(
        ctx,
        user._id,
        'userSettings',
        settingsSyncChange.id,
        updatedAt,
        settingsSyncChange.document,
      );
    }
    return updated;
  },
});

export async function updateSettings(ctx: UserMutationContext, settings: Partial<UserSettings>) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  await ctx.db.patch(user._id, { updatedAt: Date.now() });
  return settings;
}

export async function requestAccountDeletion(ctx: UserMutationContext) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  const deletedAt = Date.now();
  await ctx.db.patch(user._id, { deletedAt, updatedAt: deletedAt });
  return { deletedAt };
}

export const setDefaultAccount = mutation({
  args: {
    accountId: v.union(v.id('accounts'), v.null()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'user.defaultAccount',
    );
    if (replay.found) return replay.result;
    if (args.accountId !== null) {
      const account = await ctx.db.get(args.accountId);
      if (!account || account.ownerId !== user._id || account.archivedAt !== undefined)
        throw new Error('INVALID_ACCOUNT');
    }
    const updatedAt = Date.now();
    const patch = { defaultAccountId: args.accountId ?? undefined, updatedAt };
    await ctx.db.patch(user._id, patch);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'user.defaultAccount',
      args.accountId,
      'users',
      String(user._id),
      updatedAt,
      { ...user, ...patch, _id: user._id },
    );
    return args.accountId;
  },
});

export const setDefaultCategory = mutation({
  args: {
    transactionType: v.union(v.literal('expense'), v.literal('income')),
    categoryId: v.union(v.id('categories'), v.null()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'user.defaultCategory',
    );
    if (replay.found) return replay.result;
    if (args.categoryId !== null) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
        throw new Error('INVALID_CATEGORY');
    }
    const updatedAt = Date.now();
    const patch = {
      [args.transactionType === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId']:
        args.categoryId ?? undefined,
      updatedAt,
    };
    await ctx.db.patch(user._id, patch);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'user.defaultCategory',
      args.categoryId,
      'users',
      String(user._id),
      updatedAt,
      { ...user, ...patch, _id: user._id },
    );
    return args.categoryId;
  },
});
