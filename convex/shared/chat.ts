import { v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { avatarUrlForUser } from '../avatars/helpers';

/** Maximum pinned messages per thread; older pins must be removed first. */
export const CHAT_PIN_LIMIT = 20;
/** Unread counts stop at this many rows so list queries stay bounded ("99+"). */
export const CHAT_UNREAD_CAP = 99;

export const chatReactionEmoji = v.union(
  v.literal('❤️'),
  v.literal('👍'),
  v.literal('😂'),
  v.literal('😮'),
);

export type ChatScope =
  { type: 'group'; id: Id<'groups'> } | { type: 'direct'; id: Id<'directConversations'> };

export const emptyPage = { page: [], isDone: true, continueCursor: '' };

/**
 * Reader pointers for a thread. Users without a pointer row fall back to their newest legacy
 * per-message receipt, so threads read before pointers existed keep their seen state.
 */
export async function loadReadPointers(
  ctx: QueryCtx,
  scope: ChatScope,
  userIds: readonly Id<'users'>[],
): Promise<Map<Id<'users'>, number>> {
  const rows = await ctx.db
    .query('chatReadPointers')
    .withIndex('by_scope', (q) => q.eq('scopeType', scope.type).eq('scopeId', scope.id))
    .collect();
  const pointers = new Map<Id<'users'>, number>();
  for (const row of rows) pointers.set(row.userId, row.lastReadAt);
  await Promise.all(
    userIds
      .filter((userId) => !pointers.has(userId))
      .map(async (userId) => {
        const legacy = await legacyReadAt(ctx, scope, userId);
        if (legacy !== null) pointers.set(userId, legacy);
      }),
  );
  return pointers;
}
/** A single reader pointer without loading every participant pointer for the thread. */
export async function loadReadPointer(
  ctx: QueryCtx,
  scope: ChatScope,
  userId: Id<'users'>,
): Promise<number> {
  const pointer = await ctx.db
    .query('chatReadPointers')
    .withIndex('by_scope_user', (q) =>
      q.eq('scopeType', scope.type).eq('scopeId', scope.id).eq('userId', userId),
    )
    .unique();
  if (pointer) return pointer.lastReadAt;
  return (await legacyReadAt(ctx, scope, userId)) ?? 0;
}

async function legacyReadAt(
  ctx: QueryCtx,
  scope: ChatScope,
  userId: Id<'users'>,
): Promise<number | null> {
  const receipt =
    scope.type === 'group'
      ? await ctx.db
          .query('groupMessageReads')
          .withIndex('by_group_user', (q) => q.eq('groupId', scope.id).eq('userId', userId))
          .order('desc')
          .first()
      : await ctx.db
          .query('directMessageReads')
          .withIndex('by_conversation_user', (q) =>
            q.eq('conversationId', scope.id).eq('userId', userId),
          )
          .order('desc')
          .first();
  if (!receipt) return null;
  const message = await ctx.db.get(receipt.messageId);
  return message?.createdAt ?? receipt.seenAt;
}

/** Moves a reader pointer forward (never back), clamped to now. */
export async function advanceReadPointer(
  ctx: MutationCtx,
  scope: ChatScope,
  userId: Id<'users'>,
  readAt: number,
): Promise<number> {
  const now = Date.now();
  const target = Math.min(readAt, now);
  const existing = await ctx.db
    .query('chatReadPointers')
    .withIndex('by_scope_user', (q) =>
      q.eq('scopeType', scope.type).eq('scopeId', scope.id).eq('userId', userId),
    )
    .unique();
  if (existing) {
    if (existing.lastReadAt >= target) return existing.lastReadAt;
    await ctx.db.patch(existing._id, { lastReadAt: target, updatedAt: now });
    return target;
  }
  const legacy = await legacyReadAt(ctx, scope, userId);
  const lastReadAt = Math.max(target, legacy ?? 0);
  await ctx.db.insert('chatReadPointers', {
    scopeType: scope.type,
    scopeId: scope.id,
    userId,
    lastReadAt,
    updatedAt: now,
  });
  return lastReadAt;
}

/** Messages from other people after the reader's pointer, capped at CHAT_UNREAD_CAP. */
export async function countUnread(
  ctx: QueryCtx,
  scope: ChatScope,
  userId: Id<'users'>,
  lastReadAt: number,
  now = Date.now(),
  /** Stop counting at this many (reads at most twice as many messages). */
  cap = CHAT_UNREAD_CAP,
): Promise<number> {
  const rows: Array<Doc<'groupMessages'> | Doc<'directMessages'>> =
    scope.type === 'group'
      ? await ctx.db
          .query('groupMessages')
          .withIndex('by_group_createdAt', (q) =>
            q.eq('groupId', scope.id).gt('createdAt', lastReadAt),
          )
          .order('desc')
          .take(cap * 2)
      : await ctx.db
          .query('directMessages')
          .withIndex('by_conversation_createdAt', (q) =>
            q.eq('conversationId', scope.id).gt('createdAt', lastReadAt),
          )
          .order('desc')
          .take(cap * 2);
  return Math.min(
    cap,
    rows.filter(
      (row) =>
        row.senderId !== userId &&
        !('expiresAt' in row && row.expiresAt !== undefined && row.expiresAt <= now),
    ).length,
  );
}

/** Removes the sender's typing indicator; sending a message ends typing. */
export async function clearTyping(ctx: MutationCtx, scope: ChatScope, userId: Id<'users'>) {
  const indicator = await ctx.db
    .query('typingIndicators')
    .withIndex('by_scope_user', (q) =>
      q.eq('scopeType', scope.type).eq('scopeId', scope.id).eq('userId', userId),
    )
    .unique();
  if (indicator) await ctx.db.delete(indicator._id);
}

export type ChatProfile = {
  name: string;
  avatarId?: string;
  gender?: Doc<'users'>['gender'];
  avatarUrl: string | null;
};

/** Memoised sender lookups so a page of messages reads each profile once. */
export function profileLoader(ctx: QueryCtx, fallbackName: string) {
  const cache = new Map<Id<'users'>, Promise<ChatProfile>>();
  return (userId: Id<'users'>) => {
    let pending = cache.get(userId);
    if (!pending) {
      pending = (async () => {
        const user = await ctx.db.get(userId);
        return {
          name: user?.displayName ?? user?.name ?? fallbackName,
          ...(user?.avatarId === undefined ? {} : { avatarId: user.avatarId }),
          ...(user?.gender === undefined ? {} : { gender: user.gender }),
          avatarUrl: user ? await avatarUrlForUser(ctx, user) : null,
        };
      })();
      cache.set(userId, pending);
    }
    return pending;
  };
}

/** Groups reaction rows into counts plus the viewer's own choice. */
export function summariseReactions(
  reactions: readonly { emoji: string; userId: Id<'users'> }[],
  viewerId: Id<'users'>,
) {
  const counts = new Map<string, number>();
  for (const reaction of reactions)
    counts.set(reaction.emoji, (counts.get(reaction.emoji) ?? 0) + 1);
  return {
    reactions: [...counts].map(([emoji, count]) => ({ emoji, count })),
    myReaction: reactions.find((reaction) => reaction.userId === viewerId)?.emoji ?? null,
  };
}
