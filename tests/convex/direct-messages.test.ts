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
});
