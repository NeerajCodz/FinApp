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

type UserMutationContext = Parameters<typeof requireUser>[0];

type ProfileUpdateArgs = {
  displayName?: string;
  username?: string;
  phone?: string;
  defaultCurrency?: string;
};

function normalizeProfileUpdate(update: ProfileUpdate): ProfileUpdate {
  return {
    ...update,
    displayName: update.displayName?.trim(),
    username: update.username === undefined ? undefined : normalizeUsername(update.username),
    phone: update.phone === undefined ? undefined : normalizePhone(update.phone),
    defaultCurrency: update.defaultCurrency?.toUpperCase(),
  };
}

export async function updateProfile(ctx: UserMutationContext, update: ProfileUpdate) {
  const user = await requireUser(ctx);
  if (!user) throw new Error('AUTH_REQUIRED');
  const normalized = normalizeProfileUpdate(update);
  validateProfileUpdate(normalized);
  if (normalized.defaultCurrency !== undefined) assertCurrency(normalized.defaultCurrency);
  await ctx.db.patch(user._id, { ...normalized, updatedAt: Date.now() });
  return { ...user, ...normalized, updatedAt: Date.now() };
}

export const update = mutation({
  args: {
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    phone: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args: ProfileUpdateArgs) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
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
    await ctx.db.patch(user._id, { ...normalized, updatedAt });
    if (normalized.defaultCurrency !== undefined) {
      const settings = await ctx.db
        .query('userSettings')
        .withIndex('by_user', (query) => query.eq('userId', user._id))
        .unique();
      if (settings)
        await ctx.db.patch(settings._id, { currency: normalized.defaultCurrency, updatedAt });
    }
    return { ...user, ...normalized, updatedAt };
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
