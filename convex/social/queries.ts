import { v } from 'convex/values';
import { query } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { getOptionalUser } from '../shared/auth';
import { avatarUrlForUser } from '../avatars/helpers';

const safeProfile = (user: Doc<'users'>) => ({
  id: user._id,
  ...(user.username === undefined ? {} : { username: user.username }),
  displayName: user.displayName ?? user.name ?? 'Finapp user',
  ...(user.avatarId === undefined ? {} : { avatarId: user.avatarId }),
});

export const friends = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor || actor.deletedAt !== undefined) return [];
    const [asLow, asHigh] = await Promise.all([
      ctx.db
        .query('friendships')
        .withIndex('by_low', (q) => q.eq('userLowId', actor._id))
        .collect(),
      ctx.db
        .query('friendships')
        .withIndex('by_high', (q) => q.eq('userHighId', actor._id))
        .collect(),
    ]);
    const ids = [...asLow.map((row) => row.userHighId), ...asHigh.map((row) => row.userLowId)];
    const users = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const profiles = await Promise.all(
      users.map(async (user) =>
        user && user.deletedAt === undefined
          ? { ...safeProfile(user), avatarUrl: await avatarUrlForUser(ctx, user) }
          : null,
      ),
    );
    return profiles.filter((profile): profile is NonNullable<typeof profile> => profile !== null);
  },
});

export const requests = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor || actor.deletedAt !== undefined) return { incoming: [], outgoing: [] };
    const [incoming, outgoing] = await Promise.all([
      ctx.db
        .query('friendRequests')
        .withIndex('by_recipient_status', (q) =>
          q.eq('recipientId', actor._id).eq('status', 'pending'),
        )
        .collect(),
      ctx.db
        .query('friendRequests')
        .withIndex('by_requester_status', (q) =>
          q.eq('requesterId', actor._id).eq('status', 'pending'),
        )
        .collect(),
    ]);
    const userIds = [
      ...incoming.map((item) => item.requesterId),
      ...outgoing.map((item) => item.recipientId),
    ];
    const users = await Promise.all(userIds.map((id) => ctx.db.get(id)));
    const userById = new Map(userIds.map((id, index) => [id, users[index] ?? null]));
    const toProfile = async (id: Id<'users'>) => {
      const user = userById.get(id);
      return user && user.deletedAt === undefined
        ? { ...safeProfile(user), avatarUrl: await avatarUrlForUser(ctx, user) }
        : null;
    };
    const incomingProfiles = await Promise.all(
      incoming.map(async (request) => ({
        request,
        user: await toProfile(request.requesterId),
      })),
    );
    const outgoingProfiles = await Promise.all(
      outgoing.map(async (request) => ({
        request,
        user: await toProfile(request.recipientId),
      })),
    );
    return {
      incoming: incomingProfiles.flatMap(({ request, user }) =>
        user ? [{ requestId: request._id, createdAt: request.createdAt, user }] : [],
      ),
      outgoing: outgoingProfiles.flatMap(({ request, user }) =>
        user ? [{ requestId: request._id, createdAt: request.createdAt, user }] : [],
      ),
    };
  },
});

export const suggestions = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor || actor.deletedAt !== undefined) return [];
    const [asLow, asHigh, incoming, outgoing] = await Promise.all([
      ctx.db
        .query('friendships')
        .withIndex('by_low', (q) => q.eq('userLowId', actor._id))
        .collect(),
      ctx.db
        .query('friendships')
        .withIndex('by_high', (q) => q.eq('userHighId', actor._id))
        .collect(),
      ctx.db
        .query('friendRequests')
        .withIndex('by_recipient_status', (q) =>
          q.eq('recipientId', actor._id).eq('status', 'pending'),
        )
        .collect(),
      ctx.db
        .query('friendRequests')
        .withIndex('by_requester_status', (q) =>
          q.eq('requesterId', actor._id).eq('status', 'pending'),
        )
        .collect(),
    ]);
    const directFriendIds = [
      ...asLow.map((row) => row.userHighId),
      ...asHigh.map((row) => row.userLowId),
    ];
    if (directFriendIds.length === 0) return [];

    const excludedIds = new Set([
      actor._id,
      ...directFriendIds,
      ...incoming.map((row) => row.requesterId),
      ...outgoing.map((row) => row.recipientId),
    ]);
    const mutualsByCandidate = new Map<Id<'users'>, number>();
    const friendEdges = await Promise.all(
      directFriendIds.map(async (friendId) => {
        const [low, high] = await Promise.all([
          ctx.db
            .query('friendships')
            .withIndex('by_low', (q) => q.eq('userLowId', friendId))
            .take(100),
          ctx.db
            .query('friendships')
            .withIndex('by_high', (q) => q.eq('userHighId', friendId))
            .take(100),
        ]);
        return [...low.map((row) => row.userHighId), ...high.map((row) => row.userLowId)];
      }),
    );
    for (const edge of friendEdges) {
      for (const candidateId of edge) {
        if (!excludedIds.has(candidateId))
          mutualsByCandidate.set(candidateId, (mutualsByCandidate.get(candidateId) ?? 0) + 1);
      }
    }

    const rankedIds = [...mutualsByCandidate.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 36);
    const candidates = await Promise.all(rankedIds.map(([id]) => ctx.db.get(id)));
    const profiles = await Promise.all(
      candidates.map(async (user, index) => {
        if (
          !user ||
          user.deletedAt !== undefined ||
          user.emailVerificationTime === undefined ||
          !user.username
        )
          return null;
        return {
          ...safeProfile(user),
          avatarUrl: await avatarUrlForUser(ctx, user),
          mutualFriendCount: rankedIds[index]?.[1] ?? 0,
        };
      }),
    );
    return profiles
      .filter((profile) => profile !== null)
      .sort(
        (left, right) =>
          right.mutualFriendCount - left.mutualFriendCount ||
          left.displayName.localeCompare(right.displayName),
      )
      .slice(0, 12);
  },
});

export const relationship = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const person = await ctx.db.get(userId);
    if (!person || person.deletedAt !== undefined) return null;
    const profile = {
      ...safeProfile(person),
      avatarUrl: await avatarUrlForUser(ctx, person),
    };
    const actor = await getOptionalUser(ctx);
    if (!actor || actor.deletedAt !== undefined)
      return { profile, status: 'unknown' as const, mutualFriends: [], sharedGroups: [] };
    if (actor._id === person._id)
      return { profile, status: 'self' as const, mutualFriends: [], sharedGroups: [] };

    const lowId = String(actor._id) < String(userId) ? actor._id : userId;
    const highId = lowId === actor._id ? userId : actor._id;
    const [
      friendship,
      incomingRequest,
      outgoingRequest,
      actorLow,
      actorHigh,
      personLow,
      personHigh,
      actorGroups,
      personGroups,
    ] = await Promise.all([
      ctx.db
        .query('friendships')
        .withIndex('by_pair', (q) => q.eq('userLowId', lowId).eq('userHighId', highId))
        .unique(),
      ctx.db
        .query('friendRequests')
        .withIndex('by_pair', (q) => q.eq('requesterId', userId).eq('recipientId', actor._id))
        .unique(),
      ctx.db
        .query('friendRequests')
        .withIndex('by_pair', (q) => q.eq('requesterId', actor._id).eq('recipientId', userId))
        .unique(),
      ctx.db
        .query('friendships')
        .withIndex('by_low', (q) => q.eq('userLowId', actor._id))
        .collect(),
      ctx.db
        .query('friendships')
        .withIndex('by_high', (q) => q.eq('userHighId', actor._id))
        .collect(),
      ctx.db
        .query('friendships')
        .withIndex('by_low', (q) => q.eq('userLowId', userId))
        .collect(),
      ctx.db
        .query('friendships')
        .withIndex('by_high', (q) => q.eq('userHighId', userId))
        .collect(),
      ctx.db
        .query('groupMembers')
        .withIndex('by_user', (q) => q.eq('userId', actor._id))
        .collect(),
      ctx.db
        .query('groupMembers')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect(),
    ]);
    const viewerFriends = new Set([
      ...actorLow.map((row) => row.userHighId),
      ...actorHigh.map((row) => row.userLowId),
    ]);
    const personFriends = new Set([
      ...personLow.map((row) => row.userHighId),
      ...personHigh.map((row) => row.userLowId),
    ]);
    const mutualIds = [...viewerFriends].filter((id) => personFriends.has(id));
    const mutualUsers = await Promise.all(mutualIds.map((id) => ctx.db.get(id)));
    const mutualFriends = await Promise.all(
      mutualUsers.map(async (user) =>
        user && user.deletedAt === undefined
          ? { ...safeProfile(user), avatarUrl: await avatarUrlForUser(ctx, user) }
          : null,
      ),
    );
    const viewerGroupIds = new Set(actorGroups.map((row) => row.groupId));
    const sharedGroupIds = personGroups
      .map((row) => row.groupId)
      .filter((id) => viewerGroupIds.has(id));
    const sharedGroups = await Promise.all(
      sharedGroupIds.map(async (id) => {
        const group = await ctx.db.get(id);
        if (!group || group.archivedAt !== undefined) return null;
        const members = await ctx.db
          .query('groupMembers')
          .withIndex('by_group', (q) => q.eq('groupId', id))
          .collect();
        return {
          id,
          name: group.name,
          icon: group.icon,
          color: group.color,
          memberCount: members.length,
        };
      }),
    );
    return {
      profile,
      status: friendship
        ? ('friends' as const)
        : incomingRequest?.status === 'pending'
          ? ('incoming' as const)
          : outgoingRequest?.status === 'pending'
            ? ('outgoing' as const)
            : ('none' as const),
      ...(incomingRequest?.status === 'pending' ? { incomingRequestId: incomingRequest._id } : {}),
      ...(outgoingRequest?.status === 'pending' ? { outgoingRequestId: outgoingRequest._id } : {}),
      mutualFriends: mutualFriends.filter((user) => user !== null),
      sharedGroups: sharedGroups.filter((group) => group !== null),
    };
  },
});

/** People shown on the People hub at most (friends and direct-message contacts). */
const PEOPLE_HUB_LIMIT = 60;
const PEOPLE_HUB_UNREAD_CAP = 9;

/**
 * The People hub row: everyone you're friends with or have a direct conversation with, with
 * unread counts and (when they allow it) whether they're active or when they were last seen.
 * Unread people first, then most recent conversation.
 */
export const peopleHub = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor || actor.deletedAt !== undefined) return [];
    const [friendLow, friendHigh, convLow, convHigh] = await Promise.all([
      ctx.db
        .query('friendships')
        .withIndex('by_low', (q) => q.eq('userLowId', actor._id))
        .collect(),
      ctx.db
        .query('friendships')
        .withIndex('by_high', (q) => q.eq('userHighId', actor._id))
        .collect(),
      ctx.db
        .query('directConversations')
        .withIndex('by_pair', (q) => q.eq('userLowId', actor._id))
        .collect(),
      ctx.db
        .query('directConversations')
        .withIndex('by_high', (q) => q.eq('userHighId', actor._id))
        .collect(),
    ]);
    const conversationByPeer = new Map<string, Doc<'directConversations'>>();
    for (const row of [...convLow, ...convHigh]) {
      const peer = row.userLowId === actor._id ? row.userHighId : row.userLowId;
      conversationByPeer.set(String(peer), row);
    }
    const peerIds = new Set<string>([
      ...friendLow.map((row) => String(row.userHighId)),
      ...friendHigh.map((row) => String(row.userLowId)),
      ...conversationByPeer.keys(),
    ]);
    const now = Date.now();
    const rows = await Promise.all(
      [...peerIds].slice(0, PEOPLE_HUB_LIMIT * 2).map(async (rawId) => {
        const userId = rawId as Id<'users'>;
        const conversation = conversationByPeer.get(rawId);
        const [user, settings, presence, pointer] = await Promise.all([
          ctx.db.get(userId),
          ctx.db
            .query('userSettings')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .unique(),
          ctx.db
            .query('presence')
            .withIndex('by_user', (q) => q.eq('userId', userId))
            .unique(),
          conversation
            ? ctx.db
                .query('chatReadPointers')
                .withIndex('by_scope_user', (q) =>
                  q
                    .eq('scopeType', 'direct')
                    .eq('scopeId', conversation._id)
                    .eq('userId', actor._id),
                )
                .unique()
            : Promise.resolve(null),
        ]);
        if (!user || user.deletedAt !== undefined) return null;
        let unreadCount = 0;
        if (conversation) {
          const lastReadAt = pointer?.lastReadAt ?? 0;
          const recent = await ctx.db
            .query('directMessages')
            .withIndex('by_conversation_createdAt', (q) =>
              q.eq('conversationId', conversation._id).gt('createdAt', lastReadAt),
            )
            .order('desc')
            .take(PEOPLE_HUB_UNREAD_CAP + 1);
          unreadCount = recent.filter((message) => message.senderId !== actor._id).length;
        }
        const showActive = settings?.showActive ?? true;
        const showLastSeen = settings?.showLastSeen ?? true;
        return {
          ...safeProfile(user),
          avatarUrl: await avatarUrlForUser(ctx, user),
          conversationId: conversation?._id ?? null,
          lastMessageAt: conversation?.updatedAt ?? null,
          unreadCount: Math.min(unreadCount, PEOPLE_HUB_UNREAD_CAP),
          unreadCapped: unreadCount > PEOPLE_HUB_UNREAD_CAP,
          active: showActive ? (presence?.activeUntil ?? 0) > now : null,
          lastSeenAt: showLastSeen ? (presence?.lastSeenAt ?? null) : null,
        };
      }),
    );
    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort(
        (a, b) =>
          Number(b.unreadCount > 0) - Number(a.unreadCount > 0) ||
          (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0) ||
          a.displayName.localeCompare(b.displayName),
      )
      .slice(0, PEOPLE_HUB_LIMIT);
  },
});

const ACTIVITY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Messages read per conversation for analytics at most; older ones fall outside the window. */
const ACTIVITY_MESSAGE_LIMIT = 2000;

/**
 * One person's analytics with you: direct messages per day for the last 30 days (sent and
 * received), message mix, your shared groups and friendship status. Only for people you
 * already share a conversation, friendship or group with.
 */
export const personAnalytics = query({
  args: { userId: v.id('users'), tzOffsetMinutes: v.optional(v.number()) },
  handler: async (ctx, { userId, tzOffsetMinutes = 0 }) => {
    const actor = await getOptionalUser(ctx);
    if (!actor || actor.deletedAt !== undefined || actor._id === userId) return null;
    const person = await ctx.db.get(userId);
    if (!person || person.deletedAt !== undefined) return null;
    const lowId = String(actor._id) < String(userId) ? actor._id : userId;
    const highId = lowId === actor._id ? userId : actor._id;
    const [friendship, conversation, actorGroups, personGroups, presence, settings] =
      await Promise.all([
        ctx.db
          .query('friendships')
          .withIndex('by_pair', (q) => q.eq('userLowId', lowId).eq('userHighId', highId))
          .unique(),
        ctx.db
          .query('directConversations')
          .withIndex('by_pair', (q) => q.eq('userLowId', lowId).eq('userHighId', highId))
          .unique(),
        ctx.db
          .query('groupMembers')
          .withIndex('by_user', (q) => q.eq('userId', actor._id))
          .collect(),
        ctx.db
          .query('groupMembers')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .collect(),
        ctx.db
          .query('presence')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .unique(),
        ctx.db
          .query('userSettings')
          .withIndex('by_user', (q) => q.eq('userId', userId))
          .unique(),
      ]);
    const viewerGroupIds = new Set(actorGroups.map((row) => String(row.groupId)));
    const sharedGroupIds = personGroups
      .map((row) => row.groupId)
      .filter((id) => viewerGroupIds.has(String(id)));
    if (!friendship && !conversation && sharedGroupIds.length === 0) return null;

    const now = Date.now();
    const offset = tzOffsetMinutes * 60_000;
    const todayStart = Math.floor((now - offset) / DAY_MS) * DAY_MS + offset;
    const windowStart = todayStart - (ACTIVITY_DAYS - 1) * DAY_MS;
    const days = Array.from({ length: ACTIVITY_DAYS }, (_, index) => ({
      dayStart: windowStart + index * DAY_MS,
      sent: 0,
      received: 0,
    }));
    const mix = { text: 0, image: 0, audio: 0, ai: 0 };
    let total = 0;
    if (conversation) {
      const recent = await ctx.db
        .query('directMessages')
        .withIndex('by_conversation_createdAt', (q) =>
          q.eq('conversationId', conversation._id).gte('createdAt', windowStart),
        )
        .take(ACTIVITY_MESSAGE_LIMIT);
      for (const message of recent) {
        const index = Math.floor((message.createdAt - windowStart) / DAY_MS);
        const day = days[index];
        if (!day) continue;
        if (message.senderId === actor._id && message.kind !== 'ai') day.sent += 1;
        else day.received += 1;
        mix[message.kind] += 1;
        total += 1;
      }
    }
    const groups = await Promise.all(
      sharedGroupIds.map(async (id) => {
        const group = await ctx.db.get(id);
        return group && group.archivedAt === undefined
          ? { id, name: group.name, icon: group.icon, color: group.color }
          : null;
      }),
    );
    return {
      profile: { ...safeProfile(person), avatarUrl: await avatarUrlForUser(ctx, person) },
      friends: friendship !== null,
      friendsSince: friendship?._creationTime ?? null,
      conversationId: conversation?._id ?? null,
      conversationSince: conversation?.createdAt ?? null,
      active: (settings?.showActive ?? true) ? (presence?.activeUntil ?? 0) > now : null,
      lastSeenAt: (settings?.showLastSeen ?? true) ? (presence?.lastSeenAt ?? null) : null,
      days,
      totalMessages: total,
      mix,
      sharedGroups: groups.filter((group) => group !== null),
    };
  },
});
