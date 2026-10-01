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
      emailVerificationTime: 1,
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
    target: identity(fixture.targetId, 'target@example.com'),
    outsider: identity(fixture.outsiderId, 'outsider@example.com'),
  };
}

afterEach(() => vi.useRealTimers());

describe('group collaboration permissions', () => {
  it('limits member additions and removals to admins', async () => {
    const { t, fixture, admin, member, target, outsider } = await seedGroup();

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

    const inviteResult = await admin.mutation(api.groups.mutations.addMember, {
      groupId: fixture.groupId,
      username: 'target_user',
    });
    expect(inviteResult).toBeNull();
    expect(
      await admin.mutation(api.groups.mutations.addMember, {
        groupId: fixture.groupId,
        username: 'target_user',
      }),
    ).toBeNull();
    const inviteeInvitations = await target.query(api.groups.queries.incomingInvitations, {});
    expect(inviteeInvitations).toMatchObject([
      { groupId: fixture.groupId, groupName: 'Trip', currency: 'USD' },
    ]);
    expect(await t.run((ctx) => ctx.db.query('groupInvites').collect())).toHaveLength(1);
    const invitationNotification = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_eventKey', (index) =>
          index
            .eq('recipientId', fixture.targetId)
            .eq('eventKey', `group-invitation:${inviteeInvitations[0]!.id}`),
        )
        .unique(),
    );
    expect(invitationNotification).not.toBeNull();
    await expect(
      target.mutation(api.groups.mutations.createChatUploadUrl, {
        groupId: fixture.groupId,
      }),
    ).rejects.toThrow('NOT_MEMBER');
    expect(await target.query(api.groups.queries.detail, { groupId: fixture.groupId })).toBeNull();
    expect(await target.query(api.groups.queries.list, {})).toEqual([]);
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('groupMembers')
          .withIndex('by_group_user', (index) =>
            index.eq('groupId', fixture.groupId).eq('userId', fixture.targetId),
          )
          .unique(),
      ),
    ).toBeNull();
    const inviteId = inviteeInvitations[0]!.id;
    await expect(
      outsider.mutation(api.groups.mutations.respondToInvitation, {
        inviteId,
        response: 'accept',
      }),
    ).rejects.toThrow('INVITATION_NOT_FOUND');
    const acceptedGroupId = await target.mutation(api.groups.mutations.respondToInvitation, {
      inviteId,
      response: 'accept',
    });
    expect(acceptedGroupId).toBe(fixture.groupId);
    expect(
      await target.mutation(api.groups.mutations.respondToInvitation, {
        inviteId,
        response: 'accept',
      }),
    ).toBe(fixture.groupId);
    expect(
      await target.query(api.groups.queries.detail, { groupId: fixture.groupId }),
    ).not.toBeNull();
    expect(await target.query(api.groups.queries.list, {})).toMatchObject([
      { _id: fixture.groupId, name: 'Trip', currency: 'USD' },
    ]);
    const accountId = await target.mutation(api.accounts.mutations.create, {
      name: 'Shared group account',
      type: 'cash',
      currency: 'USD',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    const expenseId = await target.mutation(api.groups.mutations.addExpense, {
      groupId: fixture.groupId,
      accountId,
      title: 'Shared lunch',
      amountMinor: 1000n,
      currency: 'USD',
      occurredAt: Date.now(),
      participants: [
        { userId: fixture.targetId, amountMinor: 500n, method: 'equal' },
        { userId: fixture.ownerId, amountMinor: 500n, method: 'equal' },
      ],
    });
    const uploadUrl = await target.mutation(api.groups.mutations.createChatUploadUrl, {
      groupId: fixture.groupId,
    });
    expect(uploadUrl).toEqual(expect.any(String));
    const settlementId = await target.mutation(api.settlements.mutations.create, {
      groupId: fixture.groupId,
      fromUserId: fixture.ownerId,
      toUserId: fixture.targetId,
      accountId,
      amountMinor: 500n,
      currency: 'USD',
      occurredAt: Date.now(),
      clientMutationId: 'accepted-invite-settlement',
    });
    expect(
      await target.query(api.groups.queries.detail, { groupId: fixture.groupId }),
    ).toMatchObject({
      expenses: [{ _id: expenseId, title: 'Shared lunch', amountMinor: 1000n }],
    });
    await target.mutation(api.groups.mutations.sendChatText, {
      groupId: fixture.groupId,
      text: 'Accepted members can chat',
    });
    const messages = await target.query(api.groups.queries.chatMessages, {
      groupId: fixture.groupId,
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      text: 'Accepted members can chat',
      senderId: fixture.targetId,
    });
    expect(await t.run((ctx) => ctx.db.get(settlementId))).toMatchObject({
      fromUserId: fixture.ownerId,
      toUserId: fixture.targetId,
      amountMinor: 500n,
    });
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
    const responseNotification = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_eventKey', (index) =>
          index
            .eq('recipientId', fixture.adminId)
            .eq('eventKey', `group-invitation:${inviteId}:accepted`),
        )
        .unique(),
    );
    expect(responseNotification).not.toBeNull();
    await admin.mutation(api.groups.mutations.addMember, {
      groupId: fixture.groupId,
      username: 'target_user',
    });
    const secondInvite = await target.query(api.groups.queries.incomingInvitations, {});
    const declinedGroup = await target.mutation(api.groups.mutations.respondToInvitation, {
      inviteId: secondInvite[0]!.id,
      response: 'decline',
    });
    expect(declinedGroup).toBeNull();
    expect(await target.query(api.groups.queries.detail, { groupId: fixture.groupId })).toBeNull();
    const declineNotification = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_eventKey', (index) =>
          index
            .eq('recipientId', fixture.adminId)
            .eq('eventKey', `group-invitation:${secondInvite[0]!.id}:declined`),
        )
        .unique(),
    );
    expect(declineNotification).not.toBeNull();
  });

  it('restricts metadata updates to admins and syncs changes to all active members', async () => {
    const { t, fixture, admin, member } = await seedGroup();
    await expect(
      member.mutation(api.groups.mutations.updateSettings, {
        groupId: fixture.groupId,
        name: 'Changed trip',
        icon: 'lucide:Users',
        color: '#123456',
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await admin.mutation(api.groups.mutations.updateSettings, {
      groupId: fixture.groupId,
      name: 'Changed trip',
      icon: 'lucide:Users',
      color: '#123456',
    });
    const scopes = [fixture.ownerId, fixture.adminId, fixture.memberId];
    const syncedGroupRecords = await Promise.all(
      scopes.map((scopeUserId) =>
        t.run(async (ctx) => {
          const changes = await ctx.db
            .query('syncChanges')
            .withIndex('by_user_entity_updatedAt', (index) =>
              index.eq('scopeUserId', scopeUserId).eq('entityType', 'groups'),
            )
            .collect();
          return changes
            .filter((change) => change.documentId === String(fixture.groupId))
            .sort((left, right) => (right.revision > left.revision ? 1 : -1))[0]?.document;
        }),
      ),
    );
    expect(syncedGroupRecords).toEqual(
      scopes.map(() =>
        expect.objectContaining({
          name: 'Changed trip',
          icon: 'lucide:Users',
          color: '#123456',
        }),
      ),
    );
  });
  it('lets admins rotate, revoke, preview, and securely join by expiring invitation links', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const { t, fixture, admin, member, outsider, target } = await seedGroup();
    await expect(
      member.mutation(api.groups.mutations.createInvitationLink, {
        groupId: fixture.groupId,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    const link = await admin.mutation(api.groups.mutations.createInvitationLink, {
      groupId: fixture.groupId,
    });
    const preview = await outsider.query(api.groups.queries.previewInvitationLink, {
      token: link.token,
    });
    expect(preview).toEqual({
      groupId: fixture.groupId,
      groupName: 'Trip',
      currency: 'USD',
    });
    expect(
      await outsider.query(api.groups.queries.previewInvitationLink, { token: 'bad' }),
    ).toBeNull();
    expect(await t.query(api.groups.queries.previewInvitationLink, { token: link.token })).toEqual({
      groupId: fixture.groupId,
      groupName: 'Trip',
      currency: 'USD',
    });
    const storedLinks = await t.run((ctx) => ctx.db.query('groupInvitationLinks').collect());
    expect(storedLinks).toHaveLength(1);
    expect(storedLinks[0]!.tokenHash).not.toBe(link.token);
    expect(
      await outsider.query(api.groups.queries.detail, { groupId: fixture.groupId }),
    ).toBeNull();
    expect(
      await outsider.mutation(api.groups.mutations.joinByInvitationLink, { token: link.token }),
    ).toBe(fixture.groupId);
    expect(
      await outsider.query(api.groups.queries.detail, { groupId: fixture.groupId }),
    ).not.toBeNull();
    const revokedLink = await admin.mutation(api.groups.mutations.createInvitationLink, {
      groupId: fixture.groupId,
    });
    await expect(
      member.mutation(api.groups.mutations.revokeInvitationLink, {
        groupId: fixture.groupId,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await admin.mutation(api.groups.mutations.revokeInvitationLink, {
      groupId: fixture.groupId,
    });
    expect(
      await target.mutation(api.groups.mutations.joinByInvitationLink, {
        token: revokedLink.token,
      }),
    ).toBeNull();
    expect(
      await target.query(api.groups.queries.previewInvitationLink, { token: revokedLink.token }),
    ).toBeNull();
    const expiringLink = await admin.mutation(api.groups.mutations.createInvitationLink, {
      groupId: fixture.groupId,
    });
    vi.advanceTimersByTime(7 * DAY + 1);
    expect(
      await target.query(api.groups.queries.previewInvitationLink, { token: expiringLink.token }),
    ).toBeNull();
    expect(
      await target.mutation(api.groups.mutations.joinByInvitationLink, {
        token: expiringLink.token,
      }),
    ).toBeNull();
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
