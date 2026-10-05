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
    return users.flatMap((user) =>
      user && user.deletedAt === undefined ? [safeProfile(user)] : [],
    );
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
    const toProfile = (id: Id<'users'>) => {
      const user = userById.get(id);
      return user && user.deletedAt === undefined ? safeProfile(user) : null;
    };
    return {
      incoming: incoming.flatMap((request) => {
        const user = toProfile(request.requesterId);
        return user ? [{ requestId: request._id, createdAt: request.createdAt, user }] : [];
      }),
      outgoing: outgoing.flatMap((request) => {
        const user = toProfile(request.recipientId);
        return user ? [{ requestId: request._id, createdAt: request.createdAt, user }] : [];
      }),
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
