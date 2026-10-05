import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

describe('direct-message conversation previews', () => {
  it('returns the newest message preview and read state for each participant', async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const actorId = await ctx.db.insert('users', {
        email: 'actor@example.com',
        displayName: 'Actor',
      });
      const peerId = await ctx.db.insert('users', {
        email: 'peer@example.com',
        displayName: 'Peer',
        username: 'peer',
      });
      const conversationId = await ctx.db.insert('directConversations', {
        userLowId: actorId,
        userHighId: peerId,
        createdAt: 1,
        updatedAt: 3,
      });
      await ctx.db.insert('directMessages', {
        conversationId,
        senderId: actorId,
        kind: 'text',
        text: 'Earlier note',
        createdAt: 2,
      });
      const latestId = await ctx.db.insert('directMessages', {
        conversationId,
        senderId: peerId,
        kind: 'image',
        createdAt: 3,
      });
      await ctx.db.insert('directMessageReads', {
        messageId: latestId,
        conversationId,
        userId: actorId,
        seenAt: 4,
      });
      return { actorId, peerId };
    });
    const actor = t.withIdentity({ subject: `${fixture.actorId}|session` });

    const conversations = await actor.query(api.directMessages.queries.listConversations, {});

    expect(conversations).toMatchObject([
      {
        userId: fixture.peerId,
        displayName: 'Peer',
        username: 'peer',
        lastMessage: { kind: 'image', text: 'Photo', mine: false, seen: true, createdAt: 3 },
      },
    ]);
  });
  it('toggles one reaction per participant and rejects reactions from outsiders', async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const actorId = await ctx.db.insert('users', { email: 'actor@example.com' });
      const peerId = await ctx.db.insert('users', { email: 'peer@example.com' });
      const outsiderId = await ctx.db.insert('users', { email: 'outsider@example.com' });
      const conversationId = await ctx.db.insert('directConversations', {
        userLowId: actorId,
        userHighId: peerId,
        createdAt: 1,
        updatedAt: 1,
      });
      const messageId = await ctx.db.insert('directMessages', {
        conversationId,
        senderId: actorId,
        kind: 'text',
        text: 'See you soon',
        createdAt: 1,
      });
      return { actorId, peerId, outsiderId, messageId, conversationId };
    });
    const actor = t.withIdentity({ subject: `${fixture.actorId}|session` });
    const peer = t.withIdentity({ subject: `${fixture.peerId}|session` });
    const outsider = t.withIdentity({ subject: `${fixture.outsiderId}|session` });

    expect(
      await actor.mutation(api.directMessages.mutations.toggleReaction, {
        messageId: fixture.messageId,
        emoji: '❤️',
      }),
    ).toEqual({ active: true, emoji: '❤️' });
    expect(
      await actor.mutation(api.directMessages.mutations.toggleReaction, {
        messageId: fixture.messageId,
        emoji: '❤️',
      }),
    ).toEqual({ active: false, emoji: null });
    await peer.mutation(api.directMessages.mutations.toggleReaction, {
      messageId: fixture.messageId,
      emoji: '👍',
    });
    await expect(
      outsider.mutation(api.directMessages.mutations.toggleReaction, {
        messageId: fixture.messageId,
        emoji: '❤️',
      }),
    ).rejects.toThrow('CONVERSATION_UNAVAILABLE');

    const [actorMessages, peerMessages] = await Promise.all([
      actor.query(api.directMessages.queries.messages, {
        conversationId: fixture.conversationId,
      }),
      peer.query(api.directMessages.queries.messages, {
        conversationId: fixture.conversationId,
      }),
    ]);
    expect(actorMessages[0]).toMatchObject({
      text: 'See you soon',
      reactions: [{ emoji: '👍', count: 1 }],
      myReaction: null,
    });
    expect(peerMessages[0]).toMatchObject({
      reactions: [{ emoji: '👍', count: 1 }],
      myReaction: '👍',
    });
  });
});
