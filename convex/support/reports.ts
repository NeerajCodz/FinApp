/**
 * Reports: users report a user, a group, a message or a bug (reason + encrypted description).
 * Moderators work a queue and act on it (dismiss, warn, suspend, ban); every action lands in
 * the admin audit log. A reported message is referenced by id only: its text is never copied
 * into the report or shown in the console.
 */
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { mutation, query, type MutationCtx, type QueryCtx } from '../_generated/server';
import { requireUser, getOptionalUser } from '../shared/auth';
import { cryptoContext, decryptOrPlaceholder, encryptText } from '../admin/crypto';
import { adminError, logAdminAction, requireAdminPermission, userCard } from '../admin/guard';
import { applyRestriction, sendWarning } from '../admin/users';
import { trackUsage } from '../admin/usage';
import { DAY_MS } from '../admin/usageMetrics';
import { cleanText, isReportReason, REPORT_REASONS, SUPPORT_LIMITS } from './domain';

const targetType = v.union(
  v.literal('user'),
  v.literal('group'),
  v.literal('message'),
  v.literal('bug'),
);

function reportError(code: string) {
  return new ConvexError({ code });
}

/** Finds who sent a group or direct message the reporter can see (no text is read out). */
async function messageSender(
  ctx: MutationCtx,
  reporterId: Id<'users'>,
  messageId: string,
): Promise<{ senderId: Id<'users'>; groupId?: Id<'groups'> } | null> {
  const groupMessageId = ctx.db.normalizeId('groupMessages', messageId);
  if (groupMessageId) {
    const message = await ctx.db.get(groupMessageId);
    if (!message) return null;
    const member = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', message.groupId).eq('userId', reporterId))
      .unique();
    return member ? { senderId: message.senderId, groupId: message.groupId } : null;
  }
  const directId = ctx.db.normalizeId('directMessages', messageId);
  if (directId) {
    const message = await ctx.db.get(directId);
    if (!message) return null;
    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation) return null;
    const memberOf =
      conversation.userLowId === reporterId || conversation.userHighId === reporterId;
    return memberOf ? { senderId: message.senderId } : null;
  }
  return null;
}

export const reasons = query({
  args: {},
  handler: async () => Object.entries(REPORT_REASONS).map(([value, label]) => ({ value, label })),
});

export const create = mutation({
  args: {
    targetType,
    targetUsername: v.optional(v.string()),
    targetUserId: v.optional(v.id('users')),
    targetGroupId: v.optional(v.id('groups')),
    targetMessageId: v.optional(v.string()),
    reason: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user || user.deletedAt !== undefined) throw reportError('AUTH_REQUIRED');
    if (!isReportReason(args.reason)) throw reportError('REPORT_REASON_INVALID');
    const description = cleanText(args.description, SUPPORT_LIMITS.reportMax);
    if (!description) throw reportError('REPORT_TEXT_INVALID');
    const recent = await ctx.db
      .query('reports')
      .withIndex('by_reporter_createdAt', (q) =>
        q.eq('reporterId', user._id).gte('createdAt', Date.now() - DAY_MS),
      )
      .collect();
    if (recent.length >= SUPPORT_LIMITS.reportsPerDay) throw reportError('REPORT_RATE_LIMITED');

    let targetUserId: Id<'users'> | undefined;
    let targetGroupId: Id<'groups'> | undefined;
    let targetMessageId: string | undefined;
    if (args.targetType === 'user') {
      if (args.targetUserId) targetUserId = args.targetUserId;
      else if (args.targetUsername) {
        const username = args.targetUsername.replace(/^@+/, '').trim().toLowerCase();
        const target = await ctx.db
          .query('users')
          .withIndex('by_username', (q) => q.eq('username', username))
          .unique();
        targetUserId = target?._id;
      }
      if (!targetUserId || !(await ctx.db.get(targetUserId)))
        throw reportError('REPORT_TARGET_NOT_FOUND');
      if (targetUserId === user._id) throw reportError('REPORT_SELF');
    } else if (args.targetType === 'group') {
      if (!args.targetGroupId) throw reportError('REPORT_TARGET_NOT_FOUND');
      const group = await ctx.db.get(args.targetGroupId);
      if (!group) throw reportError('REPORT_TARGET_NOT_FOUND');
      targetGroupId = group._id;
    } else if (args.targetType === 'message') {
      if (!args.targetMessageId) throw reportError('REPORT_TARGET_NOT_FOUND');
      const found = await messageSender(ctx, user._id, args.targetMessageId);
      if (!found) throw reportError('REPORT_TARGET_NOT_FOUND');
      targetMessageId = args.targetMessageId;
      targetUserId = found.senderId;
      targetGroupId = found.groupId;
    }
    const id = await ctx.db.insert('reports', {
      reporterId: user._id,
      targetType: args.targetType,
      ...(targetUserId ? { targetUserId } : {}),
      ...(targetGroupId ? { targetGroupId } : {}),
      ...(targetMessageId ? { targetMessageId } : {}),
      reason: args.reason,
      description: await encryptText(description, cryptoContext.report(String(user._id))),
      status: 'open',
      createdAt: Date.now(),
    });
    await trackUsage(ctx, user._id, 'report.create');
    return id;
  },
});

/** Reports you filed (status only; staff notes aren't shown). */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query('reports')
      .withIndex('by_reporter_createdAt', (q) => q.eq('reporterId', user._id))
      .order('desc')
      .take(50);
    return rows.map((row) => ({
      id: row._id,
      targetType: row.targetType,
      reason: row.reason,
      reasonLabel: REPORT_REASONS[row.reason as keyof typeof REPORT_REASONS] ?? row.reason,
      status: row.status,
      createdAt: row.createdAt,
    }));
  },
});

// ---------- Moderation queue ----------

async function reportView(ctx: QueryCtx, report: Doc<'reports'>) {
  const group = report.targetGroupId ? await ctx.db.get(report.targetGroupId) : null;
  return {
    id: report._id,
    targetType: report.targetType,
    reason: report.reason,
    reasonLabel: REPORT_REASONS[report.reason as keyof typeof REPORT_REASONS] ?? report.reason,
    description: await decryptOrPlaceholder(
      report.description,
      cryptoContext.report(String(report.reporterId)),
    ),
    status: report.status,
    resolution: report.resolution ?? null,
    createdAt: report.createdAt,
    handledAt: report.handledAt ?? null,
    reporter: await userCard(ctx, report.reporterId),
    targetUser: report.targetUserId ? await userCard(ctx, report.targetUserId) : null,
    targetGroup: group ? { id: group._id, name: group.name } : null,
    targetMessageId: report.targetMessageId ?? null,
    handledBy: report.handledBy ? await userCard(ctx, report.handledBy) : null,
  };
}

export const queue = query({
  args: {
    status: v.optional(v.union(v.literal('open'), v.literal('dismissed'), v.literal('actioned'))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { status, paginationOpts }) => {
    await requireAdminPermission(ctx, 'MANAGE_REPORTS');
    const page = await ctx.db
      .query('reports')
      .withIndex('by_status_createdAt', (q) => q.eq('status', status ?? 'open'))
      .order('desc')
      .paginate(paginationOpts);
    return { ...page, page: await Promise.all(page.page.map((row) => reportView(ctx, row))) };
  },
});

/**
 * Resolves a report. `dismiss` closes it; `warn`, `suspend` and `ban` act on the reported user
 * (or a reported message's sender) and need the matching permission.
 */
export const resolve = mutation({
  args: {
    reportId: v.id('reports'),
    action: v.union(
      v.literal('dismiss'),
      v.literal('warn'),
      v.literal('suspend'),
      v.literal('ban'),
      v.literal('resolve'),
    ),
    message: v.optional(v.string()),
    durationHours: v.optional(v.number()),
  },
  handler: async (ctx, { reportId, action, message, durationHours }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_REPORTS');
    const report = await ctx.db.get(reportId);
    if (!report) throw adminError('ADMIN_NOT_FOUND');
    if (report.status !== 'open') throw adminError('REPORT_ALREADY_HANDLED');
    const note = message?.trim() ?? '';
    if (action === 'warn' || action === 'suspend' || action === 'ban') {
      if (!report.targetUserId) throw adminError('REPORT_NO_USER');
      if (action === 'warn') {
        await sendWarning(
          ctx,
          admin,
          report.targetUserId,
          note || 'Please follow the community guidelines.',
        );
      } else {
        if (!admin.permissions.has('BAN_USERS'))
          throw adminError('ADMIN_FORBIDDEN', { permission: 'BAN_USERS' });
        await applyRestriction(
          ctx,
          admin,
          report.targetUserId,
          action === 'ban' ? 'ban' : 'suspension',
          note || `Report: ${report.reason}`,
          action === 'suspend' ? (durationHours ?? 72) : undefined,
        );
      }
    }
    await ctx.db.patch(reportId, {
      status: action === 'dismiss' ? 'dismissed' : 'actioned',
      resolution: action,
      handledBy: admin.user._id,
      handledAt: Date.now(),
    });
    await logAdminAction(
      ctx,
      admin.user._id,
      `report.${action}`,
      'report',
      String(reportId),
      report.reason,
    );
    return null;
  },
});
