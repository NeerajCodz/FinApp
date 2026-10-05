import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { validateBillImageMetadata } from '../../convex/groups/domain';

const modules = import.meta.glob('../../convex/**/*.ts');
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const verified = { emailVerificationTime: Date.now(), defaultCurrency: 'USD' };
    const firstId = await ctx.db.insert('users', {
      ...verified,
      email: 'first@example.com',
      username: 'first_user',
      displayName: 'First',
    });
    const secondId = await ctx.db.insert('users', {
      ...verified,
      email: 'second@example.com',
      username: 'second_user',
      displayName: 'Second',
    });
    const outsiderId = await ctx.db.insert('users', {
      ...verified,
      email: 'outsider@example.com',
      username: 'outsider',
    });
    const unverifiedId = await ctx.db.insert('users', { email: 'pending@example.com' });
    const groupId = await ctx.db.insert('groups', {
      ownerId: firstId,
      name: 'Group',
      currency: 'USD',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: firstId,
      role: 'owner',
      joinedAt: Date.now(),
    });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: secondId,
      role: 'member',
      joinedAt: Date.now(),
    });
    return { firstId, secondId, outsiderId, unverifiedId, groupId };
  });
  const signedIn = (id: string) => t.withIdentity({ subject: `${id}|session` });
  return {
    t,
    ids,
    first: signedIn(ids.firstId),
    second: signedIn(ids.secondId),
    outsider: signedIn(ids.outsiderId),
    unverified: signedIn(ids.unverifiedId),
  };
}

describe('social and messaging backend', () => {
  it('accepts requests, handles reverse requests, and prevents duplicate friendships and conversations', async () => {
    const { first, second, ids } = await fixture();
    const request = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    expect(request.status).toBe('pending');
    expect(
      await first.mutation(api.social.mutations.sendRequest, { recipientId: ids.secondId }),
    ).toEqual(request);
    const accepted = await second.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.firstId,
    });
    expect(accepted).toEqual({ requestId: request.requestId, status: 'accepted' });
    expect(await first.query(api.social.queries.friends, {})).toMatchObject([
      { id: ids.secondId, username: 'second_user' },
    ]);
    const conversationId = await first.mutation(api.directMessages.mutations.startConversation, {
      userId: ids.secondId,
    });
    expect(
      await second.mutation(api.directMessages.mutations.startConversation, {
        userId: ids.firstId,
      }),
    ).toBe(conversationId);
    await expect(
      first.mutation(api.directMessages.mutations.startConversation, { userId: ids.firstId }),
    ).rejects.toThrow('CANNOT_MESSAGE_SELF');
  });
  it('supports withdrawal and rejection while requiring verified email and keeping profiles public-safe', async () => {
    const { first, second, unverified, ids } = await fixture();
    await expect(
      unverified.mutation(api.social.mutations.sendRequest, { recipientId: ids.secondId }),
    ).rejects.toThrow('VERIFIED_EMAIL_REQUIRED');
    await expect(
      first.mutation(api.social.mutations.sendRequest, { recipientId: ids.unverifiedId }),
    ).rejects.toThrow('VERIFIED_EMAIL_REQUIRED');
    await expect(
      first.mutation(api.social.mutations.sendRequest, { recipientId: ids.firstId }),
    ).rejects.toThrow('CANNOT_FRIEND_SELF');
    const withdrawn = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await first.mutation(api.social.mutations.cancelRequest, { requestId: withdrawn.requestId });
    await expect(
      second.mutation(api.social.mutations.respondToRequest, {
        requestId: withdrawn.requestId,
        response: 'accept',
      }),
    ).rejects.toThrow('REQUEST_UNAVAILABLE');
    const declined = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await second.mutation(api.social.mutations.respondToRequest, {
      requestId: declined.requestId,
      response: 'decline',
    });
    expect(await first.query(api.social.queries.friends, {})).toEqual([]);
    expect(await first.query(api.users.queries.publicProfile, { username: 'second_user' })).toEqual(
      {
        username: 'second_user',
        displayName: 'Second',
        avatarUrl: null,
      },
    );
  });

  it('rejects accepting a request after the requester loses verified-email status', async () => {
    const { t, first, second, ids } = await fixture();
    const request = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await t.run((ctx) => ctx.db.patch(ids.firstId, { emailVerificationTime: undefined }));
    await expect(
      second.mutation(api.social.mutations.respondToRequest, {
        requestId: request.requestId,
        response: 'accept',
      }),
    ).rejects.toThrow('VERIFIED_EMAIL_REQUIRED');
    expect(await second.query(api.social.queries.friends, {})).toEqual([]);
  });

  it('scopes direct image uploads to the conversation participant and ticket owner', async () => {
    const { t, ids, first, second, outsider } = await fixture();
    const request = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await second.mutation(api.social.mutations.respondToRequest, {
      requestId: request.requestId,
      response: 'accept',
    });
    const conversationId = await first.mutation(api.directMessages.mutations.startConversation, {
      userId: ids.secondId,
    });
    const { ticket } = await first.mutation(api.directMessages.mutations.createImageUpload, {
      conversationId,
    });
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: 'image/png' })),
    );
    await expect(
      first.mutation(api.directMessages.mutations.sendImage, {
        conversationId,
        storageId,
        ticket: 'unknown-ticket',
      }),
    ).rejects.toThrow('INVALID_UPLOAD_TICKET');
    await expect(
      second.mutation(api.directMessages.mutations.sendImage, {
        conversationId,
        storageId,
        ticket,
      }),
    ).rejects.toThrow('INVALID_UPLOAD_TICKET');
    await expect(
      outsider.mutation(api.directMessages.mutations.sendImage, {
        conversationId,
        storageId,
        ticket,
      }),
    ).rejects.toThrow('CONVERSATION_UNAVAILABLE');
  });

  it('enforces DM and group boundaries and records participant-only seen state', async () => {
    const { t, ids, first, second, outsider } = await fixture();
    const reqId = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await second.mutation(api.social.mutations.respondToRequest, {
      requestId: reqId.requestId,
      response: 'accept',
    });
    const conversationId = await first.mutation(api.directMessages.mutations.startConversation, {
      userId: ids.secondId,
    });
    const messageId = await first.mutation(api.directMessages.mutations.sendText, {
      conversationId,
      text: 'hello',
    });
    expect(await outsider.query(api.directMessages.queries.messages, { conversationId })).toEqual(
      [],
    );
    await expect(
      outsider.mutation(api.presence.mutations.markDirectSeen, { messageId }),
    ).rejects.toThrow('CONVERSATION_UNAVAILABLE');
    await second.mutation(api.presence.mutations.markDirectSeen, { messageId });
    expect(
      await first.query(api.directMessages.queries.messages, { conversationId }),
    ).toMatchObject([{ id: messageId, seen: true, text: 'hello' }]);
    const groupMessageId = await first.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: 'group message',
    });
    await second.mutation(api.presence.mutations.markGroupSeen, { messageId: groupMessageId });
    expect(
      await first.query(api.groups.queries.chatMessages, { groupId: ids.groupId }),
    ).toMatchObject([{ id: groupMessageId, seenBy: [ids.secondId] }]);
    expect(await outsider.query(api.groups.queries.chatMessages, { groupId: ids.groupId })).toEqual(
      [],
    );
    await expect(
      outsider.mutation(api.presence.mutations.markGroupSeen, { messageId: groupMessageId }),
    ).rejects.toThrow('NOT_MEMBER');
    expect(await t.run((ctx) => ctx.db.query('groupMessageReads').collect())).toHaveLength(1);
  });

  it('expires presence and typing and honors active/last-seen privacy', async () => {
    const { ids, first, second } = await fixture();
    const request = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await second.mutation(api.social.mutations.respondToRequest, {
      requestId: request.requestId,
      response: 'accept',
    });
    const conversationId = await first.mutation(api.directMessages.mutations.startConversation, {
      userId: ids.secondId,
    });
    await second.mutation(api.presence.mutations.heartbeat, {});
    await second.mutation(api.presence.mutations.setTyping, {
      scopeType: 'direct',
      scopeId: conversationId,
      typing: true,
    });
    expect(
      await first.query(api.presence.queries.scopeState, {
        scopeType: 'direct',
        scopeId: conversationId,
      }),
    ).toMatchObject({
      typingUserIds: [ids.secondId],
      participants: [{ userId: ids.secondId, active: true }],
    });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 9_000);
    expect(
      await first.query(api.presence.queries.scopeState, {
        scopeType: 'direct',
        scopeId: conversationId,
      }),
    ).toMatchObject({ typingUserIds: [], participants: [{ userId: ids.secondId, active: true }] });
    vi.setSystemTime(Date.now() + 90_000);
    expect(
      await first.query(api.presence.queries.scopeState, {
        scopeType: 'direct',
        scopeId: conversationId,
      }),
    ).toMatchObject({ typingUserIds: [], participants: [{ userId: ids.secondId, active: false }] });
    await second.mutation(api.presence.mutations.setPrivacy, {
      showActive: false,
      showLastSeen: false,
    });
    expect(
      await first.query(api.presence.queries.scopeState, {
        scopeType: 'direct',
        scopeId: conversationId,
      }),
    ).toMatchObject({
      typingUserIds: [],
      participants: [{ userId: ids.secondId, active: null, lastSeenAt: null }],
    });
    await second.mutation(api.presence.mutations.setTyping, {
      scopeType: 'direct',
      scopeId: conversationId,
      typing: false,
    });
  });

  it('validates supported image formats and size bounds', () => {
    expect(validateBillImageMetadata({ contentType: 'image/webp', size: 1024 })).toBe('image/webp');
    expect(validateBillImageMetadata({ contentType: 'image/gif', size: 1024 })).toBeNull();
    expect(
      validateBillImageMetadata({ contentType: 'image/png', size: 5 * 1024 * 1024 + 1 }),
    ).toBeNull();
    expect(validateBillImageMetadata({ contentType: 'image/jpeg', size: 0 })).toBeNull();
  });
});
