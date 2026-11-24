import { mutation, type MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import { advanceReadPointer, type ChatScope } from '../shared/chat';

const ACTIVE_WINDOW_MS = 90_000;
// Clients refresh at most every 2.5s while typing; indicators lapse 5s after the last refresh.
export const TYPING_WINDOW_MS = 5_000;

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const now = Date.now();
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    const update = { activeUntil: now + ACTIVE_WINDOW_MS, lastSeenAt: now, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, update);
    else await ctx.db.insert('presence', { userId: user._id, ...update });
    return null;
  },
});
export const setPrivacy = mutation({
  args: { showActive: v.boolean(), showLastSeen: v.boolean() },
  handler: async (ctx, { showActive, showLastSeen }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    const now = Date.now();
    if (settings) await ctx.db.patch(settings._id, { showActive, showLastSeen, updatedAt: now });
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
        showActive,
        showLastSeen,
        updatedAt: now,
      });
    return { showActive, showLastSeen };
  },
});

export const setTyping = mutation({
  args: {
    scopeType: v.union(v.literal('group'), v.literal('direct')),
    scopeId: v.union(v.id('groups'), v.id('directConversations')),
    typing: v.boolean(),
  },
  handler: async (ctx, { scopeType, scopeId, typing }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    await requireScopeAccess(ctx, scopeType, String(scopeId), user._id);
    const indicator = await ctx.db
      .query('typingIndicators')
      .withIndex('by_scope_user', (q) =>
        q.eq('scopeType', scopeType).eq('scopeId', scopeId).eq('userId', user._id),
      )
      .unique();
    const now = Date.now();
    if (!typing) {
      if (indicator) await ctx.db.delete(indicator._id);
      return null;
    }
    const values = { typingUntil: now + TYPING_WINDOW_MS, updatedAt: now };
    if (indicator) await ctx.db.patch(indicator._id, values);
    else
      await ctx.db.insert('typingIndicators', { scopeType, scopeId, userId: user._id, ...values });
    return null;
  },
});

async function requireScopeAccess(
  ctx: MutationCtx,
  scopeType: 'group' | 'direct',
  rawScopeId: string,
  userId: Id<'users'>,
): Promise<ChatScope> {
  if (scopeType === 'group') {
    const groupId = ctx.db.normalizeId('groups', rawScopeId);
    const group = groupId ? await ctx.db.get(groupId) : null;
    if (!groupId || !group || group.archivedAt !== undefined) throw new Error('SCOPE_UNAVAILABLE');
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', userId))
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    return { type: 'group', id: groupId };
  }
  const conversationId = ctx.db.normalizeId('directConversations', rawScopeId);
  const conversation = conversationId ? await ctx.db.get(conversationId) : null;
  if (
    !conversationId ||
    !conversation ||
    (conversation.userLowId !== userId && conversation.userHighId !== userId)
  )
    throw new Error('CONVERSATION_UNAVAILABLE');
  return { type: 'direct', id: conversationId };
}

/**
 * Marks everything in a thread created at or before readAt as read by moving the caller's
 * pointer forward. One write per thread, however many messages that covers.
 */
export const markRead = mutation({
  args: {
    scopeType: v.union(v.literal('group'), v.literal('direct')),
    scopeId: v.string(),
    readAt: v.number(),
  },
  handler: async (ctx, { scopeType, scopeId, readAt }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (!Number.isFinite(readAt)) throw new Error('INVALID_READ_AT');
    const scope = await requireScopeAccess(ctx, scopeType, scopeId, user._id);
    return { lastReadAt: await advanceReadPointer(ctx, scope, user._id, readAt) };
  },
});

/** Compatibility wrapper: marks a DM and everything before it as read. */
export const markDirectSeen = mutation({
  args: { messageId: v.id('directMessages') },
  handler: async (ctx, { messageId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error('MESSAGE_UNAVAILABLE');
    const scope = await requireScopeAccess(ctx, 'direct', message.conversationId, user._id);
    if (message.senderId !== user._id)
      await advanceReadPointer(ctx, scope, user._id, message.createdAt);
    return null;
  },
});

/** Compatibility wrapper: marks a group message and everything before it as read. */
export const markGroupSeen = mutation({
  args: { messageId: v.id('groupMessages') },
  handler: async (ctx, { messageId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error('MESSAGE_UNAVAILABLE');
    const scope = await requireScopeAccess(ctx, 'group', message.groupId, user._id);
    if (message.senderId !== user._id)
      await advanceReadPointer(ctx, scope, user._id, message.createdAt);
    return null;
  },
});
