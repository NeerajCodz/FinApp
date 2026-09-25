import { mutation, type MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';
import {
  normalizeNotificationPreferences,
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
): Promise<void> {
  const existing = await ctx.db.query('notifications')
    .withIndex('by_recipient_eventKey', (query) => query.eq('recipientId', recipientId).eq('eventKey', eventKey))
    .unique();
  if (existing) return;
  const settings = await ctx.db.query('userSettings')
    .withIndex('by_user', (query) => query.eq('userId', recipientId)).unique();
  if (!normalizeNotificationPreferences(settings?.notificationPreferences)[type]) return;
  const now = Date.now();
  const record = { recipientId, eventKey, type, entityType, entityId, title, body, createdAt: now };
  const id = await ctx.db.insert('notifications', record);
  await recordSyncChange(ctx, recipientId, 'notifications', String(id), now, { ...record, _id: id });
}

export const setPreferences = mutation({
  args: {
    preferences: v.object({
      transaction: v.boolean(),
      budget: v.boolean(),
      goal: v.boolean(),
      recurring: v.boolean(),
      group: v.boolean(),
      settlement: v.boolean(),
      security: v.boolean(),
      sync: v.boolean(),
    }),
    clientMutationId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'notification.preferences');
    if (replay.found) return replay.result;
    const settings = await ctx.db.query('userSettings').withIndex('by_user', (query) => query.eq('userId', user._id)).unique();
    if (!settings) throw new Error('SETTINGS_NOT_FOUND');
    const preferences: NotificationPreferences = args.preferences;
    const now = Date.now();
    const updated = { ...settings, notificationPreferences: preferences, updatedAt: now };
    await ctx.db.patch(settings._id, { notificationPreferences: preferences, updatedAt: now });
    await publishMutationResult(ctx, user._id, args.clientMutationId, 'notification.preferences', settings._id,
      'userSettings', String(settings._id), now, updated);
    return settings._id;
  },
});

export const markRead = mutation({
  args: { notificationId: v.id('notifications'), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'notification.markRead');
    if (replay.found) return replay.result;
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    const now = notification.readAt ?? Date.now();
    if (!notification.readAt) await ctx.db.patch(notification._id, { readAt: now });
    await publishMutationResult(ctx, user._id, args.clientMutationId, 'notification.markRead', notification._id,
      'notifications', String(notification._id), now, { ...notification, readAt: now });
    return notification._id;
  },
});
