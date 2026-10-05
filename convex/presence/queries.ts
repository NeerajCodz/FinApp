import { query } from '../_generated/server';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { getOptionalUser } from '../shared/auth';

export const scopeState = query({
  args: {
    scopeType: v.union(v.literal('group'), v.literal('direct')),
    scopeId: v.union(v.id('groups'), v.id('directConversations')),
  },
  handler: async (ctx, { scopeType, scopeId }) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return { participants: [], typingUserIds: [] };
    let memberIds: Id<'users'>[];
    if (scopeType === 'group') {
      const groupId = ctx.db.normalizeId('groups', String(scopeId));
      if (!groupId) return { participants: [], typingUserIds: [] };
      const group = await ctx.db.get(groupId);
      if (!group || group.archivedAt !== undefined) return { participants: [], typingUserIds: [] };
      const memberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect();
      if (!memberships.some((item) => item.userId === actor._id))
        return { participants: [], typingUserIds: [] };
      memberIds = memberships.map((item) => item.userId);
    } else {
      const conversationId = ctx.db.normalizeId('directConversations', String(scopeId));
      if (!conversationId) return { participants: [], typingUserIds: [] };
      const conversation = await ctx.db.get(conversationId);
      if (
        !conversation ||
        (conversation.userLowId !== actor._id && conversation.userHighId !== actor._id)
      )
        return { participants: [], typingUserIds: [] };
      memberIds = [conversation.userLowId, conversation.userHighId];
    }
    const now = Date.now();
    const participants = await Promise.all(
      memberIds
        .filter((id) => id !== actor._id)
        .map(async (userId) => {
          const [user, settings, state] = await Promise.all([
            ctx.db.get(userId),
            ctx.db
              .query('userSettings')
              .withIndex('by_user', (q) => q.eq('userId', userId))
              .unique(),
            ctx.db
              .query('presence')
              .withIndex('by_user', (q) => q.eq('userId', userId))
              .unique(),
          ]);
          if (!user || user.deletedAt !== undefined) return null;
          const showActive = settings?.showActive ?? true;
          const showLastSeen = settings?.showLastSeen ?? true;
          return {
            userId,
            active: showActive ? (state?.activeUntil ?? 0) > now : null,
            lastSeenAt: showLastSeen ? (state?.lastSeenAt ?? null) : null,
          };
        }),
    );
    const indicators = await ctx.db
      .query('typingIndicators')
      .withIndex('by_scope', (q) => q.eq('scopeType', scopeType).eq('scopeId', scopeId))
      .collect();
    const typingUserIds = await Promise.all(
      indicators
        .filter(
          (item) =>
            item.userId !== actor._id && item.typingUntil > now && memberIds.includes(item.userId),
        )
        .map(async (item) => {
          const settings = await ctx.db
            .query('userSettings')
            .withIndex('by_user', (q) => q.eq('userId', item.userId))
            .unique();
          return (settings?.showActive ?? true) ? item.userId : null;
        }),
    );
    return {
      participants: participants.filter((item) => item !== null),
      typingUserIds: typingUserIds.filter((id) => id !== null),
    };
  },
});
export const privacySettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const settings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .unique();
    return {
      showActive: settings?.showActive ?? true,
      showLastSeen: settings?.showLastSeen ?? true,
    };
  },
});
