import { query, type QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { getOptionalUser } from '../shared/auth';
import { avatarUrlForUser } from '../avatars/helpers';
import {
  CHAT_PIN_LIMIT,
  countUnread,
  emptyPage,
  loadReadPointers,
  profileLoader,
  summariseReactions,
} from '../shared/chat';
import { actionViews } from '../ai/actions';
import { finaiFields } from '../ai/chatShape';

async function participantConversation(
  ctx: QueryCtx,
  rawConversationId: string,
  actorId: Id<'users'>,
) {
  const conversationId = ctx.db.normalizeId('directConversations', rawConversationId);
  if (!conversationId) return null;
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || (conversation.userLowId !== actorId && conversation.userHighId !== actorId))
    return null;
  return conversation;
}

const peerOf = (conversation: Doc<'directConversations'>, actorId: Id<'users'>) =>
  conversation.userLowId === actorId ? conversation.userHighId : conversation.userLowId;

/** Shapes a page of messages: one profile read per sender, reactions per message. */
async function enrichMessages(
  ctx: QueryCtx,
  messages: readonly Doc<'directMessages'>[],
  actorId: Id<'users'>,
) {
  const profile = profileLoader(ctx, 'Finapp user');
  const actions = await actionViews(
    ctx,
    messages.filter((message) => message.kind === 'ai').map((message) => String(message._id)),
    actorId,
  );
  return Promise.all(
    messages.map(async (message) => {
      const [sender, reactions, attachmentUrl] = await Promise.all([
        profile(message.senderId),
        ctx.db
          .query('directMessageReactions')
          .withIndex('by_message_user', (q) => q.eq('messageId', message._id))
          .collect(),
        message.storageId ? ctx.storage.getUrl(message.storageId) : Promise.resolve(undefined),
      ]);
      return {
        id: message._id,
        senderId: message.senderId,
        kind: message.kind,
        ...(message.text === undefined ? {} : { text: message.text }),
        ...(message.storageId ? { attachmentUrl } : {}),
        ...(message.mimeType === undefined ? {} : { mimeType: message.mimeType }),
        ...(message.size === undefined ? {} : { size: message.size }),
        createdAt: message.createdAt,
        senderName: sender.name,
        ...(sender.avatarId === undefined ? {} : { senderAvatarId: sender.avatarId }),
        senderAvatarUrl: sender.avatarUrl,
        pinnedAt: message.pinnedAt ?? null,
        ...summariseReactions(reactions, actorId),
        ...finaiFields(message, actions, actorId),
      };
    }),
  );
}

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
          const userId = peerOf(row, actor._id);
          const scope = { type: 'direct' as const, id: row._id };
          const [user, latestMessages, pointers] = await Promise.all([
            ctx.db.get(userId),
            ctx.db
              .query('directMessages')
              .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', row._id))
              .order('desc')
              .take(1),
            loadReadPointers(ctx, scope, [actor._id, userId]),
          ]);
          const latest = latestMessages[0];
          const myLastReadAt = pointers.get(actor._id) ?? 0;
          const peerLastReadAt = pointers.get(userId) ?? 0;
          const unreadCount =
            latest && latest.senderId !== actor._id && latest.createdAt > myLastReadAt
              ? await countUnread(ctx, scope, actor._id, myLastReadAt)
              : 0;
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
            unreadCount,
            lastMessage: latest
              ? {
                  kind: latest.kind,
                  ...(latest.kind === 'text' ? { text: latest.text ?? '' } : { text: 'Photo' }),
                  createdAt: latest.createdAt,
                  mine: latest.senderId === actor._id,
                  seen:
                    latest.senderId === actor._id
                      ? peerLastReadAt >= latest.createdAt
                      : myLastReadAt >= latest.createdAt,
                }
              : null,
          };
        }),
    );
  },
});

/**
 * Latest messages oldest first (compatibility; prefer messagesPage). Capped so a long
 * conversation never loads whole.
 */
export const messages = query({
  // Accept raw route params; malformed ids return no messages instead of throwing.
  args: { conversationId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { conversationId, limit }) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return [];
    const conversation = await participantConversation(ctx, conversationId, actor._id);
    if (!conversation) return [];
    const take = Math.max(1, Math.min(200, Math.floor(limit ?? 100)));
    const [rows, pointers] = await Promise.all([
      ctx.db
        .query('directMessages')
        .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversation._id))
        .order('desc')
        .take(take),
      loadReadPointers(ctx, { type: 'direct', id: conversation._id }, [
        conversation.userLowId,
        conversation.userHighId,
      ]),
    ]);
    const peerId = peerOf(conversation, actor._id);
    const enriched = await enrichMessages(ctx, rows.reverse(), actor._id);
    return enriched.map((message) => {
      const readerId = message.senderId === actor._id ? peerId : actor._id;
      return { ...message, seen: (pointers.get(readerId) ?? 0) >= message.createdAt };
    });
  },
});

/**
 * Newest-first pages for infinite scroll. Seen state lives in conversationMeta so read
 * receipts do not invalidate loaded pages.
 */
export const messagesPage = query({
  args: { conversationId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { conversationId, paginationOpts }) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return emptyPage;
    const conversation = await participantConversation(ctx, conversationId, actor._id);
    if (!conversation) return emptyPage;
    const result = await ctx.db
      .query('directMessages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversation._id))
      .order('desc')
      .paginate(paginationOpts);
    return { ...result, page: await enrichMessages(ctx, result.page, actor._id) };
  },
});

/** Read pointers, pins and unread count for one conversation. */
export const conversationMeta = query({
  args: { conversationId: v.string() },
  handler: async (ctx, { conversationId }) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return null;
    const conversation = await participantConversation(ctx, conversationId, actor._id);
    if (!conversation) return null;
    const peerId = peerOf(conversation, actor._id);
    const scope = { type: 'direct' as const, id: conversation._id };
    const [pointers, pinnedRows] = await Promise.all([
      loadReadPointers(ctx, scope, [actor._id, peerId]),
      ctx.db
        .query('directMessages')
        .withIndex('by_conversation_pinnedAt', (q) =>
          q.eq('conversationId', conversation._id).gt('pinnedAt', 0),
        )
        .order('desc')
        .take(CHAT_PIN_LIMIT),
    ]);
    const myLastReadAt = pointers.get(actor._id) ?? 0;
    const profile = profileLoader(ctx, 'Finapp user');
    return {
      peerId,
      myLastReadAt,
      peerLastReadAt: pointers.get(peerId) ?? 0,
      unreadCount: await countUnread(ctx, scope, actor._id, myLastReadAt),
      pinned: await Promise.all(
        pinnedRows.map(async (message) => ({
          id: message._id,
          kind: message.kind,
          text: message.kind === 'text' ? (message.text ?? '') : 'Photo',
          senderId: message.senderId,
          senderName: (await profile(message.senderId)).name,
          createdAt: message.createdAt,
          pinnedAt: message.pinnedAt ?? 0,
        })),
      ),
    };
  },
});
