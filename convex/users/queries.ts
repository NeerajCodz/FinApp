import { internalQuery, query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser } from '../shared/auth';
import { normalizeUsername } from './domain';

export const loginEmailForUsername = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalizedUsername = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,32}$/.test(normalizedUsername)) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_username', (query) => query.eq('username', normalizedUsername))
      .unique();
    return user && user.deletedAt === undefined ? (user.email?.toLowerCase() ?? null) : null;
  },
});
export const current = query({
  args: {},
  handler: async (ctx) => getOptionalUser(ctx),
});

export const twoFactorEnabledForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (query) => query.eq('userId', userId))
      .unique();
    return settings?.twoFactorEnabled ?? false;
  },
});

export const twoFactorEnabledForEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query('users')
      .withIndex('email', (query) => query.eq('email', email.toLowerCase()))
      .unique();
    if (!user || user.deletedAt !== undefined) return false;
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique();
    return settings?.twoFactorEnabled ?? false;
  },
});

export const securityPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique();
    return { twoFactorEnabled: settings?.twoFactorEnabled ?? false };
  },
});

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const current = await getOptionalUser(ctx);
    if (!current) return [];
    const searchTerm = normalizeUsername(args.query);
    if (!searchTerm) return [];
    const users = await ctx.db.query('users').collect();
    return users
      .filter(
        (user) =>
          user._id !== current._id &&
          user.deletedAt === undefined &&
          user.username?.startsWith(searchTerm),
      )
      .slice(0, 20)
      .map((user) => ({
        id: user._id,
        displayName: user.displayName ?? user.name ?? 'Finapp user',
        username: user.username,
        image: user.image,
      }));
  },
});
