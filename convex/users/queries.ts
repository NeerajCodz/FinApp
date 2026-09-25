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
