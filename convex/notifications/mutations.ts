import { internal } from '../_generated/api';
import { internalMutation, mutation, type MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import {
  publishMutationResult,
  recordSyncChange,
  replayMutationResult,
  storeMutationReceipt,
} from '../sync/common';
import { groupBalances } from '../groups/ledger';
import { formatMinor } from '../shared/money';
import { simplifyDebts } from '../splits/domain';
import {
  normalizeNotificationPreferences,
  notificationRoute,
  paymentReminderEntityId,
  type NotificationPreferences,
  type NotificationType,
} from './domain';

// Producer-only API: no client mutation can forge a security/group event.
export async function createNotification(
  ctx: MutationCtx,
  recipientId: Id<'users'>,
  eventKey: string,
  type: NotificationType,
  entityType: string | undefined,
  entityId: string | undefined,
  title: string,
  body: string,
): Promise<Id<'notifications'> | null> {
  const existing = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_eventKey', (query) =>
      query.eq('recipientId', recipientId).eq('eventKey', eventKey),
    )
    .unique();
  if (existing) return null;
  const settings = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (query) => query.eq('userId', recipientId))
    .unique();
  if (!normalizeNotificationPreferences(settings?.notificationPreferences)[type]) return null;
  const now = Date.now();
  const record = { recipientId, eventKey, type, entityType, entityId, title, body, createdAt: now };
  const id = await ctx.db.insert('notifications', record);
  await recordSyncChange(ctx, recipientId, 'notifications', String(id), now, {
    ...record,
    _id: id,
  });
  // Push only to users with a registered device; delivery happens outside the transaction.
  const device = await ctx.db
    .query('pushDevices')
    .withIndex('by_user', (query) => query.eq('userId', recipientId))
    .first();
  if (device)
    await ctx.scheduler.runAfter(0, internal.notifications.push.deliver, {
      recipientId,
      notificationId: id,
      title,
      body,
      url: notificationRoute({ type, entityType, entityId }),
    });
  return id;
}

export const setPreferences = mutation({
  args: {
    preferences: v.object({
      transaction: v.boolean(),
      budget: v.boolean(),
      goal: v.boolean(),
      recurring: v.boolean(),
      group: v.boolean(),
      // Optional so clients built before shared-expense alerts were split out keep working.
      split: v.optional(v.boolean()),
      settlement: v.boolean(),
      security: v.boolean(),
      sync: v.boolean(),
      social: v.optional(v.boolean()),
    }),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'notification.preferences',
    );
    if (replay.found) return replay.result;
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique();
    if (!settings) throw new Error('SETTINGS_NOT_FOUND');
    const stored = normalizeNotificationPreferences(settings.notificationPreferences);
    const preferences: NotificationPreferences = {
      ...args.preferences,
      split: args.preferences.split ?? stored.split,
      social: args.preferences.social ?? stored.social,
    };
    const now = Date.now();
    const updated = { ...settings, notificationPreferences: preferences, updatedAt: now };
    await ctx.db.patch(settings._id, { notificationPreferences: preferences, updatedAt: now });
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'notification.preferences',
      settings._id,
      'userSettings',
      String(settings._id),
      now,
      updated,
    );
    return settings._id;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id('notifications'), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'notification.markRead',
    );
    if (replay.found) return replay.result;
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientId !== user._id)
      throw new Error('INSUFFICIENT_PERMISSION');
    const now = notification.readAt ?? Date.now();
    if (!notification.readAt) await ctx.db.patch(notification._id, { readAt: now });
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'notification.markRead',
      notification._id,
      'notifications',
      String(notification._id),
      now,
      { ...notification, readAt: now },
    );
    return notification._id;
  },
});

/** Upper bound per call so one request stays well inside transaction limits. */
export const MARK_ALL_READ_LIMIT = 500;

/**
 * Marks every unread notification of the caller as read in one call. `before` bounds the
 * update to what the client had seen, so an event that arrives meanwhile stays unread.
 */
export const markAllRead = mutation({
  args: { before: v.optional(v.number()), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'notification.markAllRead',
    );
    if (replay.found) return replay.result as { count: number; more: boolean };
    const now = Date.now();
    const before = args.before ?? now;
    const batch = await markReadBatch(ctx, user._id, before, now, args.clientMutationId);
    // Older unread records beyond one batch are finished in the background, so clients that
    // send one mark-all call never leave them unread.
    if (batch.more)
      await ctx.scheduler.runAfter(0, internal.notifications.mutations.continueMarkAllRead, {
        userId: user._id,
        before,
        readAt: now,
      });
    const state = await ctx.db
      .query('userSyncState')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .unique();
    const result = { count: batch.count, more: batch.more };
    // A bulk operation has no single entity: the user id is its stable receipt entity, and
    // the receipt always carries a revision so client outboxes can settle it.
    await storeMutationReceipt(
      ctx,
      user._id,
      args.clientMutationId,
      'notification.markAllRead',
      result,
      String(user._id),
      batch.revision ?? state?.revision ?? 1n,
      now,
    );
    return result;
  },
});

async function markReadBatch(
  ctx: MutationCtx,
  userId: Id<'users'>,
  before: number,
  readAt: number,
  clientMutationId?: string,
): Promise<{ count: number; more: boolean; revision?: bigint }> {
  const unread = await ctx.db
    .query('notifications')
    .withIndex('by_recipient_createdAt', (query) =>
      query.eq('recipientId', userId).lte('createdAt', before),
    )
    .order('desc')
    .filter((query) => query.eq(query.field('readAt'), undefined))
    .take(MARK_ALL_READ_LIMIT + 1);
  const batch = unread.slice(0, MARK_ALL_READ_LIMIT);
  let revision: bigint | undefined;
  for (const notification of batch) {
    await ctx.db.patch(notification._id, { readAt });
    revision = await recordSyncChange(
      ctx,
      userId,
      'notifications',
      String(notification._id),
      readAt,
      { ...notification, readAt },
      undefined,
      clientMutationId,
    );
  }
  return { count: batch.length, more: unread.length > batch.length, revision };
}

/** Marks the next batch of a mark-all-read call and reschedules itself until none remain. */
export const continueMarkAllRead = internalMutation({
  args: { userId: v.id('users'), before: v.number(), readAt: v.number() },
  handler: async (ctx, args) => {
    const batch = await markReadBatch(ctx, args.userId, args.before, args.readAt);
    if (batch.more)
      await ctx.scheduler.runAfter(0, internal.notifications.mutations.continueMarkAllRead, args);
  },
});

export const NUDGE_WINDOW_MS = 86_400_000;

/**
 * Lets a creditor remind a group member who owes them. Allowed only while the group balances
 * show the caller is owed and the member owes, and at most once per pair per day bucket.
 */
export const nudge = mutation({
  args: { groupId: v.id('groups'), userId: v.id('users') },
  handler: async (
    ctx,
    args,
  ): Promise<{ status: 'sent' | 'alreadySent' | 'muted'; amountMinor: bigint }> => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (args.userId === user._id) throw new Error('INVALID_NUDGE_TARGET');
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error('GROUP_NOT_FOUND');
    const [membership, targetMembership, formerTarget] = await Promise.all([
      ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (query) =>
          query.eq('groupId', args.groupId).eq('userId', user._id),
        )
        .unique(),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (query) =>
          query.eq('groupId', args.groupId).eq('userId', args.userId),
        )
        .unique(),
      ctx.db
        .query('formerGroupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
        .filter((query) => query.eq(query.field('userId'), args.userId))
        .first(),
    ]);
    if (!membership) throw new Error('INSUFFICIENT_PERMISSION');
    if (!targetMembership && !formerTarget) throw new Error('INVALID_NUDGE_TARGET');
    const balances = await groupBalances(ctx, args.groupId, group.currency);
    const owed = balances[user._id] ?? 0n;
    const owes = -(balances[args.userId] ?? 0n);
    if (owed <= 0n || owes <= 0n) throw new Error('NOTHING_OWED');
    const planned = simplifyDebts(balances).find(
      (transfer) => transfer.fromUserId === args.userId && transfer.toUserId === user._id,
    );
    const amountMinor = planned?.amountMinor ?? (owed < owes ? owed : owes);
    const now = Date.now();
    const eventKey = `nudge:${args.groupId}:${user._id}:${Math.floor(now / NUDGE_WINDOW_MS)}`;
    const existing = await ctx.db
      .query('notifications')
      .withIndex('by_recipient_eventKey', (query) =>
        query.eq('recipientId', args.userId).eq('eventKey', eventKey),
      )
      .unique();
    if (existing) return { status: 'alreadySent', amountMinor };
    const name = user.displayName?.trim() || user.name?.trim() || 'A group member';
    const created = await createNotification(
      ctx,
      args.userId,
      eventKey,
      'settlement',
      'paymentReminder',
      paymentReminderEntityId(String(args.groupId), String(user._id)),
      `${name} sent a payment reminder`,
      `You owe ${formatMinor(amountMinor, group.currency)} in ${group.name}. Tap to settle up.`,
    );
    // Null here means the recipient muted settlement notifications (duplicates were ruled out
    // above): say so instead of claiming it was sent.
    if (!created) return { status: 'muted', amountMinor };
    return { status: 'sent', amountMinor };
  },
});
