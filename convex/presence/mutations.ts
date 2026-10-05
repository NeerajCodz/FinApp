import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';

const ACTIVE_WINDOW_MS = 90_000;
const TYPING_WINDOW_MS = 8_000;

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
    if (scopeType === 'group') {
      const groupId = ctx.db.normalizeId('groups', String(scopeId));
      const group = groupId ? await ctx.db.get(groupId) : null;
      if (!groupId || !group || group.archivedAt !== undefined)
        throw new Error('SCOPE_UNAVAILABLE');
      const membership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (q) => q.eq('groupId', groupId).eq('userId', user._id))
        .unique();
      if (!membership) throw new Error('NOT_MEMBER');
    } else {
      const conversationId = ctx.db.normalizeId('directConversations', String(scopeId));
      const conversation = conversationId ? await ctx.db.get(conversationId) : null;
      if (
        !conversation ||
        (conversation.userLowId !== user._id && conversation.userHighId !== user._id)
      )
        throw new Error('CONVERSATION_UNAVAILABLE');
    }
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

export const markDirectSeen = mutation({
  args: { messageId: v.id('directMessages') },
  handler: async (ctx, { messageId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error('MESSAGE_UNAVAILABLE');
    const conversation = await ctx.db.get(message.conversationId);
    if (
      !conversation ||
      (conversation.userLowId !== user._id && conversation.userHighId !== user._id)
    )
      throw new Error('CONVERSATION_UNAVAILABLE');
    const existing = await ctx.db
      .query('directMessageReads')
      .withIndex('by_message_user', (q) => q.eq('messageId', messageId).eq('userId', user._id))
      .unique();
    if (!existing && message.senderId !== user._id)
      await ctx.db.insert('directMessageReads', {
        messageId,
        conversationId: message.conversationId,
        userId: user._id,
        seenAt: Date.now(),
      });
    return null;
  },
});

export const markGroupSeen = mutation({
  args: { messageId: v.id('groupMessages') },
  handler: async (ctx, { messageId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error('MESSAGE_UNAVAILABLE');
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (q) => q.eq('groupId', message.groupId).eq('userId', user._id))
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const existing = await ctx.db
      .query('groupMessageReads')
      .withIndex('by_message_user', (q) => q.eq('messageId', messageId).eq('userId', user._id))
      .unique();
    if (!existing && message.senderId !== user._id)
      await ctx.db.insert('groupMessageReads', {
        messageId,
        groupId: message.groupId,
        userId: user._id,
        seenAt: Date.now(),
      });
    return null;
  },
});
