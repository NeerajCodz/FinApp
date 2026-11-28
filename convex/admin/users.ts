/**
 * Admin: users. Usage-only views (no finance data, no email or phone), bans and suspensions,
 * forced sign-out and encrypted staff notes. Every mutation is permission-checked and audited.
 */
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from '../_generated/server';
import { createNotification } from '../notifications/mutations';
import { cryptoContext, decryptOrPlaceholder, encryptText } from './crypto';
import {
  adminError,
  hasSecondFactor,
  logAdminAction,
  memberFor,
  recordSecurityEvent,
  requireAdminPermission,
  requireAnyAdminPermission,
  rolesOf,
  userCard,
  type AdminContext,
} from './guard';
import { highestPosition, isOwner } from './permissions';
import { activeRestriction, isRestrictionActive } from './restrictions';
import { dayStart, DAY_MS, FEATURE_METRICS, isFeatureMetric } from './usageMetrics';

const REASON_MAX = 1000;
const NOTE_MAX = 4000;

export type AccountState = 'active' | 'suspended' | 'banned' | 'deleted';

async function accountState(ctx: QueryCtx, user: Doc<'users'>): Promise<AccountState> {
  if (user.deletedAt !== undefined) return 'deleted';
  const restriction = await activeRestriction(ctx, user._id);
  if (!restriction) return 'active';
  return restriction.kind === 'ban' ? 'banned' : 'suspended';
}

async function userRow(ctx: QueryCtx, user: Doc<'users'>) {
  const activity = await ctx.db
    .query('userActivity')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  const member = await memberFor(ctx, user._id);
  return {
    ...(await userCard(ctx, user._id))!,
    createdAt: user.createdAt ?? user._creationTime,
    lastActiveAt: activity?.lastActiveAt ?? null,
    platform: activity?.lastPlatform ?? null,
    state: await accountState(ctx, user),
    staff: Boolean(member),
  };
}

/** Users, newest first, or a username prefix search. */
export const list = query({
  args: {
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { search, paginationOpts }) => {
    await requireAdminPermission(ctx, 'VIEW_USERS');
    const term = search?.trim().replace(/^@+/, '').toLowerCase() ?? '';
    const page = term
      ? await ctx.db
          .query('users')
          .withIndex('by_username', (q) => q.gte('username', term).lt('username', `${term}￿`))
          .paginate(paginationOpts)
      : await ctx.db.query('users').order('desc').paginate(paginationOpts);
    return {
      ...page,
      page: await Promise.all(page.page.map((user) => userRow(ctx, user))),
    };
  },
});

/** Per-feature usage counts for a user over the last `days` days (counts only). */
async function usageCounts(ctx: QueryCtx, userId: Id<'users'>, days: number) {
  const since = dayStart(Date.now()) - (days - 1) * DAY_MS;
  const rows = await ctx.db
    .query('userUsageDaily')
    .withIndex('by_user_day', (q) => q.eq('userId', userId).gte('day', since))
    .collect();
  const totals = new Map<string, number>();
  const activeDays = new Set<number>();
  for (const row of rows) {
    if (!isFeatureMetric(row.metric)) continue;
    if (row.metric === 'app.active') {
      activeDays.add(row.day);
      continue;
    }
    totals.set(row.metric, (totals.get(row.metric) ?? 0) + row.count);
  }
  return {
    activeDays: activeDays.size,
    features: [...totals.entries()]
      .map(([metric, count]) => ({
        metric,
        label: FEATURE_METRICS[metric as keyof typeof FEATURE_METRICS].label,
        count,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

async function sessionsFor(ctx: QueryCtx, userId: Id<'users'>) {
  const now = Date.now();
  const sessions = await ctx.db
    .query('authSessions')
    .withIndex('userId', (q) => q.eq('userId', userId))
    .collect();
  return Promise.all(
    sessions
      .filter((session) => session.expirationTime > now)
      .map(async (session) => {
        const device = await ctx.db
          .query('sessionDevices')
          .withIndex('by_session', (q) => q.eq('sessionId', session._id))
          .unique();
        return {
          id: session._id,
          label: device?.label ?? 'Unknown device',
          platform: device?.platform ?? null,
          signedInAt: device?.createdAt ?? session._creationTime,
          lastSeenAt: device?.lastSeenAt ?? session._creationTime,
        };
      }),
  );
}

/** One user's usage-only profile for the console. */
export const detail = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdminPermission(ctx, 'VIEW_USERS');
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const row = await userRow(ctx, user);
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();
    const restrictions = await ctx.db
      .query('accountRestrictions')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(20);
    const now = Date.now();
    const canModerate = admin.permissions.has('BAN_USERS') || admin.permissions.has('MANAGE_USERS');
    const notes = canModerate
      ? await ctx.db
          .query('adminNotes')
          .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
          .order('desc')
          .take(50)
      : [];
    const member = await memberFor(ctx, userId);
    const roles = await rolesOf(ctx, member);
    const security = admin.permissions.has('VIEW_SECURITY')
      ? await ctx.db
          .query('securityEvents')
          .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
          .order('desc')
          .take(25)
      : [];
    const usage30 = await usageCounts(ctx, userId, 30);
    const reportsAgainst = await ctx.db
      .query('reports')
      .withIndex('by_targetUser', (q) => q.eq('targetUserId', userId))
      .collect();
    return {
      ...row,
      mfaEnabled: await hasSecondFactor(ctx, user),
      groupCount: memberships.length,
      usage: usage30,
      sessions:
        admin.permissions.has('MANAGE_USERS') || admin.permissions.has('VIEW_SECURITY')
          ? await sessionsFor(ctx, userId)
          : [],
      restrictions: canModerate
        ? await Promise.all(
            restrictions.map(async (restriction) => ({
              id: restriction._id,
              kind: restriction.kind,
              reason: await decryptOrPlaceholder(
                restriction.reason,
                cryptoContext.restriction(String(userId)),
              ),
              createdAt: restriction.createdAt,
              expiresAt: restriction.expiresAt ?? null,
              liftedAt: restriction.liftedAt ?? null,
              active: isRestrictionActive(restriction, now),
              by: await userCard(ctx, restriction.createdBy),
            })),
          )
        : [],
      notes: await Promise.all(
        notes.map(async (note) => ({
          id: note._id,
          body: await decryptOrPlaceholder(note.body, cryptoContext.note(String(userId))),
          createdAt: note.createdAt,
          author: await userCard(ctx, note.authorId),
        })),
      ),
      roles: roles.map((role) => ({
        id: role._id,
        name: role.name,
        color: role.color,
        icon: role.icon ?? null,
      })),
      security: security.map((event) => ({
        id: event._id,
        kind: event.kind,
        platform: event.platform ?? null,
        createdAt: event.createdAt,
      })),
      reportsAgainst: {
        total: reportsAgainst.length,
        open: reportsAgainst.filter((report) => report.status === 'open').length,
      },
      permissions: {
        moderate: admin.permissions.has('BAN_USERS'),
        manage: admin.permissions.has('MANAGE_USERS'),
      },
    };
  },
});

// ---------- Actions on users ----------

/** Staff can't act on themselves, on owners, or on staff ranked at or above them. */
async function assertCanActOn(ctx: MutationCtx, admin: AdminContext, userId: Id<'users'>) {
  if (userId === admin.user._id) throw adminError('ADMIN_CANNOT_TARGET_SELF');
  const roles = await rolesOf(ctx, await memberFor(ctx, userId));
  if (isOwner(roles) || (roles.length && highestPosition(roles) >= admin.highest))
    throw adminError('ADMIN_ROLE_HIERARCHY');
}

async function endAllSessions(ctx: MutationCtx, userId: Id<'users'>) {
  const sessions = await ctx.db
    .query('authSessions')
    .withIndex('userId', (q) => q.eq('userId', userId))
    .collect();
  for (const session of sessions) {
    const tokens = await ctx.db
      .query('authRefreshTokens')
      .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
      .collect();
    for (const token of tokens) await ctx.db.delete(token._id);
    const device = await ctx.db
      .query('sessionDevices')
      .withIndex('by_session', (q) => q.eq('sessionId', session._id))
      .unique();
    if (device) await ctx.db.delete(device._id);
    await ctx.db.delete(session._id);
  }
  return sessions.length;
}

async function revokeMcpGrants(ctx: MutationCtx, userId: Id<'users'>) {
  const grants = await ctx.db
    .query('mcpOAuthGrants')
    .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
    .collect();
  const now = Date.now();
  for (const grant of grants)
    if (grant.revokedAt === undefined) await ctx.db.patch(grant._id, { revokedAt: now });
}

/** Applies a ban or suspension (shared with the reports queue). */
export async function applyRestriction(
  ctx: MutationCtx,
  admin: AdminContext,
  userId: Id<'users'>,
  kind: 'ban' | 'suspension',
  reason: string,
  durationHours: number | undefined,
) {
  const clean = reason.trim();
  if (!clean || clean.length > REASON_MAX) throw adminError('ADMIN_REASON_INVALID');
  if (kind === 'suspension' && !(durationHours && durationHours > 0 && durationHours <= 24 * 365))
    throw adminError('ADMIN_DURATION_INVALID');
  await assertCanActOn(ctx, admin, userId);
  const user = await ctx.db.get(userId);
  if (!user) throw adminError('ADMIN_USER_NOT_FOUND');
  const now = Date.now();
  // A new restriction replaces whatever was active.
  const previous = await activeRestriction(ctx, userId, now);
  if (previous) await ctx.db.patch(previous._id, { liftedAt: now, liftedBy: admin.user._id });
  const id = await ctx.db.insert('accountRestrictions', {
    userId,
    kind,
    reason: await encryptText(clean, cryptoContext.restriction(String(userId))),
    ...(durationHours ? { expiresAt: now + durationHours * 60 * 60 * 1000 } : {}),
    createdBy: admin.user._id,
    createdAt: now,
  });
  const ended = await endAllSessions(ctx, userId);
  await revokeMcpGrants(ctx, userId);
  await recordSecurityEvent(ctx, {
    kind: kind === 'ban' ? 'user.banned' : 'user.suspended',
    userId,
    actorId: admin.user._id,
  });
  await logAdminAction(
    ctx,
    admin.user._id,
    kind === 'ban' ? 'user.ban' : 'user.suspend',
    'user',
    String(userId),
    `${durationHours ? `${durationHours}h` : 'permanent'}, ${ended} sessions ended`,
  );
  return id;
}

export const restrict = mutation({
  args: {
    userId: v.id('users'),
    kind: v.union(v.literal('ban'), v.literal('suspension')),
    reason: v.string(),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, { userId, kind, reason, durationHours }) => {
    const admin = await requireAdminPermission(ctx, 'BAN_USERS');
    return applyRestriction(ctx, admin, userId, kind, reason, durationHours);
  },
});

export const liftRestriction = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdminPermission(ctx, 'BAN_USERS');
    const now = Date.now();
    const rows = await ctx.db
      .query('accountRestrictions')
      .withIndex('by_user_createdAt', (q) => q.eq('userId', userId))
      .collect();
    let lifted = 0;
    for (const row of rows)
      if (isRestrictionActive(row, now)) {
        await ctx.db.patch(row._id, { liftedAt: now, liftedBy: admin.user._id });
        lifted += 1;
      }
    if (!lifted) return 0;
    await recordSecurityEvent(ctx, { kind: 'user.unbanned', userId, actorId: admin.user._id });
    await logAdminAction(ctx, admin.user._id, 'user.unban', 'user', String(userId));
    return lifted;
  },
});

/** Force sign-out: ends every session (and MCP connection) for the user. */
export const revokeSessions = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_USERS');
    await assertCanActOn(ctx, admin, userId);
    const ended = await endAllSessions(ctx, userId);
    await revokeMcpGrants(ctx, userId);
    await recordSecurityEvent(ctx, { kind: 'sessions.revoked', userId, actorId: admin.user._id });
    await logAdminAction(
      ctx,
      admin.user._id,
      'user.signout',
      'user',
      String(userId),
      `${ended} sessions`,
    );
    return ended;
  },
});

export const addNote = mutation({
  args: { userId: v.id('users'), body: v.string() },
  handler: async (ctx, { userId, body }) => {
    const admin = await requireAnyAdminPermission(ctx, ['MANAGE_USERS', 'BAN_USERS']);
    const clean = body.trim();
    if (!clean || clean.length > NOTE_MAX) throw adminError('ADMIN_NOTE_INVALID');
    if (!(await ctx.db.get(userId))) throw adminError('ADMIN_USER_NOT_FOUND');
    const id = await ctx.db.insert('adminNotes', {
      userId,
      authorId: admin.user._id,
      body: await encryptText(clean, cryptoContext.note(String(userId))),
      createdAt: Date.now(),
    });
    await logAdminAction(ctx, admin.user._id, 'user.note', 'user', String(userId));
    return id;
  },
});

export const deleteNote = mutation({
  args: { noteId: v.id('adminNotes') },
  handler: async (ctx, { noteId }) => {
    const admin = await requireAnyAdminPermission(ctx, ['MANAGE_USERS', 'BAN_USERS']);
    const note = await ctx.db.get(noteId);
    if (!note) return null;
    if (note.authorId !== admin.user._id && !admin.permissions.has('ADMINISTRATOR'))
      throw adminError('ADMIN_FORBIDDEN');
    await ctx.db.delete(noteId);
    await logAdminAction(ctx, admin.user._id, 'user.note.delete', 'user', String(note.userId));
    return null;
  },
});

/** Sends the user a warning notice (the staff-written message goes to their notifications). */
export async function sendWarning(
  ctx: MutationCtx,
  admin: AdminContext,
  userId: Id<'users'>,
  message: string,
) {
  const clean = message.trim();
  if (!clean || clean.length > REASON_MAX) throw adminError('ADMIN_REASON_INVALID');
  await assertCanActOn(ctx, admin, userId);
  const now = Date.now();
  await createNotification(
    ctx,
    userId,
    `moderation:warning:${now}`,
    'security',
    'account',
    String(userId),
    'A note from the Finapp team',
    clean,
  );
  await recordSecurityEvent(ctx, { kind: 'user.warned', userId, actorId: admin.user._id });
  await logAdminAction(ctx, admin.user._id, 'user.warn', 'user', String(userId));
}

export const warn = mutation({
  args: { userId: v.id('users'), message: v.string() },
  handler: async (ctx, { userId, message }) => {
    const admin = await requireAnyAdminPermission(ctx, ['BAN_USERS', 'MANAGE_REPORTS']);
    await sendWarning(ctx, admin, userId, message);
    return null;
  },
});
