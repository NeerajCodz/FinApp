import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { assertCurrency } from '../shared/validators';
import {
  normalizePhone,
  normalizeUsername,
  validateProfileUpdate,
  type AccentValue,
  type ProfileUpdate,
  type UserSettings,
} from './domain';
import type { AvatarGender } from '../avatars/domain';
import { publishMutationResult, replayMutationResult, recordSyncChange } from '../sync/common';

type UserMutationContext = Parameters<typeof requireUser>[0];

type ProfileUpdateArgs = {
  displayName?: string;
  username?: string;
  phone?: string;
  defaultCurrency?: string;
  timezone?: string;
  accent?: AccentValue;
  avatarId?: string;
  gender?: AvatarGender;
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
  if (update.accent !== undefined) normalized.accent = update.accent.trim() as AccentValue;
  if (update.avatarId !== undefined) normalized.avatarId = update.avatarId.trim().toUpperCase();
  if (update.gender !== undefined) normalized.gender = update.gender;
  return normalized;
}
async function validateAvatarSelection(
  ctx: UserMutationContext,
  user: { avatarId?: string },
  update: ProfileUpdate,
): Promise<ProfileUpdate> {
  if (update.avatarId === undefined && update.gender === undefined) return update;
  const avatarId = update.avatarId ?? user.avatarId;
  if (!avatarId) throw new Error('INVALID_AVATAR');
  const avatar = await ctx.db
    .query('avatars')
    .withIndex('by_avatarId', (query) => query.eq('avatarId', avatarId))
    .unique();
  if (!avatar) throw new Error('INVALID_AVATAR');
  if (update.gender !== undefined && update.gender !== avatar.gender)
    throw new Error('AVATAR_GENDER_MISMATCH');
  return { ...update, avatarId, gender: avatar.gender };
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
  const profileUpdate = await validateAvatarSelection(ctx, user, normalized);
  if (profileUpdate.defaultCurrency !== undefined) assertCurrency(profileUpdate.defaultCurrency);
  const updatedAt = Date.now();
  const patch = profilePatch(user, profileUpdate, updatedAt);
  await ctx.db.patch(user._id, patch);
  return { ...user, ...patch };
}

export const update = mutation({
  args: {
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    phone: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    accent: v.optional(v.string()),
    avatarId: v.optional(v.string()),
    gender: v.optional(v.union(v.literal('neutral'), v.literal('male'), v.literal('female'))),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args: ProfileUpdateArgs) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'user.update');
    if (replay.found) return replay.result;
    const normalized = normalizeProfileUpdate(args);
    validateProfileUpdate(normalized);
    const profileUpdate = await validateAvatarSelection(ctx, user, normalized);
    if (profileUpdate.defaultCurrency !== undefined) assertCurrency(profileUpdate.defaultCurrency);
    if (profileUpdate.username !== undefined && profileUpdate.username !== user.username) {
      const taken = await ctx.db
        .query('users')
        .withIndex('by_username', (query) => query.eq('username', profileUpdate.username))
        .unique();
      if (taken && taken._id !== user._id) throw new Error('USERNAME_TAKEN');
    }
    const updatedAt = Date.now();
    const patch = profilePatch(user, profileUpdate, updatedAt);
    await ctx.db.patch(user._id, patch);
    let settingsSyncChange: { id: string; document: unknown } | null = null;
    if (profileUpdate.defaultCurrency !== undefined || profileUpdate.timezone !== undefined) {
      const settings = await ctx.db
        .query('userSettings')
        .withIndex('by_user', (query) => query.eq('userId', user._id))
        .unique();
      if (settings) {
        const settingsPatch = {
          ...(normalized.defaultCurrency !== undefined
            ? { currency: normalized.defaultCurrency }
            : {}),
          ...(normalized.timezone !== undefined ? { timezone: normalized.timezone } : {}),
          updatedAt,
        };
        settingsSyncChange = {
          id: String(settings._id),
          document: { ...settings, ...settingsPatch },
        };
        await ctx.db.patch(settings._id, settingsPatch);
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

export const setTwoFactorEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (enabled && user.emailVerificationTime === undefined) {
      throw new Error('EMAIL_NOT_VERIFIED');
    }

    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique();
    const updatedAt = Date.now();
    if (settings) {
      await ctx.db.patch(settings._id, { twoFactorEnabled: enabled, updatedAt });
    } else {
      await ctx.db.insert('userSettings', {
        userId: user._id,
        currency: user.defaultCurrency ?? 'INR',
        timezone: user.timezone ?? 'Asia/Kolkata',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: {},
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        twoFactorEnabled: enabled,
        updatedAt,
      });
    }
    await ctx.db.patch(user._id, { updatedAt, signupTwoFactorEnabled: undefined });
    return { twoFactorEnabled: enabled };
  },
});

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
