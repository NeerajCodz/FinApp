import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { chatHeaderSubtitle, recordTime } from '../../packages/ui/src/chat/model';

const modules = import.meta.glob('../../convex/**/*.ts');

// convex-test stores files without a content type, so the server's audio check can't see one.
// Stub only that lookup (the real validator is unit-tested below via `actualVoice`).
const actualVoice = await vi.importActual<typeof import('../../convex/shared/voice')>(
  '../../convex/shared/voice',
);
vi.mock('../../convex/shared/voice', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../convex/shared/voice')>();
  return {
    ...real,
    validateVoiceMetadata: (metadata: { contentType?: string | null; size: number }) =>
      real.validateVoiceMetadata({
        ...metadata,
        contentType: metadata.contentType ?? 'audio/webm',
      }),
  };
});
const DAY = 86_400_000;

afterEach(() => vi.useRealTimers());

async function seed(messageRetentionMs?: number) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert('users', { email: 'owner@example.com', name: 'Olive' });
    const memberId = await ctx.db.insert('users', { email: 'member@example.com', name: 'Max' });
    const now = Date.now();
    const groupId = await ctx.db.insert('groups', {
      ownerId,
      name: 'Trip',
      currency: 'USD',
      ...(messageRetentionMs === undefined ? {} : { messageRetentionMs }),
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('groupMembers', { groupId, userId: ownerId, role: 'owner', joinedAt: now });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: memberId,
      role: 'member',
      joinedAt: now,
    });
    const [low, high] = [ownerId, memberId].sort();
    const conversationId = await ctx.db.insert('directConversations', {
      userLowId: low!,
      userHighId: high!,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, memberId, groupId, conversationId };
  });
  const as = (id: string) => t.withIdentity({ subject: `${id}|session` });
  return { t, ids, owner: as(ids.ownerId), member: as(ids.memberId) };
}

const clip = (type = 'audio/webm', bytes = 2048) => new Blob([new Uint8Array(bytes)], { type });

describe('voice messages', () => {
  it('validates type, size and length', () => {
    const { validateVoiceMetadata, validVoiceDuration } = actualVoice;
    expect(validateVoiceMetadata({ contentType: 'audio/webm;codecs=opus', size: 10 })).toBe(
      'audio/webm',
    );
    expect(validateVoiceMetadata({ contentType: 'image/png', size: 10 })).toBeNull();
    expect(validateVoiceMetadata({ contentType: undefined, size: 10 })).toBeNull();
    expect(validateVoiceMetadata({ contentType: 'audio/mp4', size: 20 * 1024 * 1024 })).toBeNull();
    expect(validVoiceDuration(300)).toBe(false);
    expect(validVoiceDuration(4_000)).toBe(true);
    expect(validVoiceDuration(6 * 60_000)).toBe(false);
  });

  it('sends a group voice message that follows the group retention and is cleaned up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const { t, ids, member } = await seed(DAY);
    const storageId = await t.run((ctx) => ctx.storage.store(clip()));
    const messageId = await member.mutation(api.groups.mutations.sendVoiceMessage, {
      groupId: ids.groupId,
      storageId,
      durationMs: 4_200,
    });
    const page = await member.query(api.groups.queries.chatMessagesPage, {
      groupId: String(ids.groupId),
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page[0]).toMatchObject({ kind: 'audio', durationMs: 4_200 });
    expect(page.page[0]!.attachmentUrl).toBeTruthy();
    expect((await t.run((ctx) => ctx.db.get(messageId)))?.expiresAt).toBe(Date.now() + DAY);

    vi.setSystemTime(new Date(Date.now() + DAY + 1));
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run((ctx) => ctx.db.get(messageId))).toBeNull();
    expect(await t.run((ctx) => ctx.storage.getUrl(storageId))).toBeNull();
  });

  it('rejects invalid clips and outsiders', async () => {
    const { t, ids, member } = await seed();
    const tooShort = await t.run((ctx) => ctx.storage.store(clip()));
    await expect(
      member.mutation(api.groups.mutations.sendVoiceMessage, {
        groupId: ids.groupId,
        storageId: tooShort,
        durationMs: 100,
      }),
    ).rejects.toThrow('INVALID_VOICE_MESSAGE');
    const outsiderId = await t.run((ctx) => ctx.db.insert('users', { email: 'x@example.com' }));
    const audio = await t.run((ctx) => ctx.storage.store(clip()));
    await expect(
      t
        .withIdentity({ subject: `${outsiderId}|s` })
        .mutation(api.groups.mutations.sendVoiceMessage, {
          groupId: ids.groupId,
          storageId: audio,
          durationMs: 3_000,
        }),
    ).rejects.toThrow('NOT_MEMBER');
  });

  it('sends a direct voice message with an upload ticket', async () => {
    const { t, ids, owner } = await seed();
    const { ticket } = await owner.mutation(api.directMessages.mutations.createImageUpload, {
      conversationId: ids.conversationId,
    });
    const storageId = await t.run((ctx) => ctx.storage.store(clip('audio/mp4')));
    await owner.mutation(api.directMessages.mutations.sendVoice, {
      conversationId: ids.conversationId,
      storageId,
      ticket,
      durationMs: 2_500,
    });
    const list = await owner.query(api.directMessages.queries.listConversations, {});
    expect(list[0]?.lastMessage?.text).toBe('Voice message');
    await expect(
      owner.mutation(api.directMessages.mutations.sendVoice, {
        conversationId: ids.conversationId,
        storageId,
        ticket,
        durationMs: 2_500,
      }),
    ).rejects.toThrow('INVALID_UPLOAD_TICKET');
  });
});

describe('disappearing messages', () => {
  it('re-times a long history in batches when retention is turned on', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const { t, ids, owner } = await seed();
    await t.run(async (ctx) => {
      for (let index = 0; index < 450; index++)
        await ctx.db.insert('groupMessages', {
          groupId: ids.groupId,
          senderId: ids.memberId,
          kind: 'text',
          text: `m${index}`,
          createdAt: Date.now() - (450 - index) * 1000,
        });
    });
    await owner.mutation(api.groups.mutations.updateSettings, {
      groupId: ids.groupId,
      messageRetentionMs: DAY,
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    const messages = await t.run((ctx) =>
      ctx.db
        .query('groupMessages')
        .withIndex('by_group_createdAt', (q) => q.eq('groupId', ids.groupId))
        .collect(),
    );
    expect(messages).toHaveLength(450);
    expect(messages.every((m) => m.expiresAt === m.createdAt + DAY)).toBe(true);
  });

  it('retimes a stale expiry job when retention is lengthened', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const { t, ids, owner } = await seed(DAY);
    const createdAt = Date.now() - DAY - 1;
    const messageId = await t.run((ctx) =>
      ctx.db.insert('groupMessages', {
        groupId: ids.groupId,
        senderId: ids.memberId,
        kind: 'text',
        text: 'keep me',
        createdAt,
        expiresAt: Date.now() - 1,
      }),
    );

    await owner.mutation(api.groups.mutations.updateSettings, {
      groupId: ids.groupId,
      messageRetentionMs: 30 * DAY,
    });
    await t.mutation(internal.groups.mutations.deleteExpiredMessage, { messageId });

    expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({
      text: 'keep me',
      expiresAt: createdAt + 30 * DAY,
    });
  });

  it('clears stale expiry metadata when retention is disabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    const { t, ids, owner } = await seed(DAY);
    const messageId = await t.run((ctx) =>
      ctx.db.insert('groupMessages', {
        groupId: ids.groupId,
        senderId: ids.memberId,
        kind: 'text',
        text: 'keep me',
        createdAt: Date.now() - DAY - 1,
        expiresAt: Date.now() - 1,
      }),
    );

    await owner.mutation(api.groups.mutations.updateSettings, {
      groupId: ids.groupId,
      messageRetentionMs: null,
    });
    await t.mutation(internal.groups.mutations.deleteExpiredMessage, { messageId });

    const message = await t.run((ctx) => ctx.db.get(messageId));
    expect(message).toMatchObject({ text: 'keep me' });
    expect(message?.expiresAt).toBeUndefined();
  });
});

describe('chat helpers', () => {
  it('builds the header line and never dates a record to 1970', () => {
    expect(chatHeaderSubtitle({ mode: 'group', memberCount: 5, onlineCount: 2 })).toBe(
      '2 online · 5 members',
    );
    expect(chatHeaderSubtitle({ mode: 'group', typingNames: ['Maya'], memberCount: 5 })).toBe(
      'Maya is typing',
    );
    expect(chatHeaderSubtitle({ mode: 'direct', peerActive: true })).toBe('Online');
    expect(recordTime({ occurredAt: 0, createdAt: 1_700_000_000_000 })).toBe(1_700_000_000_000);
    expect(recordTime({})).toBeGreaterThan(1_700_000_000_000);
  });
});
