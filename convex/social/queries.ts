import { query } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { getOptionalUser } from '../shared/auth';

export const friends = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return [];
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
      user && user.deletedAt === undefined
        ? [
            {
              id: user._id,
              ...(user.username === undefined ? {} : { username: user.username }),
              displayName: user.displayName ?? user.name ?? 'Finapp user',
              ...(user.avatarId === undefined ? {} : { avatarId: user.avatarId }),
            },
          ]
        : [],
    );
  },
});

export const requests = query({
  args: {},
  handler: async (ctx) => {
    const actor = await getOptionalUser(ctx);
    if (!actor) return { incoming: [], outgoing: [] };
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
    const userById = new Map<Id<'users'>, Doc<'users'> | null>();
    for (const id of [
      ...incoming.map((item) => item.requesterId),
      ...outgoing.map((item) => item.recipientId),
    ]) {
      if (!userById.has(id)) userById.set(id, await ctx.db.get(id));
    }
    const safeProfile = (user: Doc<'users'> | null) =>
      user && user.deletedAt === undefined
        ? {
            id: user._id,
            ...(user.username === undefined ? {} : { username: user.username }),
            displayName: user.displayName ?? user.name ?? 'Finapp user',
            ...(user.avatarId === undefined ? {} : { avatarId: user.avatarId }),
          }
        : null;
    return {
      incoming: incoming.flatMap((request) => {
        const user = safeProfile(userById.get(request.requesterId) ?? null);
        return user ? [{ requestId: request._id, createdAt: request.createdAt, user }] : [];
      }),
      outgoing: outgoing.flatMap((request) => {
        const user = safeProfile(userById.get(request.recipientId) ?? null);
        return user ? [{ requestId: request._id, createdAt: request.createdAt, user }] : [];
      }),
    };
  },
});
