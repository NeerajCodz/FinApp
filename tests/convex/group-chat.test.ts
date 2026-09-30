import { afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { validateBillImageMetadata } from '../../convex/groups/domain';

const modules = import.meta.glob('../../convex/**/*.ts');
const DAY = 86_400_000;

async function seedGroup(messageRetentionMs?: number) {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert('users', { email: 'owner@example.com' });
    const adminId = await ctx.db.insert('users', { email: 'admin@example.com' });
    const memberId = await ctx.db.insert('users', { email: 'member@example.com' });
    const targetId = await ctx.db.insert('users', {
      email: 'target@example.com',
      username: 'target_user',
    });
    const outsiderId = await ctx.db.insert('users', { email: 'outsider@example.com' });
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
    await ctx.db.insert('groupMembers', { groupId, userId: adminId, role: 'admin', joinedAt: now });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: memberId,
      role: 'member',
      joinedAt: now,
    });
    return { ownerId, adminId, memberId, targetId, outsiderId, groupId };
  });
  const identity = (id: string, email: string) =>
    t.withIdentity({ subject: `${id}|session`, email });
  return {
    t,
    fixture,
    owner: identity(fixture.ownerId, 'owner@example.com'),
    admin: identity(fixture.adminId, 'admin@example.com'),
    member: identity(fixture.memberId, 'member@example.com'),
    outsider: identity(fixture.outsiderId, 'outsider@example.com'),
  };
}

afterEach(() => vi.useRealTimers());

describe('group collaboration permissions', () => {
  it('limits member additions and removals to admins', async () => {
    const { t, fixture, admin, member } = await seedGroup();

    await expect(
      member.mutation(api.groups.mutations.addMember, {
        groupId: fixture.groupId,
        username: 'target_user',
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await expect(
      member.mutation(api.groups.mutations.removeMember, {
        groupId: fixture.groupId,
        memberUserId: fixture.targetId,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');

    const addedMemberId = await admin.mutation(api.groups.mutations.addMember, {
      groupId: fixture.groupId,
      username: 'target_user',
    });
    expect(addedMemberId).toBeTruthy();
    await admin.mutation(api.groups.mutations.removeMember, {
      groupId: fixture.groupId,
      memberUserId: fixture.targetId,
    });
    const membership = await t.run((ctx) =>
      ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (index) =>
          index.eq('groupId', fixture.groupId).eq('userId', fixture.targetId),
        )
        .unique(),
    );
    expect(membership).toBeNull();
  });
});

describe('bill image metadata', () => {
  it('accepts only supported image media within the 5 MiB boundary', () => {
    const limit = 5 * 1024 * 1024;
    expect(
      validateBillImageMetadata({ contentType: ' IMAGE/JPEG ; charset=binary', size: limit }),
    ).toBe('image/jpeg');
    expect(validateBillImageMetadata({ contentType: 'image/png', size: limit + 1 })).toBeNull();
    expect(validateBillImageMetadata({ contentType: 'image/gif', size: 100 })).toBeNull();
    expect(validateBillImageMetadata({ contentType: 'image/webp', size: 0 })).toBeNull();
  });
});

describe('group chat retention', () => {
  it('hides expired messages and deletes message rows at their expiry', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    vi.setSystemTime(startedAt);
    const { t, fixture, member, outsider } = await seedGroup(DAY);
    const messageId = await member.mutation(api.groups.mutations.sendChatText, {
      groupId: fixture.groupId,
      text: '  Taxi receipt  ',
    });

    expect(
      await outsider.query(api.groups.queries.chatMessages, { groupId: fixture.groupId }),
    ).toEqual([]);
    await expect(
      outsider.mutation(api.groups.mutations.sendChatText, {
        groupId: fixture.groupId,
        text: 'Not a member',
      }),
    ).rejects.toThrow('NOT_MEMBER');
    await expect(
      outsider.mutation(api.groups.mutations.createChatUploadUrl, {
        groupId: fixture.groupId,
      }),
    ).rejects.toThrow('NOT_MEMBER');
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: 'image/jpeg' })),
    );
    await expect(
      outsider.mutation(api.groups.mutations.sendBillAttachment, {
        groupId: fixture.groupId,
        storageId,
      }),
    ).rejects.toThrow('NOT_MEMBER');
    expect(
      await member.query(api.groups.queries.chatMessages, { groupId: fixture.groupId }),
    ).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get(messageId))).toMatchObject({
      text: 'Taxi receipt',
      expiresAt: startedAt.getTime() + DAY,
    });

    vi.setSystemTime(new Date(startedAt.getTime() + DAY + 1));
    expect(
      await member.query(api.groups.queries.chatMessages, { groupId: fixture.groupId }),
    ).toEqual([]);
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(await t.run((ctx) => ctx.db.get(messageId))).toBeNull();
  });

  it('does not delete messages after an admin disables retention', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-02-01T00:00:00.000Z');
    vi.setSystemTime(startedAt);
    const { t, fixture, admin, member } = await seedGroup(DAY);
    const messageId = await member.mutation(api.groups.mutations.sendChatText, {
      groupId: fixture.groupId,
      text: 'Keep this message',
    });
    await admin.mutation(api.groups.mutations.updateSettings, {
      groupId: fixture.groupId,
      messageRetentionMs: null,
    });

    vi.setSystemTime(new Date(startedAt.getTime() + DAY + 1));
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const message = await t.run((ctx) => ctx.db.get(messageId));
    expect(message?.text).toBe('Keep this message');
    expect(message?.expiresAt).toBeUndefined();
  });

  it('omits unset optional fields from bill message results', async () => {
    const { t, fixture, member } = await seedGroup();
    await t.run((ctx) =>
      ctx.db.insert('groupMessages', {
        groupId: fixture.groupId,
        senderId: fixture.memberId,
        kind: 'bill',
        mimeType: 'image/jpeg',
        size: 1,
        createdAt: Date.now(),
      }),
    );

    const messages = await member.query(api.groups.queries.chatMessages, {
      groupId: fixture.groupId,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      kind: 'bill',
      senderName: 'Member',
      attachmentUrl: null,
      mimeType: 'image/jpeg',
      size: 1,
    });
    expect(messages[0]).not.toHaveProperty('text');
  });

  it('returns no messages for unauthenticated or archived-group queries', async () => {
    const { t, fixture, member } = await seedGroup();
    expect(
      await t.query(api.groups.queries.chatMessages, {
        groupId: fixture.groupId,
      }),
    ).toEqual([]);
    await t.run(async (ctx) => {
      await ctx.db.patch(fixture.groupId, { archivedAt: Date.now() });
    });
    expect(
      await member.query(api.groups.queries.chatMessages, {
        groupId: fixture.groupId,
      }),
    ).toEqual([]);
  });
});
