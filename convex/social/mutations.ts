import { mutation } from '../_generated/server';
import type { MutationCtx } from '../_generated/server';
import { v } from 'convex/values';
import { requireUser } from '../shared/auth';
import type { Id } from '../_generated/dataModel';

function assertVerified(user: {
  emailVerificationTime?: number;
  email?: string;
  deletedAt?: number;
}) {
  if (user.deletedAt !== undefined) throw new Error('USER_UNAVAILABLE');
  if (!user.email || user.emailVerificationTime === undefined)
    throw new Error('VERIFIED_EMAIL_REQUIRED');
}
async function ensureFriendship(
  ctx: MutationCtx,
  first: Id<'users'>,
  second: Id<'users'>,
  now: number,
) {
  const [userLowId, userHighId] =
    String(first) < String(second) ? [first, second] : [second, first];
  const existing = await ctx.db
    .query('friendships')
    .withIndex('by_pair', (q) => q.eq('userLowId', userLowId).eq('userHighId', userHighId))
    .unique();
  if (!existing) await ctx.db.insert('friendships', { userLowId, userHighId, createdAt: now });
}

export const sendRequest = mutation({
  args: { recipientId: v.id('users') },
  handler: async (ctx, { recipientId }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    assertVerified(actor);
    if (actor._id === recipientId) throw new Error('CANNOT_FRIEND_SELF');
    const recipient = await ctx.db.get(recipientId);
    if (!recipient || recipient.deletedAt !== undefined) throw new Error('USER_UNAVAILABLE');
    assertVerified(recipient);
    const [low, high] =
      String(actor._id) < String(recipientId) ? [actor._id, recipientId] : [recipientId, actor._id];
    const friendship = await ctx.db
      .query('friendships')
      .withIndex('by_pair', (q) => q.eq('userLowId', low).eq('userHighId', high))
      .unique();
    if (friendship) throw new Error('ALREADY_FRIENDS');
    const outgoing = await ctx.db
      .query('friendRequests')
      .withIndex('by_pair', (q) => q.eq('requesterId', actor._id).eq('recipientId', recipientId))
      .unique();
    if (outgoing?.status === 'pending')
      return { requestId: outgoing._id, status: 'pending' as const };
    const incoming = await ctx.db
      .query('friendRequests')
      .withIndex('by_pair', (q) => q.eq('requesterId', recipientId).eq('recipientId', actor._id))
      .unique();
    const now = Date.now();
    if (incoming?.status === 'pending') {
      await ctx.db.patch(incoming._id, { status: 'accepted', updatedAt: now });
      await ensureFriendship(ctx, actor._id, recipientId, now);
      return { requestId: incoming._id, status: 'accepted' as const };
    }
    if (outgoing) {
      await ctx.db.patch(outgoing._id, { status: 'pending', createdAt: now, updatedAt: now });
      return { requestId: outgoing._id, status: 'pending' as const };
    }
    const requestId = await ctx.db.insert('friendRequests', {
      requesterId: actor._id,
      recipientId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return { requestId, status: 'pending' as const };
  },
});

export const respondToRequest = mutation({
  args: {
    requestId: v.id('friendRequests'),
    response: v.union(v.literal('accept'), v.literal('decline')),
  },
  handler: async (ctx, { requestId, response }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    assertVerified(actor);
    const request = await ctx.db.get(requestId);
    if (!request || request.recipientId !== actor._id || request.status !== 'pending')
      throw new Error('REQUEST_UNAVAILABLE');
    const requester = await ctx.db.get(request.requesterId);
    if (!requester || requester.deletedAt !== undefined) throw new Error('USER_UNAVAILABLE');
    assertVerified(requester);
    const now = Date.now();
    const status = response === 'accept' ? 'accepted' : 'declined';
    await ctx.db.patch(requestId, { status, updatedAt: now });
    if (status === 'accepted') await ensureFriendship(ctx, actor._id, request.requesterId, now);
    return status;
  },
});

export const cancelRequest = mutation({
  args: { requestId: v.id('friendRequests') },
  handler: async (ctx, { requestId }) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const request = await ctx.db.get(requestId);
    if (!request || request.requesterId !== actor._id || request.status !== 'pending')
      throw new Error('REQUEST_UNAVAILABLE');
    await ctx.db.patch(requestId, { status: 'canceled', updatedAt: Date.now() });
    return null;
  },
});
