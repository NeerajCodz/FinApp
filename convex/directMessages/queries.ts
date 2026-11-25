import { query, type QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { getOptionalUser } from '../shared/auth';
import { avatarUrlForUser } from '../avatars/helpers';
import {
  CHAT_PIN_LIMIT,
  CHAT_UNREAD_CAP,
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
        ...(message.durationMs === undefined ? {} : { durationMs: message.durationMs }),
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

/** Unread threads (newest first) that get an exact count; the rest stop at the soft cap. */
const INBOX_EXACT_UNREAD_ROWS = 10;
const INBOX_UNREAD_SOFT_CAP = 9;

/** One-line preview of a message for lists and pins. */
function messagePreview(message: Doc<'directMessages'>): string {
  if (message.kind === 'audio') return 'Voice message';
  if (message.kind === 'image') return 'Photo';
  return message.text ?? '';
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
    // Exact counts only for the newest unread threads; older ones stop at a small cap so the
    // inbox's reads stay bounded. Slots are assigned in updatedAt order (not completion order).
    const sorted = rows.sort((a, b) => b.updatedAt - a.updatedAt);
    const heads = await Promise.all(
      sorted.map(async (row) => {
        const userId = peerOf(row, actor._id);
        const scope = { type: 'direct' as const, id: row._id };
        const [latest, pointers] = await Promise.all([
          ctx.db
            .query('directMessages')
            .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', row._id))
            .order('desc')
            .first(),
          loadReadPointers(ctx, scope, [actor._id, userId]),
        ]);
        const myLastReadAt = pointers.get(actor._id) ?? 0;
        const hasUnread =
          !!latest && latest.senderId !== actor._id && latest.createdAt > myLastReadAt;
        return { row, userId, scope, latest, pointers, myLastReadAt, hasUnread };
      }),
    );
    const exactRows = new Set(
      heads
        .filter((head) => head.hasUnread)
        .slice(0, INBOX_EXACT_UNREAD_ROWS)
        .map((head) => String(head.row._id)),
    );
    return Promise.all(
      heads.map(async ({ row, userId, scope, latest, pointers, myLastReadAt, hasUnread }) => {
        const user = await ctx.db.get(userId);
        const peerLastReadAt = pointers.get(userId) ?? 0;
        const cap = exactRows.has(String(row._id)) ? CHAT_UNREAD_CAP : INBOX_UNREAD_SOFT_CAP;
        const unreadCount = hasUnread
          ? await countUnread(ctx, scope, actor._id, myLastReadAt, undefined, cap)
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
          /** The count stopped at its cap: show it as "N+". */
          unreadCapped: hasUnread && unreadCount >= cap,
          lastMessage: latest
            ? {
                kind: latest.kind,
                ...{ text: messagePreview(latest) },
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
          text: messagePreview(message),
          senderId: message.senderId,
          senderName: (await profile(message.senderId)).name,
          createdAt: message.createdAt,
          pinnedAt: message.pinnedAt ?? 0,
        })),
      ),
    };
  },
});
