import { hasTotp } from '../mfa';
import { privacyFor } from '../security';
import { internalQuery, query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser } from '../shared/auth';
import { normalizeUsername, usernameProblem, type UsernameProblem } from './domain';
import { avatarUrlForUser } from '../avatars/helpers';

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
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    return { ...user, avatarUrl: await avatarUrlForUser(ctx, user) };
  },
});

export type UsernameAvailability =
  { status: 'available' | 'current' | 'taken' } | { status: 'invalid'; problem: UsernameProblem };

/** Live check for the profile editor: whether the signed-in user can take this username. */
export const usernameAvailability = query({
  args: { username: v.string() },
  handler: async (ctx, { username }): Promise<UsernameAvailability | null> => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const problem = usernameProblem(username);
    if (problem) return { status: 'invalid', problem };
    const normalized = normalizeUsername(username);
    if (normalized === user.username) return { status: 'current' };
    const owner = await ctx.db
      .query('users')
      .withIndex('by_username', (query) => query.eq('username', normalized))
      .first();
    return { status: owner && owner._id !== user._id ? 'taken' : 'available' };
  },
});

export const twoFactorEnabledForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user || user.deletedAt !== undefined) return false;
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (query) => query.eq('userId', userId))
      .unique();
    // An authenticator app always means a second step at sign-in.
    return (
      (settings?.twoFactorEnabled ?? user.signupTwoFactorEnabled ?? false) ||
      (await hasTotp(ctx, userId))
    );
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
    return (
      (settings?.twoFactorEnabled ?? user.signupTwoFactorEnabled ?? false) ||
      (await hasTotp(ctx, user._id))
    );
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
    return {
      twoFactorEnabled: settings?.twoFactorEnabled ?? user.signupTwoFactorEnabled ?? false,
    };
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
    const matches = users.filter(
      (user) =>
        user._id !== current._id &&
        user.deletedAt === undefined &&
        user.username?.startsWith(searchTerm),
    );
    // People who turned off discovery only show up for their exact username.
    const visible: typeof matches = [];
    for (const user of matches) {
      if (visible.length >= 20) break;
      if (user.username === searchTerm || (await privacyFor(ctx, user._id)).discoverable)
        visible.push(user);
    }
    return Promise.all(
      visible.map(async (user) => ({
        id: user._id,
        displayName: user.displayName ?? user.name ?? 'Finapp user',
        username: user.username,
        gender: user.gender,
        avatarId: user.avatarId,
        avatarUrl: (await avatarUrlForUser(ctx, user)) ?? undefined,
      })),
    );
  },
});

export const searchGroupProfiles = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const current = await getOptionalUser(ctx);
    if (!current) return [];
    const searchTerm = normalizeUsername(args.query);
    if (!/^[a-z0-9_]{2,32}$/.test(searchTerm)) return [];
    const users = await ctx.db
      .query('users')
      .withIndex('by_username', (q) =>
        q.gte('username', searchTerm).lte('username', `${searchTerm}\uffff`),
      )
      .filter((q) =>
        q.and(q.neq(q.field('_id'), current._id), q.eq(q.field('deletedAt'), undefined)),
      )
      .take(20);
    return Promise.all(
      users.map(async (user) => ({
        id: user._id,
        displayName: user.displayName ?? user.name ?? 'Finapp user',
        username: user.username,
        gender: user.gender,
        avatarId: user.avatarId,
        avatarUrl: (await avatarUrlForUser(ctx, user)) ?? undefined,
      })),
    );
  },
});
export const publicProfile = query({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const normalized = normalizeUsername(username);
    if (!/^[a-z0-9_]{3,32}$/.test(normalized)) return null;
    const user = await ctx.db
      .query('users')
      .withIndex('by_username', (q) => q.eq('username', normalized))
      .unique();
    if (!user || user.deletedAt !== undefined) return null;
    return {
      id: user._id,
      username: user.username,
      displayName: user.displayName ?? user.name ?? 'Finapp user',
      ...(user.avatarId === undefined ? {} : { avatarId: user.avatarId }),
      ...(user.bio ? { bio: user.bio } : {}),
      avatarUrl: await avatarUrlForUser(ctx, user),
    };
  },
});
