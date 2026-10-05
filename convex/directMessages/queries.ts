import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser } from '../shared/auth';
import { avatarUrlForUser } from '../avatars/helpers';
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return [];
    const [low, high] = await Promise.all([
      ctx.db
        .query('directConversations')
        .withIndex('by_pair', (q) => q.eq('userLowId', actor._id))
        .collect(),
      ctx.db
        .query('directConversations')
        .withIndex('by_high', (q) => q.eq('userHighId', actor._id))
        .collect(),
    ]);
    const rows = [...low, ...high];
    return Promise.all(
      rows
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (row) => {
          const userId = row.userLowId === actor._id ? row.userHighId : row.userLowId;
          const [user, latestMessages] = await Promise.all([
            ctx.db.get(userId),
            ctx.db
              .query('directMessages')
              .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', row._id))
              .order('desc')
              .take(1),
          ]);
          const latest = latestMessages[0];
          const readerId = latest?.senderId === actor._id ? userId : actor._id;
          const read = latest
            ? await ctx.db
                .query('directMessageReads')
                .withIndex('by_message_user', (q) =>
                  q.eq('messageId', latest._id).eq('userId', readerId),
                )
                .unique()
            : null;
          return {
            id: row._id,
            userId,
            updatedAt: row.updatedAt,
            ...(user && user.deletedAt === undefined
              ? {
                  ...(user.username === undefined ? {} : { username: user.username }),
                  displayName: user.displayName ?? user.name ?? 'Finapp user',
                  ...(user.avatarId === undefined ? {} : { avatarId: user.avatarId }),
                  avatarUrl: await avatarUrlForUser(ctx, user),
                }
              : {}),
            lastMessage: latest
              ? {
                  kind: latest.kind,
                  ...(latest.kind === 'text' ? { text: latest.text ?? '' } : { text: 'Photo' }),
                  createdAt: latest.createdAt,
                  mine: latest.senderId === actor._id,
                  seen: read !== null,
                }
              : null,
          };
        }),
    );
  },
});

export const messages = query({
  args: { conversationId: v.id('directConversations') },
  handler: async (ctx, { conversationId }) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return [];
    const conversation = await ctx.db.get(conversationId);
    if (
      !conversation ||
      (conversation.userLowId !== actor._id && conversation.userHighId !== actor._id)
    )
      return [];
    const messages = await ctx.db
      .query('directMessages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId))
      .order('asc')
      .collect();
    return Promise.all(
      messages.map(async (message) => {
        const readerId =
          message.senderId === actor._id
            ? conversation.userLowId === actor._id
              ? conversation.userHighId
              : conversation.userLowId
            : actor._id;
        const [read, sender, reactions] = await Promise.all([
          ctx.db
            .query('directMessageReads')
            .withIndex('by_message_user', (q) =>
              q.eq('messageId', message._id).eq('userId', readerId),
            )
            .unique(),
          ctx.db.get(message.senderId),
          ctx.db
            .query('directMessageReactions')
            .withIndex('by_message_user', (q) => q.eq('messageId', message._id))
            .collect(),
        ]);
        const reactionCounts = new Map<string, number>();
        for (const reaction of reactions)
          reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) ?? 0) + 1);
        return {
          id: message._id,
          senderId: message.senderId,
          kind: message.kind,
          ...(message.text === undefined ? {} : { text: message.text }),
          ...(message.storageId
            ? { attachmentUrl: await ctx.storage.getUrl(message.storageId) }
            : {}),
          ...(message.mimeType === undefined ? {} : { mimeType: message.mimeType }),
          ...(message.size === undefined ? {} : { size: message.size }),
          createdAt: message.createdAt,
          seen: read !== null,
          senderName: sender?.displayName ?? sender?.name ?? 'Finapp user',
          reactions: [...reactionCounts].map(([emoji, count]) => ({ emoji, count })),
          myReaction: reactions.find((reaction) => reaction.userId === actor._id)?.emoji ?? null,
        };
      }),
    );
  },
});
