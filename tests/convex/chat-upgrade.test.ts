import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import type { Id } from '../../convex/_generated/dataModel';

const modules = import.meta.glob('../../convex/**/*.ts');
let clock = Date.UTC(2026, 10, 1, 9);
/** Moves the clock forward so every message gets a distinct createdAt. */
const tick = (ms = 1_000) => {
  clock += ms;
  vi.setSystemTime(clock);
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  tick();
});
afterEach(() => vi.useRealTimers());

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const user = (email: string, displayName: string) =>
      ctx.db.insert('users', { email, displayName, emailVerificationTime: now });
    const ownerId = await user('owner@example.com', 'Olive');
    const adminId = await user('admin@example.com', 'Ada');
    const memberId = await user('member@example.com', 'Max');
    const outsiderId = await user('outsider@example.com', 'Otto');
    const groupId = await ctx.db.insert('groups', {
      ownerId,
      name: 'Trip',
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    });
    for (const [userId, role] of [
      [ownerId, 'owner'],
      [adminId, 'admin'],
      [memberId, 'member'],
    ] as const)
      await ctx.db.insert('groupMembers', { groupId, userId, role, joinedAt: now });
    const [low, high] = [ownerId, memberId].sort() as [Id<'users'>, Id<'users'>];
    await ctx.db.insert('friendships', { userLowId: low, userHighId: high, createdAt: now });
    const conversationId = await ctx.db.insert('directConversations', {
      userLowId: low,
      userHighId: high,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, adminId, memberId, outsiderId, groupId, conversationId };
  });
  const as = (id: string) => t.withIdentity({ subject: `${id}|session` });
  return {
    t,
    ids,
    owner: as(ids.ownerId),
    admin: as(ids.adminId),
    member: as(ids.memberId),
    outsider: as(ids.outsiderId),
  };
}

describe('chat pins', () => {
  it('lets either DM participant pin and unpin, lists pins newest first, and blocks outsiders', async () => {
    const { ids, owner, member, outsider } = await fixture();
    const first = await owner.mutation(api.directMessages.mutations.sendText, {
      conversationId: ids.conversationId,
      text: 'flight at 9',
    });
    tick();
    const second = await member.mutation(api.directMessages.mutations.sendText, {
      conversationId: ids.conversationId,
      text: 'hotel booked',
    });
    await member.mutation(api.directMessages.mutations.setPinned, {
      messageId: first,
      pinned: true,
    });
    tick();
    await owner.mutation(api.directMessages.mutations.setPinned, {
      messageId: second,
      pinned: true,
    });
    await expect(
      outsider.mutation(api.directMessages.mutations.setPinned, { messageId: first, pinned: true }),
    ).rejects.toThrow('CONVERSATION_UNAVAILABLE');

    const meta = await owner.query(api.directMessages.queries.conversationMeta, {
      conversationId: ids.conversationId,
    });
    expect(meta?.pinned.map((pin) => [pin.id, pin.text, pin.senderName])).toEqual([
      [second, 'hotel booked', 'Max'],
      [first, 'flight at 9', 'Olive'],
    ]);
    const page = await owner.query(api.directMessages.queries.messagesPage, {
      conversationId: ids.conversationId,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page.every((message) => message.pinnedAt !== null)).toBe(true);

    await owner.mutation(api.directMessages.mutations.setPinned, {
      messageId: first,
      pinned: false,
    });
    expect(
      (
        await member.query(api.directMessages.queries.conversationMeta, {
          conversationId: ids.conversationId,
        })
      )?.pinned.map((pin) => pin.id),
    ).toEqual([second]);
    expect(
      await outsider.query(api.directMessages.queries.conversationMeta, {
        conversationId: ids.conversationId,
      }),
    ).toBeNull();
  });

  it('allows group admins to pin anything and members only their own messages', async () => {
    const { ids, owner, admin, member, outsider } = await fixture();
    const ownerMessage = await owner.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: 'budget is 500',
    });
    tick();
    const memberMessage = await member.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: 'I booked the cab',
    });

    await expect(
      member.mutation(api.groups.mutations.setChatMessagePinned, {
        messageId: ownerMessage,
        pinned: true,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await expect(
      outsider.mutation(api.groups.mutations.setChatMessagePinned, {
        messageId: ownerMessage,
        pinned: true,
      }),
    ).rejects.toThrow('NOT_MEMBER');
    await member.mutation(api.groups.mutations.setChatMessagePinned, {
      messageId: memberMessage,
      pinned: true,
    });
    tick();
    await admin.mutation(api.groups.mutations.setChatMessagePinned, {
      messageId: ownerMessage,
      pinned: true,
    });

    const memberMeta = await member.query(api.groups.queries.chatMeta, { groupId: ids.groupId });
    expect(memberMeta?.canPinAny).toBe(false);
    expect(memberMeta?.pinned.map((pin) => pin.id)).toEqual([ownerMessage, memberMessage]);
    expect(
      (await admin.query(api.groups.queries.chatMeta, { groupId: ids.groupId }))?.canPinAny,
    ).toBe(true);

    await expect(
      member.mutation(api.groups.mutations.setChatMessagePinned, {
        messageId: ownerMessage,
        pinned: false,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await owner.mutation(api.groups.mutations.setChatMessagePinned, {
      messageId: memberMessage,
      pinned: false,
    });
    expect(
      (await owner.query(api.groups.queries.chatMeta, { groupId: ids.groupId }))?.pinned.map(
        (pin) => pin.id,
      ),
    ).toEqual([ownerMessage]);
  });

  it('caps pins per thread', async () => {
    const { ids, owner } = await fixture();
    const messageIds = [];
    for (let index = 0; index < 21; index += 1) {
      tick();
      messageIds.push(
        await owner.mutation(api.groups.mutations.sendChatText, {
          groupId: ids.groupId,
          text: `note ${index}`,
        }),
      );
    }
    for (const messageId of messageIds.slice(0, 20))
      await owner.mutation(api.groups.mutations.setChatMessagePinned, { messageId, pinned: true });
    await expect(
      owner.mutation(api.groups.mutations.setChatMessagePinned, {
        messageId: messageIds[20]!,
        pinned: true,
      }),
    ).rejects.toThrow('PIN_LIMIT_REACHED');
  });
});

describe('read pointers and unread counts', () => {
  it('tracks DM seen state and unread counts with one pointer per reader', async () => {
    const { t, ids, owner, member } = await fixture();
    const sent = [];
    for (const text of ['one', 'two', 'three']) {
      tick();
      sent.push(
        await owner.mutation(api.directMessages.mutations.sendText, {
          conversationId: ids.conversationId,
          text,
        }),
      );
    }
    const listFor = async (who: typeof owner) =>
      (await who.query(api.directMessages.queries.listConversations, {}))[0]!;
    expect((await listFor(member)).unreadCount).toBe(3);
    expect((await listFor(owner)).unreadCount).toBe(0);
    expect((await listFor(owner)).lastMessage?.seen).toBe(false);

    const messages = await member.query(api.directMessages.queries.messages, {
      conversationId: ids.conversationId,
    });
    await member.mutation(api.presence.mutations.markRead, {
      scopeType: 'direct',
      scopeId: ids.conversationId,
      readAt: messages[1]!.createdAt,
    });
    expect((await listFor(member)).unreadCount).toBe(1);
    expect(
      (
        await owner.query(api.directMessages.queries.messages, {
          conversationId: ids.conversationId,
        })
      ).map((message) => message.seen),
    ).toEqual([true, true, false]);

    // Pointers never move backwards.
    await member.mutation(api.presence.mutations.markRead, {
      scopeType: 'direct',
      scopeId: ids.conversationId,
      readAt: 0,
    });
    await member.mutation(api.presence.mutations.markDirectSeen, { messageId: sent[2]! });
    const meta = await owner.query(api.directMessages.queries.conversationMeta, {
      conversationId: ids.conversationId,
    });
    expect(meta?.peerLastReadAt).toBe(messages[2]!.createdAt);
    expect((await listFor(member)).unreadCount).toBe(0);
    expect((await listFor(owner)).lastMessage?.seen).toBe(true);
    const pointerRows = await t.run((ctx) => ctx.db.query('chatReadPointers').collect());
    expect(pointerRows).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query('directMessageReads').collect())).toHaveLength(0);
  });

  it('reports group readers per message, unread per group, and rejects outsiders', async () => {
    const { ids, owner, admin, member, outsider } = await fixture();
    tick();
    await owner.mutation(api.groups.mutations.sendChatText, { groupId: ids.groupId, text: 'a' });
    tick();
    await owner.mutation(api.groups.mutations.sendChatText, { groupId: ids.groupId, text: 'b' });
    expect(await member.query(api.groups.queries.chatUnreadCounts, {})).toEqual({
      [ids.groupId]: 2,
    });
    expect(await owner.query(api.groups.queries.chatUnreadCounts, {})).toEqual({});

    const [first, second] = await owner.query(api.groups.queries.chatMessages, {
      groupId: ids.groupId,
    });
    await admin.mutation(api.presence.mutations.markRead, {
      scopeType: 'group',
      scopeId: ids.groupId,
      readAt: second!.createdAt,
    });
    await member.mutation(api.presence.mutations.markRead, {
      scopeType: 'group',
      scopeId: ids.groupId,
      readAt: first!.createdAt,
    });
    const messages = await owner.query(api.groups.queries.chatMessages, { groupId: ids.groupId });
    expect(messages.map((message) => [...message.seenBy].sort())).toEqual([
      [ids.adminId, ids.memberId].sort(),
      [ids.adminId],
    ]);
    const meta = await member.query(api.groups.queries.chatMeta, { groupId: ids.groupId });
    expect(meta?.unreadCount).toBe(1);
    expect(meta?.readPointers.find((row) => row.userId === ids.adminId)?.lastReadAt).toBe(
      second!.createdAt,
    );
    await expect(
      outsider.mutation(api.presence.mutations.markRead, {
        scopeType: 'group',
        scopeId: ids.groupId,
        readAt: Date.now(),
      }),
    ).rejects.toThrow('NOT_MEMBER');
    expect(await outsider.query(api.groups.queries.chatMeta, { groupId: ids.groupId })).toBeNull();
  });

  it('falls back to legacy per-message receipts until a pointer exists, and backfills them', async () => {
    const { t, ids, owner, member } = await fixture();
    tick();
    const messageId = await owner.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: 'legacy',
    });
    await t.run((ctx) =>
      ctx.db.insert('groupMessageReads', {
        messageId,
        groupId: ids.groupId,
        userId: ids.memberId,
        seenAt: Date.now(),
      }),
    );
    expect(
      (await owner.query(api.groups.queries.chatMessages, { groupId: ids.groupId }))[0]?.seenBy,
    ).toEqual([ids.memberId]);
    expect(await member.query(api.groups.queries.chatUnreadCounts, {})).toEqual({});

    await t.mutation(internal.migrations.backfillChatReadPointers, {
      table: 'groupMessageReads',
      cursor: null,
    });
    const pointer = await t.run((ctx) =>
      ctx.db
        .query('chatReadPointers')
        .withIndex('by_scope_user', (q) =>
          q.eq('scopeType', 'group').eq('scopeId', ids.groupId).eq('userId', ids.memberId),
        )
        .unique(),
    );
    expect(pointer?.lastReadAt).toBeGreaterThan(0);
  });
});

describe('typing indicators', () => {
  it('expires after five seconds and clears when the typist sends', async () => {
    const { ids, owner, member } = await fixture();
    const state = () =>
      owner.query(api.presence.queries.scopeState, {
        scopeType: 'group',
        scopeId: ids.groupId,
      });
    await member.mutation(api.presence.mutations.setTyping, {
      scopeType: 'group',
      scopeId: ids.groupId,
      typing: true,
    });
    const typing = await state();
    expect(typing.typingUserIds).toEqual([ids.memberId]);
    expect(typing.typing[0]!.typingUntil - typing.typing[0]!.updatedAt).toBe(5_000);
    tick(4_000);
    expect((await state()).typingUserIds).toEqual([ids.memberId]);
    tick(1_500);
    expect((await state()).typingUserIds).toEqual([]);

    await member.mutation(api.presence.mutations.setTyping, {
      scopeType: 'group',
      scopeId: ids.groupId,
      typing: true,
    });
    await member.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: 'done typing',
    });
    expect((await state()).typingUserIds).toEqual([]);
  });
});

describe('paginated history', () => {
  it('pages DMs newest first with stable cursors and hides them from outsiders', async () => {
    const { ids, owner, outsider } = await fixture();
    for (let index = 0; index < 5; index += 1) {
      tick();
      await owner.mutation(api.directMessages.mutations.sendText, {
        conversationId: ids.conversationId,
        text: `m${index}`,
      });
    }
    const first = await owner.query(api.directMessages.queries.messagesPage, {
      conversationId: ids.conversationId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(first.page.map((message) => message.text)).toEqual(['m4', 'm3']);
    expect(first.isDone).toBe(false);
    expect(first.page[0]?.senderName).toBe('Olive');
    const second = await owner.query(api.directMessages.queries.messagesPage, {
      conversationId: ids.conversationId,
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    });
    expect(second.page.map((message) => message.text)).toEqual(['m2', 'm1']);
    const last = await owner.query(api.directMessages.queries.messagesPage, {
      conversationId: ids.conversationId,
      paginationOpts: { numItems: 2, cursor: second.continueCursor },
    });
    expect(last.page.map((message) => message.text)).toEqual(['m0']);
    expect(last.isDone).toBe(true);
    expect(
      await outsider.query(api.directMessages.queries.messagesPage, {
        conversationId: ids.conversationId,
        paginationOpts: { numItems: 2, cursor: null },
      }),
    ).toEqual({ page: [], isDone: true, continueCursor: '' });
    expect(
      (
        await owner.query(api.directMessages.queries.messagesPage, {
          conversationId: 'not-an-id',
          paginationOpts: { numItems: 2, cursor: null },
        })
      ).page,
    ).toEqual([]);
  });

  it('pages group chat, carries reactions, and skips expired messages', async () => {
    const { t, ids, owner, member, outsider } = await fixture();
    const sent = [];
    for (let index = 0; index < 3; index += 1) {
      tick();
      sent.push(
        await owner.mutation(api.groups.mutations.sendChatText, {
          groupId: ids.groupId,
          text: `g${index}`,
        }),
      );
    }
    await member.mutation(api.groups.mutations.toggleChatReaction, {
      messageId: sent[2]!,
      emoji: '👍',
    });
    await owner.mutation(api.groups.mutations.toggleChatReaction, {
      messageId: sent[2]!,
      emoji: '👍',
    });
    await t.run((ctx) => ctx.db.patch(sent[0]!, { expiresAt: Date.now() - 1 }));

    const page = await member.query(api.groups.queries.chatMessagesPage, {
      groupId: ids.groupId,
      paginationOpts: { numItems: 2, cursor: null },
    });
    expect(page.page.map((message) => message.text)).toEqual(['g2', 'g1']);
    expect(page.page[0]).toMatchObject({
      reactions: [{ emoji: '👍', count: 2 }],
      myReaction: '👍',
    });
    const rest = await member.query(api.groups.queries.chatMessagesPage, {
      groupId: ids.groupId,
      paginationOpts: { numItems: 2, cursor: page.continueCursor },
    });
    expect(rest.page).toEqual([]);
    expect(
      (
        await outsider.query(api.groups.queries.chatMessagesPage, {
          groupId: ids.groupId,
          paginationOpts: { numItems: 2, cursor: null },
        })
      ).page,
    ).toEqual([]);
    await expect(
      outsider.mutation(api.groups.mutations.toggleChatReaction, {
        messageId: sent[1]!,
        emoji: '❤️',
      }),
    ).rejects.toThrow('NOT_MEMBER');
    // Toggling the same emoji removes it.
    await member.mutation(api.groups.mutations.toggleChatReaction, {
      messageId: sent[2]!,
      emoji: '👍',
    });
    const after = await member.query(api.groups.queries.chatMessagesPage, {
      groupId: ids.groupId,
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(after.page[0]).toMatchObject({
      reactions: [{ emoji: '👍', count: 1 }],
      myReaction: null,
    });
  });
});
