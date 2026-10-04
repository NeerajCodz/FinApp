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
          const user = await ctx.db.get(userId);
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
        const [read, sender] = await Promise.all([
          ctx.db
            .query('directMessageReads')
            .withIndex('by_message_user', (q) =>
              q.eq('messageId', message._id).eq('userId', readerId),
            )
            .unique(),
          ctx.db.get(message.senderId),
        ]);
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
        };
      }),
    );
  },
});
