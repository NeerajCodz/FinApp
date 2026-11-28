/**
 * Account privacy and security: who can find you and send friend requests, presence, sign-in
 * alerts, and the devices signed in to your account (with sign out per device or everywhere
 * else). Devices are Convex Auth sessions; each app labels its session on start (`touchSession`).
 */
import { getAuthSessionId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server';
import { getOptionalUser, requireUser } from './shared/auth';
import { createNotification } from './notifications/mutations';

export type PrivacyPreferences = {
  showActive: boolean;
  showLastSeen: boolean;
  /** Appear in people search (an exact username or email still finds you). */
  discoverable: boolean;
  friendRequests: 'everyone' | 'nobody';
  /** Notify when a new device signs in. */
  signInAlerts: boolean;
};

export const PRIVACY_DEFAULTS: PrivacyPreferences = {
  showActive: true,
  showLastSeen: true,
  discoverable: true,
  friendRequests: 'everyone',
  signInAlerts: true,
};

async function settingsRow(ctx: { db: QueryCtx['db'] }, userId: Id<'users'>) {
  return ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

export function resolvePrivacy(row: Doc<'userSettings'> | null): PrivacyPreferences {
  return {
    showActive: row?.showActive ?? PRIVACY_DEFAULTS.showActive,
    showLastSeen: row?.showLastSeen ?? PRIVACY_DEFAULTS.showLastSeen,
    discoverable: row?.discoverable ?? PRIVACY_DEFAULTS.discoverable,
    friendRequests: row?.friendRequests ?? PRIVACY_DEFAULTS.friendRequests,
    signInAlerts: row?.signInAlerts ?? PRIVACY_DEFAULTS.signInAlerts,
  };
}

/** Someone's privacy preferences (for enforcing them in search and friend requests). */
export async function privacyFor(ctx: { db: QueryCtx['db'] }, userId: Id<'users'>) {
  return resolvePrivacy(await settingsRow(ctx, userId));
}

export const privacy = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const row = await settingsRow(ctx, user._id);
    return {
      ...resolvePrivacy(row),
      ...(row?.deletionRequestedAt !== undefined
        ? { deletionRequestedAt: row.deletionRequestedAt }
        : {}),
    };
  },
});

/**
 * Asks for the account and its data to be deleted. The request is recorded for the team to
 * process (and can be cancelled until then); the user is sent a confirmation notification.
 */
export const requestDeletion = mutation({
  args: { cancel: v.optional(v.boolean()) },
  handler: async (ctx, { cancel }) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const row = await settingsRow(ctx, user._id);
    if (!row && cancel) return null;
    const now = Date.now();
    const settingsId =
      row?._id ??
      (await ctx.db.insert('userSettings', {
        userId: user._id,
        currency: user.defaultCurrency ?? 'INR',
        timezone: user.timezone ?? 'Asia/Kolkata',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: {},
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        updatedAt: now,
      }));
    await ctx.db.patch(settingsId, {
      deletionRequestedAt: cancel ? undefined : now,
      updatedAt: now,
    });
    await createNotification(
      ctx,
      user._id,
      `security:deletion:${cancel ? 'cancel' : 'request'}:${now}`,
      'security',
      'account',
      String(user._id),
      cancel ? 'Account deletion cancelled' : 'Account deletion requested',
      cancel
        ? 'Your account will stay as it is.'
        : 'We’ll permanently delete your account and data. You can cancel in Settings → Privacy until then.',
    );
    return cancel ? null : now;
  },
});

export const updatePrivacy = mutation({
  args: {
    showActive: v.optional(v.boolean()),
    showLastSeen: v.optional(v.boolean()),
    discoverable: v.optional(v.boolean()),
    friendRequests: v.optional(v.union(v.literal('everyone'), v.literal('nobody'))),
    signInAlerts: v.optional(v.boolean()),
  },
  handler: async (ctx, patch) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw new Error('AUTH_REQUIRED');
    const row = await settingsRow(ctx, user._id);
    const next = { ...resolvePrivacy(row) };
    for (const [key, value] of Object.entries(patch))
      if (value !== undefined) (next as Record<string, unknown>)[key] = value;
    const now = Date.now();
    if (row) await ctx.db.patch(row._id, { ...next, updatedAt: now });
    else
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
        ...next,
        updatedAt: now,
      });
    return next;
  },
});

// ---------- Devices ----------

const LABEL_MAX = 80;
const TOUCH_EVERY_MS = 5 * 60_000;

/** Labels this session ("Chrome on Windows", "Pixel 8") and keeps its last-active time fresh. */
export const touchSession = mutation({
  args: {
    platform: v.union(v.literal('web'), v.literal('ios'), v.literal('android')),
    label: v.string(),
  },
  handler: async (ctx, { platform, label }) => {
    const user = await requireUser(ctx);
    const sessionId = await getAuthSessionId(ctx);
    if (!user || !sessionId) return null;
    const now = Date.now();
    const clean = label.replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX) || 'Unknown device';
    const existing = await ctx.db
      .query('sessionDevices')
      .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
      .unique();
    if (existing) {
      if (now - existing.lastSeenAt >= TOUCH_EVERY_MS || existing.label !== clean)
        await ctx.db.patch(existing._id, { lastSeenAt: now, label: clean, platform });
      return null;
    }
    const otherActiveSession = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .filter((q) =>
        q.and(
          q.neq(q.field('_id'), sessionId),
          q.gt(q.field('expirationTime'), now),
        ),
      )
      .first();
    await ctx.db.insert('sessionDevices', {
      sessionId,
      userId: user._id,
      platform,
      label: clean,
      createdAt: now,
      lastSeenAt: now,
    });
    // A prior device record distinguishes a returning account from its first-ever sign-in,
    // even when its session is no longer live. An active session also signals prior use when
    // its client has not yet created a device record.
    const priorDevice = await ctx.db
      .query('sessionDevices')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .filter((q) => q.neq(q.field('sessionId'), sessionId))
      .first();
    if ((priorDevice || otherActiveSession) && (await privacyFor(ctx, user._id)).signInAlerts)
      await createNotification(
        ctx,
        user._id,
        `security:sign-in:${sessionId}`,
        'security',
        'session',
        String(sessionId),
        'New sign-in to your account',
        `${clean} signed in. If this wasn't you, sign it out in Settings → Security and change your password.`,
      );
    return null;
  },
});

/** Devices signed in to your account, newest activity first; `current` is this one. */
export const sessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const current = await getAuthSessionId(ctx);
    const now = Date.now();
    const rows = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .collect();
    const result = await Promise.all(
      rows
        .filter((session) => session.expirationTime > now)
        .map(async (session) => {
          const device = await ctx.db
            .query('sessionDevices')
            .withIndex('by_session', (q) => q.eq('sessionId', session._id))
            .unique();
          return {
            id: session._id,
            current: session._id === current,
            label: device?.label ?? 'Unknown device',
            platform: device?.platform ?? ('web' as const),
            signedInAt: device?.createdAt ?? session._creationTime,
            lastSeenAt: device?.lastSeenAt ?? session._creationTime,
          };
        }),
    );
    return result.sort(
      (a, b) => Number(b.current) - Number(a.current) || b.lastSeenAt - a.lastSeenAt,
    );
  },
});

async function endSession(ctx: MutationCtx, sessionId: Id<'authSessions'>) {
  const tokens = await ctx.db
    .query('authRefreshTokens')
    .withIndex('sessionId', (q) => q.eq('sessionId', sessionId))
    .collect();
  for (const token of tokens) await ctx.db.delete(token._id);
  const device = await ctx.db
    .query('sessionDevices')
    .withIndex('by_session', (q) => q.eq('sessionId', sessionId))
    .unique();
  if (device) await ctx.db.delete(device._id);
  await ctx.db.delete(sessionId);
}

/** Signs one of your other devices out (it must sign in again). */
export const signOutSession = mutation({
  args: { sessionId: v.id('authSessions') },
  handler: async (ctx, { sessionId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== user._id) throw new Error('SESSION_NOT_FOUND');
    if (sessionId === (await getAuthSessionId(ctx))) throw new Error('CURRENT_SESSION');
    await endSession(ctx, sessionId);
    return null;
  },
});

/** Signs out every device except this one. Returns how many were signed out. */
export const signOutOtherSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const current = await getAuthSessionId(ctx);
    const rows = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', user._id))
      .collect();
    let count = 0;
    for (const session of rows) {
      if (session._id === current) continue;
      await endSession(ctx, session._id);
      count++;
    }
    return count;
  },
});
