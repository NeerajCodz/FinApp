import { query } from '../_generated/server';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { getOptionalUser } from '../shared/auth';

export const scopeState = query({
  args: {
    scopeType: v.union(v.literal('group'), v.literal('direct')),
    // Accept raw route params; malformed ids resolve to an empty state instead of throwing.
    scopeId: v.string(),
  },
  handler: async (ctx, { scopeType, scopeId: rawScopeId }) => {
    const empty = {
      participants: [],
      typingUserIds: [],
      typing: [] as { userId: Id<'users'>; updatedAt: number; typingUntil: number }[],
    };
    const actor = await getOptionalUser(ctx);
    if (!actor) return empty;
    let memberIds: Id<'users'>[];
    let scopeId: Id<'groups'> | Id<'directConversations'>;
    if (scopeType === 'group') {
      const groupId = ctx.db.normalizeId('groups', rawScopeId);
      if (!groupId) return empty;
      const group = await ctx.db.get(groupId);
      if (!group || group.archivedAt !== undefined) return empty;
      const memberships = await ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect();
      if (!memberships.some((item) => item.userId === actor._id)) return empty;
      memberIds = memberships.map((item) => item.userId);
      scopeId = groupId;
    } else {
      const conversationId = ctx.db.normalizeId('directConversations', rawScopeId);
      if (!conversationId) return empty;
      const conversation = await ctx.db.get(conversationId);
      if (
        !conversation ||
        (conversation.userLowId !== actor._id && conversation.userHighId !== actor._id)
      )
        return empty;
      memberIds = [conversation.userLowId, conversation.userHighId];
      scopeId = conversationId;
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
    const typing = (
      await Promise.all(
        indicators
          .filter(
            (item) =>
              item.userId !== actor._id &&
              item.typingUntil > now &&
              memberIds.includes(item.userId),
          )
          .map(async (item) => {
            const settings = await ctx.db
              .query('userSettings')
              .withIndex('by_user', (q) => q.eq('userId', item.userId))
              .unique();
            return (settings?.showActive ?? true)
              ? { userId: item.userId, updatedAt: item.updatedAt, typingUntil: item.typingUntil }
              : null;
          }),
      )
    ).filter((item) => item !== null);
    // Query results are cached until data changes, so clients also expire `typing` entries
    // locally (see the window in typingUntil - updatedAt).
    return {
      participants: participants.filter((item) => item !== null),
      typingUserIds: typing.map((item) => item.userId),
      typing,
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
