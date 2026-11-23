import { internal } from '../_generated/api';
import { internalAction, internalMutation, internalQuery, mutation } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { isSafeNotificationUrl } from './domain';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo accepts at most 100 messages per request. */
export const EXPO_PUSH_BATCH = 100;
/** Devices kept per user; the least recently seen ones are dropped beyond this. */
export const MAX_PUSH_DEVICES = 10;
export const ANDROID_PUSH_CHANNEL = 'default';

const expoTokenPattern = /^Expo(?:nent)?PushToken\[[A-Za-z0-9_-]{8,200}\]$/;

export function isExpoPushToken(token: string): boolean {
  return expoTokenPattern.test(token);
}

/**
 * Registers (or refreshes) this device's Expo push token for the signed-in user. A token that
 * belonged to another account on the same device moves to the caller, and a device that got a
 * new token replaces its old one.
 */
export const registerDevice = mutation({
  args: {
    token: v.string(),
    platform: v.union(v.literal('ios'), v.literal('android')),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const token = args.token.trim();
    if (!isExpoPushToken(token)) throw new Error('INVALID_PUSH_TOKEN');
    const deviceId = args.deviceId.trim();
    if (!deviceId || deviceId.length > 128) throw new Error('INVALID_DEVICE_ID');
    const now = Date.now();
    for (const row of await ctx.db
      .query('pushDevices')
      .withIndex('by_token', (query) => query.eq('token', token))
      .collect())
      if (row.userId !== user._id) await ctx.db.delete(row._id);
    const devices = await ctx.db
      .query('pushDevices')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect();
    const current =
      devices.find((device) => device.token === token) ??
      devices.find((device) => device.deviceId === deviceId);
    let id: Id<'pushDevices'>;
    if (current) {
      id = current._id;
      await ctx.db.patch(current._id, {
        token,
        deviceId,
        platform: args.platform,
        lastSeenAt: now,
        disabledAt: undefined,
      });
    } else
      id = await ctx.db.insert('pushDevices', {
        userId: user._id,
        token,
        deviceId,
        platform: args.platform,
        lastSeenAt: now,
      });
    // Drop duplicates of this device and keep the most recently seen devices under the cap.
    const others: typeof devices = [];
    for (const device of devices) {
      if (device._id === id) continue;
      if (device.token === token || device.deviceId === deviceId) await ctx.db.delete(device._id);
      else others.push(device);
    }
    others.sort((left, right) => right.lastSeenAt - left.lastSeenAt);
    for (const device of others.slice(MAX_PUSH_DEVICES - 1)) await ctx.db.delete(device._id);
    return id;
  },
});

/** Stops pushes to this device for the caller, e.g. right before signing out. */
export const unregisterDevice = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    let removed = 0;
    for (const row of await ctx.db
      .query('pushDevices')
      .withIndex('by_token', (query) => query.eq('token', args.token.trim()))
      .collect())
      if (row.userId === user._id) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    return removed;
  },
});

export const activeTokens = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query('pushDevices')
        .withIndex('by_user', (query) => query.eq('userId', args.userId))
        .collect()
    )
      .filter((device) => device.disabledAt === undefined)
      .map((device) => device.token),
});

export const removeTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, args) => {
    for (const token of new Set(args.tokens))
      for (const row of await ctx.db
        .query('pushDevices')
        .withIndex('by_token', (query) => query.eq('token', token))
        .collect())
        await ctx.db.delete(row._id);
  },
});

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: { url: string; notificationId: string };
  sound: 'default';
  priority: 'high';
  channelId: string;
};

export function buildPushMessages(
  tokens: readonly string[],
  notification: { notificationId: string; title: string; body: string; url: string },
): ExpoPushMessage[] {
  const url = isSafeNotificationUrl(notification.url) ? notification.url : '/notifications';
  return [...new Set(tokens)].map((to) => ({
    to,
    title: notification.title,
    body: notification.body,
    data: { url, notificationId: notification.notificationId },
    sound: 'default',
    priority: 'high',
    channelId: ANDROID_PUSH_CHANNEL,
  }));
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    chunks.push(items.slice(index, index + size));
  return chunks;
}

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

/** Tokens Expo reported as no longer registered; tickets come back in message order. */
export function unregisteredTokens(
  messages: readonly ExpoPushMessage[],
  tickets: readonly ExpoTicket[],
): string[] {
  return tickets.flatMap((ticket, index) =>
    ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
      ? [messages[index]!.to]
      : [],
  );
}

/** Sends one stored notification to every registered device of its recipient. */
export const deliver = internalAction({
  args: {
    recipientId: v.id('users'),
    notificationId: v.id('notifications'),
    title: v.string(),
    body: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const tokens: string[] = await ctx.runQuery(internal.notifications.push.activeTokens, {
      userId: args.recipientId,
    });
    if (!tokens.length) return { sent: 0, removed: 0 };
    const messages = buildPushMessages(tokens, args);
    const headers: Record<string, string> = {
      accept: 'application/json',
      'accept-encoding': 'gzip, deflate',
      'content-type': 'application/json',
    };
    const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    const stale: string[] = [];
    let sent = 0;
    for (const batch of chunk(messages, EXPO_PUSH_BATCH)) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        });
        if (!response.ok) {
          console.warn('[push] Expo push request failed', response.status);
          continue;
        }
        const payload = (await response.json()) as { data?: ExpoTicket[] };
        const tickets = Array.isArray(payload.data) ? payload.data : [];
        sent += tickets.filter((ticket) => ticket?.status === 'ok').length;
        stale.push(...unregisteredTokens(batch, tickets));
      } catch (error) {
        console.warn('[push] Expo push request errored', error);
      }
    }
    if (stale.length)
      await ctx.runMutation(internal.notifications.push.removeTokens, { tokens: stale });
    return { sent, removed: stale.length };
  },
});
