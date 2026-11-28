/**
 * Admin: groups (metadata and activity counts only, no ledger content), the security log and
 * the admin audit log.
 */
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { query, type QueryCtx } from '../_generated/server';
import { requireAdminPermission, userCard } from './guard';
import { dayStart, DAY_MS } from './usageMetrics';

async function groupActivity(ctx: QueryCtx, group: Doc<'groups'>, since: number) {
  const rows = await ctx.db
    .query('groupActivityDaily')
    .withIndex('by_group_day', (q) => q.eq('groupId', group._id).gte('day', since))
    .collect();
  return rows.reduce((total, row) => total + row.count, 0);
}

async function groupRow(ctx: QueryCtx, group: Doc<'groups'>) {
  const members = await ctx.db
    .query('groupMembers')
    .withIndex('by_group', (q) => q.eq('groupId', group._id))
    .collect();
  const since30 = dayStart(Date.now()) - 29 * DAY_MS;
  const reports = await ctx.db
    .query('reports')
    .withIndex('by_status_createdAt', (q) => q.eq('status', 'open'))
    .collect();
  return {
    id: group._id,
    name: group.name,
    icon: group.icon ?? null,
    color: group.color ?? null,
    memberCount: members.length,
    owner: await userCard(ctx, group.ownerId),
    createdAt: group.createdAt,
    archived: group.archivedAt !== undefined,
    activity30: await groupActivity(ctx, group, since30),
    openReports: reports.filter((report) => report.targetGroupId === group._id).length,
  };
}

export const listGroups = query({
  args: { search: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { search, paginationOpts }) => {
    await requireAdminPermission(ctx, 'VIEW_GROUPS');
    const term = search?.trim().toLowerCase() ?? '';
    const page = await ctx.db
      .query('groups')
      .order('desc')
      .filter((q) => q.eq(q.field('archivedAt'), undefined))
      .paginate(paginationOpts);
    const rows = term
      ? page.page.filter((group) => group.name.toLowerCase().includes(term))
      : page.page;
    return { ...page, page: await Promise.all(rows.map((group) => groupRow(ctx, group))) };
  },
});

/** Most active groups by activity count over `days`. */
export const topGroups = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_GROUPS');
    const days = Math.min(120, Math.max(1, Math.round(args.days ?? 30)));
    const since = dayStart(Date.now()) - (days - 1) * DAY_MS;
    const rows = await ctx.db
      .query('groupActivityDaily')
      .withIndex('by_day', (q) => q.gte('day', since))
      .collect();
    const totals = new Map<string, number>();
    for (const row of rows)
      totals.set(String(row.groupId), (totals.get(String(row.groupId)) ?? 0) + row.count);
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    const result = [];
    for (const [groupId, count] of top) {
      const id = ctx.db.normalizeId('groups', groupId);
      const group = id ? await ctx.db.get(id) : null;
      if (!group) continue;
      result.push({ ...(await groupRow(ctx, group)), activity: count });
    }
    return result;
  },
});

export const groupDetail = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, { groupId }) => {
    await requireAdminPermission(ctx, 'VIEW_GROUPS');
    const group = await ctx.db.get(groupId);
    if (!group) return null;
    const since = dayStart(Date.now()) - 89 * DAY_MS;
    const rows = await ctx.db
      .query('groupActivityDaily')
      .withIndex('by_group_day', (q) => q.eq('groupId', groupId).gte('day', since))
      .collect();
    const members = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', groupId))
      .collect();
    return {
      ...(await groupRow(ctx, group)),
      activity: rows.map((row) => ({ day: row.day, count: row.count })),
      members: await Promise.all(
        members.map(async (member) => ({
          user: await userCard(ctx, member.userId),
          role: member.role,
          joinedAt: member.joinedAt,
        })),
      ),
    };
  },
});

// ---------- Security ----------

export const securityEvents = query({
  args: { kind: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { kind, paginationOpts }) => {
    await requireAdminPermission(ctx, 'VIEW_SECURITY');
    const page = kind
      ? await ctx.db
          .query('securityEvents')
          .withIndex('by_kind_createdAt', (q) => q.eq('kind', kind))
          .order('desc')
          .paginate(paginationOpts)
      : await ctx.db
          .query('securityEvents')
          .withIndex('by_createdAt')
          .order('desc')
          .paginate(paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (event) => ({
          id: event._id,
          kind: event.kind,
          user: event.userId ? await userCard(ctx, event.userId) : null,
          actor: event.actorId ? await userCard(ctx, event.actorId) : null,
          identifierHash: event.identifierHash ?? null,
          platform: event.platform ?? null,
          createdAt: event.createdAt,
        })),
      ),
    };
  },
});

/** Security summary: sign-in outcomes per day, top failing identifiers (hashed), MFA adoption. */
export const securitySummary = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminPermission(ctx, 'VIEW_SECURITY');
    const days = Math.min(90, Math.max(1, Math.round(args.days ?? 14)));
    const start = dayStart(Date.now()) - (days - 1) * DAY_MS;
    const events = await ctx.db
      .query('securityEvents')
      .withIndex('by_createdAt', (q) => q.gte('createdAt', start))
      .collect();
    const perDay = Array.from({ length: days }, (_, index) => ({
      day: start + index * DAY_MS,
      success: 0,
      failed: 0,
      blocked: 0,
    }));
    const failing = new Map<string, number>();
    const kinds: Record<string, number> = {};
    for (const event of events) {
      kinds[event.kind] = (kinds[event.kind] ?? 0) + 1;
      const bucket = perDay[Math.floor((event.createdAt - start) / DAY_MS)];
      if (!bucket) continue;
      if (event.kind === 'signin.success') bucket.success += 1;
      else if (event.kind === 'signin.failed') {
        bucket.failed += 1;
        const key = event.identifierHash ?? 'unknown';
        failing.set(key, (failing.get(key) ?? 0) + 1);
      } else if (event.kind === 'signin.blocked') bucket.blocked += 1;
    }
    const factors = await ctx.db.query('mfaFactors').collect();
    const totp = factors.filter((row) => row.totpSecret && row.totpConfirmedAt !== undefined);
    const settings = await ctx.db.query('userSettings').collect();
    const emailTwoFactor = settings.filter((row) => row.twoFactorEnabled === true);
    const totalUsers = (await ctx.db.query('users').collect()).filter(
      (user) => user.deletedAt === undefined,
    ).length;
    const mfaUsers = new Set([
      ...totp.map((row) => String(row.userId)),
      ...emailTwoFactor.map((row) => String(row.userId)),
    ]);
    return {
      perDay,
      kinds,
      topFailing: [...failing.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([identifierHash, count]) => ({ identifierHash, count })),
      mfa: {
        totalUsers,
        anyFactor: mfaUsers.size,
        authenticatorApp: totp.length,
        emailCode: emailTwoFactor.length,
        adoption: totalUsers ? mfaUsers.size / totalUsers : 0,
      },
    };
  },
});

// ---------- Audit log ----------

export const auditLog = query({
  args: {
    actorId: v.optional(v.id('users')),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { actorId, targetType, targetId, paginationOpts }) => {
    await requireAdminPermission(ctx, 'VIEW_AUDIT_LOG');
    const page = actorId
      ? await ctx.db
          .query('adminAuditLog')
          .withIndex('by_actor_createdAt', (q) => q.eq('actorId', actorId))
          .order('desc')
          .paginate(paginationOpts)
      : targetType && targetId
        ? await ctx.db
            .query('adminAuditLog')
            .withIndex('by_target', (q) => q.eq('targetType', targetType).eq('targetId', targetId))
            .order('desc')
            .paginate(paginationOpts)
        : await ctx.db
            .query('adminAuditLog')
            .withIndex('by_createdAt')
            .order('desc')
            .paginate(paginationOpts);
    return {
      ...page,
      page: await Promise.all(
        page.page.map(async (entry) => ({
          id: entry._id,
          actor: await userCard(ctx, entry.actorId),
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId ?? null,
          detail: entry.detail ?? null,
          createdAt: entry.createdAt,
        })),
      ),
    };
  },
});
