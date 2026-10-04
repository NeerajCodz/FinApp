import { internal } from '../_generated/api';
import { internalMutation, mutation, type MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { v } from 'convex/values';
import { requireIdentity, requireUser } from '../shared/auth';
import { requireAdmin, requireMember, type Membership } from '../shared/permissions';
import { changeMemberRole, createGroup, type Group, validateBillImageMetadata } from './domain';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { allocateParticipants } from '../splits/domain';
import { assertCurrency } from '../shared/validators';
import { assertClientId, assertClientIdAvailable } from '../shared/clientId';

type InviteTarget = {
  userId?: Id<'users'>;
  username?: string;
  email?: string;
  phone?: string;
};

async function createPendingInvite(
  ctx: MutationCtx,
  groupId: Id<'groups'>,
  inviterId: Id<'users'>,
  target: InviteTarget,
  now: number,
) {
  const invites = await ctx.db
    .query('groupInvites')
    .withIndex('by_group', (query) => query.eq('groupId', groupId))
    .collect();
  const existing = invites.find(
    (invite) =>
      invite.status === 'pending' &&
      (target.userId !== undefined
        ? invite.inviteeUserId === target.userId ||
          (target.username !== undefined && invite.inviteeUsername === target.username) ||
          (target.email !== undefined && invite.inviteeEmail === target.email) ||
          (target.phone !== undefined && invite.inviteePhone === target.phone)
        : (target.username !== undefined && invite.inviteeUsername === target.username) ||
          (target.email !== undefined && invite.inviteeEmail === target.email) ||
          (target.phone !== undefined && invite.inviteePhone === target.phone)),
  );
  const inviteId =
    existing?._id ??
    (await ctx.db.insert('groupInvites', {
      groupId,
      inviterId,
      inviteeEmail: target.email ?? '',
      ...(target.username === undefined ? {} : { inviteeUsername: target.username }),
      ...(target.phone === undefined ? {} : { inviteePhone: target.phone }),
      ...(target.userId === undefined ? {} : { inviteeUserId: target.userId }),
      status: 'pending',
      createdAt: now,
    }));
  const invite = await ctx.db.get(inviteId);
  await recordSyncChange(ctx, inviterId, 'groupInvites', String(inviteId), now, invite);
  if (target.userId)
    await recordSyncChange(ctx, target.userId, 'groupInvites', String(inviteId), now, invite);
  if (target.userId) {
    const group = await ctx.db.get(groupId);
    await createNotification(
      ctx,
      target.userId,
      `group-invitation:${inviteId}`,
      'group',
      'groupInvitation',
      String(inviteId),
      `Invitation to ${group?.name ?? 'a group'}`,
      `${(await ctx.db.get(inviterId))?.displayName ?? 'Someone'} invited you to join a group.`,
    );
  }
  return inviteId;
}

const CHAT_RETENTION_OPTIONS: Record<number, true> = {
  86_400_000: true,
  604_800_000: true,
  2_592_000_000: true,
};
const CHAT_TEXT_LIMIT = 4_000;

function validateGroupIcon(icon: string | undefined) {
  if (icon === undefined) return;
  if (
    icon.startsWith('lucide:')
      ? !/^lucide:[A-Z][A-Za-z0-9]*$/.test(icon)
      : icon.startsWith('phosphor:')
        ? !/^phosphor:[A-Z][A-Za-z0-9]*$/.test(icon)
        : !icon.trim() || icon.length > 16 || /[\u0000-\u001f]/.test(icon)
  )
    throw new Error('INVALID_GROUP_ICON');
}

function validateGroupMetadata(fields: {
  description?: string | null;
  startAt?: number | null;
  endAt?: number | null;
}) {
  if (
    (fields.description !== undefined &&
      fields.description !== null &&
      fields.description.length > 200) ||
    (fields.startAt !== undefined && fields.startAt !== null && !Number.isFinite(fields.startAt)) ||
    (fields.endAt !== undefined && fields.endAt !== null && !Number.isFinite(fields.endAt))
  )
    throw new Error('INVALID_GROUP');
}

export function createGroupRecord(ownerId: string, name: string, currency: string): Group {
  return createGroup(ownerId, name, currency);
}

export function inviteGroupMember(
  actorId: string,
  group: Group,
  members: readonly Membership[],
  email: string,
): { groupId: string; email: string } {
  requireAdmin(actorId, group.ownerId, members);
  if (!email.includes('@')) throw new Error('INVALID_EMAIL');
  return { groupId: group.id, email: email.trim().toLowerCase() };
}

export function leaveGroup(actorId: string, members: readonly Membership[]): Membership[] {
  requireMember(actorId, members);
  return members.filter((member) => member.userId !== actorId);
}

export { changeMemberRole };

export const create = mutation({
  args: {
    name: v.string(),
    currency: v.string(),
    memberUsernames: v.array(v.string()),
    clientMutationId: v.optional(v.string()),
    clientId: v.optional(v.string()),
    memberPhones: v.optional(v.array(v.string())),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    groupType: v.optional(v.string()),
    purpose: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.optional(v.number()),
    endAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    assertClientId(args.clientId);
    const owner = await requireUser(ctx);
    if (!owner) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      owner._id,
      args.clientMutationId,
      'group.create',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('groups', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    await assertClientIdAvailable(args.clientId, () =>
      ctx.db
        .query('groups')
        .withIndex('by_clientId', (query) => query.eq('clientId', args.clientId!))
        .unique(),
    );
    if ((args.memberPhones?.length ?? 0) > 0 && owner.phoneVerificationTime === undefined)
      throw new Error('PHONE_UNVERIFIED');
    const currency = args.currency.toUpperCase();
    assertCurrency(currency);
    const name = args.name.trim();
    validateGroupIcon(args.icon);
    validateGroupMetadata(args);
    if (args.color !== undefined && !/^#[\da-f]{6}$/i.test(args.color))
      throw new Error('INVALID_GROUP_COLOR');
    if (!name) throw new Error('INVALID_GROUP');
    const now = Date.now();
    const groupId = await ctx.db.insert('groups', {
      ownerId: owner._id,
      clientId: args.clientId,
      name,
      currency,
      ...(args.icon === undefined ? {} : { icon: args.icon }),
      ...(args.color === undefined ? {} : { color: args.color }),
      description: args.description,
      groupType: args.groupType,
      purpose: args.purpose,
      location: args.location,
      startAt: args.startAt,
      endAt: args.endAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: owner._id,
      role: 'owner',
      joinedAt: now,
    });

    const ownerUsername = owner.username?.replace(/^@+/, '').trim().toLowerCase();
    const usernames = [
      ...new Set(
        args.memberUsernames.map((value) => value.replace(/^@+/, '').trim().toLowerCase()),
      ),
    ].filter((value) => value.length > 0 && value !== ownerUsername);
    for (const username of usernames) {
      const target = await ctx.db
        .query('users')
        .withIndex('by_username', (query) => query.eq('username', username))
        .unique();
      if (
        target &&
        (await ctx.db
          .query('groupMembers')
          .withIndex('by_group_user', (query) =>
            query.eq('groupId', groupId).eq('userId', target._id),
          )
          .unique())
      )
        continue;
      await createPendingInvite(
        ctx,
        groupId,
        owner._id,
        {
          username,
          ...(target
            ? {
                userId: target._id,
                ...(target.email === undefined ? {} : { email: target.email }),
                ...(target.phone === undefined
                  ? {}
                  : { phone: target.phone.replace(/[\s().-]/g, '') }),
              }
            : {}),
        },
        now,
      );
    }
    for (const phone of args.memberPhones ?? []) {
      const normalizedPhone = phone.replace(/[\s().-]/g, '');
      const ownerPhone = owner.phone?.replace(/[\s().-]/g, '');
      if (!normalizedPhone || normalizedPhone === ownerPhone) continue;
      const target = await ctx.db
        .query('users')
        .withIndex('by_phone', (query) => query.eq('phone', normalizedPhone))
        .unique();
      if (
        target &&
        (await ctx.db
          .query('groupMembers')
          .withIndex('by_group_user', (query) =>
            query.eq('groupId', groupId).eq('userId', target._id),
          )
          .unique())
      )
        continue;
      await createPendingInvite(
        ctx,
        groupId,
        owner._id,
        {
          phone: normalizedPhone,
          ...(target
            ? {
                userId: target._id,
                ...(target.username === undefined ? {} : { username: target.username }),
                ...(target.email === undefined ? {} : { email: target.email }),
              }
            : {}),
        },
        now,
      );
    }
    const [group, memberships] = await Promise.all([
      ctx.db.get(groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', groupId))
        .collect(),
    ]);
    const scopes = memberships.map((membership) => membership.userId);
    await publishMutationResult(
      ctx,
      owner._id,
      args.clientMutationId,
      'group.create',
      groupId,
      'groups',
      String(groupId),
      now,
      group,
      scopes,
    );
    for (const scopeUserId of scopes) {
      for (const member of memberships)
        await recordSyncChange(ctx, scopeUserId, 'groupMembers', String(member._id), now, member);
    }
    for (const member of memberships) {
      if (member.userId !== owner._id)
        await createNotification(
          ctx,
          member.userId,
          `group:${groupId}:joined`,
          'group',
          'group',
          String(groupId),
          `Added to ${name}`,
          'A new shared group is ready.',
        );
    }
    return groupId;
  },
});

export const updateSettings = mutation({
  args: {
    groupId: v.id('groups'),
    name: v.optional(v.string()),
    icon: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.string()),
    messageRetentionMs: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.union(v.string(), v.null())),
    groupType: v.optional(v.union(v.string(), v.null())),
    purpose: v.optional(v.union(v.string(), v.null())),
    location: v.optional(v.union(v.string(), v.null())),
    startAt: v.optional(v.union(v.number(), v.null())),
    endAt: v.optional(v.union(v.number(), v.null())),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'group.update',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('groups', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const [group, memberships] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
        .collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const roles: Membership[] = memberships.map((member) => ({
      userId: String(member.userId),
      role: member.role,
    }));
    requireAdmin(actor._id, String(group.ownerId), roles);
    if (args.name !== undefined && !args.name.trim()) throw new Error('INVALID_GROUP');
    validateGroupMetadata(args);
    if (args.icon !== undefined && args.icon !== null) validateGroupIcon(args.icon);
    if (args.color !== undefined && !/^#[\da-f]{6}$/i.test(args.color))
      throw new Error('INVALID_GROUP_COLOR');
    if (
      args.messageRetentionMs !== undefined &&
      args.messageRetentionMs !== null &&
      !CHAT_RETENTION_OPTIONS[args.messageRetentionMs]
    )
      throw new Error('INVALID_MESSAGE_RETENTION');

    const updatedAt = Date.now();
    const patch = {
      ...(args.name === undefined ? {} : { name: args.name.trim() }),
      ...(args.icon === undefined ? {} : { icon: args.icon ?? undefined }),
      ...(args.color === undefined ? {} : { color: args.color }),
      ...(args.description === undefined ? {} : { description: args.description ?? undefined }),
      ...(args.groupType === undefined ? {} : { groupType: args.groupType ?? undefined }),
      ...(args.purpose === undefined ? {} : { purpose: args.purpose ?? undefined }),
      ...(args.location === undefined ? {} : { location: args.location ?? undefined }),
      ...(args.startAt === undefined ? {} : { startAt: args.startAt ?? undefined }),
      ...(args.endAt === undefined ? {} : { endAt: args.endAt ?? undefined }),
      ...(args.messageRetentionMs === undefined
        ? {}
        : { messageRetentionMs: args.messageRetentionMs ?? undefined }),
      updatedAt,
    };
    await ctx.db.patch(args.groupId, patch);

    if (args.messageRetentionMs !== undefined) {
      const messages = await ctx.db
        .query('groupMessages')
        .withIndex('by_group_createdAt', (query) => query.eq('groupId', args.groupId))
        .collect();
      for (const message of messages) {
        const expiresAt =
          args.messageRetentionMs === null
            ? undefined
            : message.createdAt + args.messageRetentionMs;
        await ctx.db.patch(message._id, { expiresAt });
        if (expiresAt !== undefined)
          await ctx.scheduler.runAt(
            Math.max(Date.now(), expiresAt),
            internal.groups.mutations.deleteExpiredMessage,
            { messageId: message._id },
          );
      }
    }
    const updated = (await ctx.db.get(args.groupId)) ?? group;
    await publishMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'group.update',
      args.groupId,
      'groups',
      String(args.groupId),
      updatedAt,
      updated,
      memberships.map((member) => member.userId),
    );
    return args.groupId;
  },
});

export const setMemberRole = mutation({
  args: {
    groupId: v.id('groups'),
    memberUserId: v.id('users'),
    role: v.union(v.literal('admin'), v.literal('member')),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'group.setMemberRole',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('groupMembers', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    const [group, memberships] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
        .collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const roles: Membership[] = memberships.map((member) => ({
      userId: String(member.userId),
      role: member.role,
    }));
    changeMemberRole(
      actor._id,
      {
        id: String(group._id),
        ownerId: String(group.ownerId),
        name: group.name,
        currency: group.currency,
        archivedAt: group.archivedAt,
      },
      roles,
      String(args.memberUserId),
      args.role,
    );
    const target = memberships.find(
      (member) => String(member.userId) === String(args.memberUserId),
    );
    if (!target) throw new Error('NOT_MEMBER');
    const updatedAt = Date.now();
    await ctx.db.patch(target._id, { role: args.role });
    const document = { ...target, role: args.role };
    await publishMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'group.setMemberRole',
      target._id,
      'groupMembers',
      String(target._id),
      updatedAt,
      document,
      memberships.map((member) => member.userId),
    );
    return target._id;
  },
});
export const addMember = mutation({
  args: { groupId: v.id('groups'), username: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
      .collect();
    requireAdmin(
      actor._id,
      String(group.ownerId),
      memberships.map((member) => ({ userId: String(member.userId), role: member.role })),
    );
    const username = args.username.replace(/^@+/, '').trim().toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/.test(username)) throw new Error('INVALID_USERNAME');
    if (username === actor.username) throw new Error('SELF_INVITE');
    const target = await ctx.db
      .query('users')
      .withIndex('by_username', (query) => query.eq('username', username))
      .unique();
    if (target && memberships.some((member) => member.userId === target._id))
      throw new Error('ALREADY_MEMBER');
    await createPendingInvite(
      ctx,
      args.groupId,
      actor._id,
      {
        username,
        ...(target
          ? {
              userId: target._id,
              ...(target.email === undefined ? {} : { email: target.email }),
              ...(target.phone === undefined
                ? {}
                : { phone: target.phone.replace(/[\s().-]/g, '') }),
            }
          : {}),
      },
      Date.now(),
    );
    return null;
  },
});

export const respondToInvitation = mutation({
  args: {
    inviteId: v.id('groupInvites'),
    response: v.union(v.literal('accept'), v.literal('decline')),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) return null;
    const username = user.username?.replace(/^@+/, '').trim().toLowerCase();
    const email = user.email?.trim().toLowerCase();
    const phone = user.phone?.replace(/[\s().-]/g, '');
    const invitationUsername = invite.inviteeUsername?.replace(/^@+/, '').trim().toLowerCase();
    const invitationEmail = invite.inviteeEmail.trim().toLowerCase();
    const invitationPhone = invite.inviteePhone?.replace(/[\s().-]/g, '');
    const isRecipient =
      invite.inviteeUserId === user._id ||
      (username !== undefined && invitationUsername === username) ||
      (email !== undefined && invitationEmail === email) ||
      (phone !== undefined && invitationPhone === phone);
    if (!isRecipient) throw new Error('INVITATION_NOT_FOUND');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'group.respondToInvitation',
    );
    if (replay.found) {
      if (replay.result === null) return null;
      const previousGroupId = ctx.db.normalizeId('groups', String(replay.result));
      return previousGroupId ?? null;
    }
    if (invite.status !== 'pending')
      return invite.status === 'accepted' && args.response === 'accept' ? invite.groupId : null;
    const group = await ctx.db.get(invite.groupId);
    if (!group || group.archivedAt !== undefined) return null;
    const now = Date.now();
    if (args.response === 'decline') {
      await ctx.db.patch(invite._id, { status: 'declined' });
      const declined = await ctx.db.get(invite._id);
      await recordSyncChange(
        ctx,
        invite.inviterId,
        'groupInvites',
        String(invite._id),
        now,
        declined,
      );
      await recordSyncChange(ctx, user._id, 'groupInvites', String(invite._id), now, declined);
      await createNotification(
        ctx,
        invite.inviterId,
        `group-invitation:${invite._id}:declined`,
        'group',
        'group',
        String(group._id),
        `${user.displayName ?? user.name ?? 'A user'} declined your invitation`,
        `Your invitation to ${group.name} was declined.`,
      );
      await publishMutationResult(
        ctx,
        user._id,
        args.clientMutationId,
        'group.respondToInvitation',
        null,
        'groupInvites',
        String(invite._id),
        now,
        declined,
        [invite.inviterId],
      );
      return null;
    }
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', group._id))
      .collect();
    let membership = memberships.find((member) => member.userId === user._id);
    if (!membership) {
      const membershipId = await ctx.db.insert('groupMembers', {
        groupId: group._id,
        userId: user._id,
        role: 'member',
        joinedAt: now,
      });
      membership = (await ctx.db.get(membershipId)) ?? undefined;
    }
    await ctx.db.patch(invite._id, { status: 'accepted' });
    await ctx.db.patch(group._id, { updatedAt: now });
    const [acceptedInvite, updatedGroup] = await Promise.all([
      ctx.db.get(invite._id),
      ctx.db.get(group._id),
    ]);
    const scopes = [...new Set([...memberships.map((member) => member.userId), user._id])];
    if (membership) {
      for (const scopeUserId of scopes)
        await recordSyncChange(
          ctx,
          scopeUserId,
          'groupMembers',
          String(membership._id),
          now,
          membership,
        );
    }
    for (const scopeUserId of scopes)
      await recordSyncChange(ctx, scopeUserId, 'groups', String(group._id), now, updatedGroup);
    for (const scopeUserId of [user._id, invite.inviterId])
      await recordSyncChange(
        ctx,
        scopeUserId,
        'groupInvites',
        String(invite._id),
        now,
        acceptedInvite,
      );
    await createNotification(
      ctx,
      invite.inviterId,
      `group-invitation:${invite._id}:accepted`,
      'group',
      'group',
      String(group._id),
      `${user.displayName ?? user.name ?? 'A user'} accepted your invitation`,
      `Your invitation to ${group.name} was accepted.`,
    );
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'group.respondToInvitation',
      group._id,
      'groups',
      String(group._id),
      now,
      updatedGroup,
      scopes,
    );
    return group._id;
  },
});

async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const INVITATION_LINK_DEFAULT_EXPIRY_MS = 7 * 86_400_000;
const INVITATION_LINK_EXPIRY_OPTIONS = [86_400_000, 7 * 86_400_000, 30 * 86_400_000] as const;

export const createInvitationLink = mutation({
  args: {
    groupId: v.id('groups'),
    expiresInMs: v.optional(
      v.union(
        v.literal(INVITATION_LINK_EXPIRY_OPTIONS[0]),
        v.literal(INVITATION_LINK_EXPIRY_OPTIONS[1]),
        v.literal(INVITATION_LINK_EXPIRY_OPTIONS[2]),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const [group, memberships] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
        .collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    requireAdmin(
      actor._id,
      String(group.ownerId),
      memberships.map((member) => ({ userId: String(member.userId), role: member.role })),
    );
    const now = Date.now();
    const expiresAt = now + (args.expiresInMs ?? INVITATION_LINK_DEFAULT_EXPIRY_MS);
    const activeLinks = await ctx.db
      .query('groupInvitationLinks')
      .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
      .collect();
    for (const link of activeLinks)
      if (link.revokedAt === undefined && link.expiresAt > now)
        await ctx.db.patch(link._id, { revokedAt: now });
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    await ctx.db.insert('groupInvitationLinks', {
      groupId: args.groupId,
      creatorId: actor._id,
      tokenHash: await hashInvitationToken(token),
      expiresAt,
      createdAt: now,
    });
    return { token, expiresAt };
  },
});

export const revokeInvitationLink = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const [group, memberships] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
        .collect(),
    ]);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    requireAdmin(
      actor._id,
      String(group.ownerId),
      memberships.map((member) => ({ userId: String(member.userId), role: member.role })),
    );
    const now = Date.now();
    const links = await ctx.db
      .query('groupInvitationLinks')
      .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
      .collect();
    for (const link of links)
      if (link.revokedAt === undefined) await ctx.db.patch(link._id, { revokedAt: now });
    return null;
  },
});

export const joinByInvitationLink = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    if (!/^[\da-f]{64}$/.test(args.token)) return null;
    const tokenHash = await hashInvitationToken(args.token);
    const link = await ctx.db
      .query('groupInvitationLinks')
      .withIndex('by_token_hash', (query) => query.eq('tokenHash', tokenHash))
      .unique();
    if (!link || link.revokedAt !== undefined || link.expiresAt <= Date.now()) return null;
    const group = await ctx.db.get(link.groupId);
    if (!group || group.archivedAt !== undefined) return null;
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', group._id))
      .collect();
    if (memberships.some((member) => member.userId === user._id)) return group._id;
    const now = Date.now();
    const memberId = await ctx.db.insert('groupMembers', {
      groupId: group._id,
      userId: user._id,
      role: 'member',
      joinedAt: now,
    });
    await ctx.db.patch(group._id, { updatedAt: now });
    const [membership, updatedGroup] = await Promise.all([
      ctx.db.get(memberId),
      ctx.db.get(group._id),
    ]);
    const scopes = [...new Set([...memberships.map((member) => member.userId), user._id])];
    for (const scopeUserId of scopes) {
      await recordSyncChange(ctx, scopeUserId, 'groupMembers', String(memberId), now, membership);
      await recordSyncChange(ctx, scopeUserId, 'groups', String(group._id), now, updatedGroup);
    }
    return group._id;
  },
});

export const removeMember = mutation({
  args: { groupId: v.id('groups'), memberUserId: v.id('users') },
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx);
    if (!actor) throw new Error('AUTH_REQUIRED');
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
      .collect();
    requireAdmin(
      actor._id,
      String(group.ownerId),
      memberships.map((member) => ({ userId: String(member.userId), role: member.role })),
    );
    if (args.memberUserId === group.ownerId) throw new Error('CANNOT_REMOVE_OWNER');
    const target = memberships.find((member) => member.userId === args.memberUserId);
    if (!target) throw new Error('NOT_MEMBER');
    const now = Date.now();
    await ctx.db.delete(target._id);
    await ctx.db.patch(args.groupId, { updatedAt: now });
    const updatedGroup = await ctx.db.get(args.groupId);
    const scopes = [...new Set(memberships.map((member) => member.userId))];
    for (const scopeUserId of scopes) {
      await recordSyncChange(
        ctx,
        scopeUserId,
        'groupMembers',
        String(target._id),
        now,
        undefined,
        now,
      );
      if (scopeUserId === target.userId)
        await recordSyncChange(
          ctx,
          scopeUserId,
          'groups',
          String(args.groupId),
          now,
          undefined,
          now,
        );
      else
        await recordSyncChange(ctx, scopeUserId, 'groups', String(args.groupId), now, updatedGroup);
    }
    return target._id;
  },
});

// Chat bypasses the offline finance outbox so message authorization and attachment expiry stay server-owned.
export const createChatUploadUrl = mutation({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    return ctx.storage.generateUploadUrl();
  },
});

export const sendChatText = mutation({
  args: { groupId: v.id('groups'), text: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const text = args.text.trim();
    if (!text || text.length > CHAT_TEXT_LIMIT) throw new Error('INVALID_CHAT_TEXT');
    const now = Date.now();
    const expiresAt = group.messageRetentionMs ? now + group.messageRetentionMs : undefined;
    const messageId = await ctx.db.insert('groupMessages', {
      groupId: args.groupId,
      senderId: user._id,
      kind: 'text',
      text,
      createdAt: now,
      expiresAt,
    });
    if (expiresAt !== undefined)
      await ctx.scheduler.runAt(expiresAt, internal.groups.mutations.deleteExpiredMessage, {
        messageId,
      });
    return messageId;
  },
});

export const sendBillAttachment = mutation({
  args: { groupId: v.id('groups'), storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_UNAVAILABLE');
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) return null;
    const mimeType = validateBillImageMetadata(metadata);
    if (!mimeType) {
      await ctx.storage.delete(args.storageId);
      return null;
    }
    const [existingGroup, existingDirect] = await Promise.all([
      ctx.db
        .query('groupMessages')
        .withIndex('by_storage', (query) => query.eq('storageId', args.storageId))
        .unique(),
      ctx.db
        .query('directMessages')
        .withIndex('by_storage', (query) => query.eq('storageId', args.storageId))
        .unique(),
    ]);
    if (existingGroup || existingDirect) throw new Error('BILL_IMAGE_ALREADY_ATTACHED');
    const now = Date.now();
    const expiresAt = group.messageRetentionMs ? now + group.messageRetentionMs : undefined;
    const messageId = await ctx.db.insert('groupMessages', {
      groupId: args.groupId,
      senderId: user._id,
      kind: 'bill',
      storageId: args.storageId,
      mimeType,
      size: metadata.size,
      createdAt: now,
      expiresAt,
    });
    if (expiresAt !== undefined)
      await ctx.scheduler.runAt(expiresAt, internal.groups.mutations.deleteExpiredMessage, {
        messageId,
      });
    return messageId;
  },
});

export const deleteExpiredMessage = internalMutation({
  args: { messageId: v.id('groupMessages') },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.expiresAt === undefined) return;
    if (message.expiresAt > Date.now()) {
      await ctx.scheduler.runAt(message.expiresAt, internal.groups.mutations.deleteExpiredMessage, {
        messageId,
      });
      return;
    }
    if (message.storageId) await ctx.storage.delete(message.storageId);
    const reads = await ctx.db
      .query('groupMessageReads')
      .withIndex('by_message_user', (query) => query.eq('messageId', messageId))
      .collect();
    await Promise.all(reads.map((read) => ctx.db.delete(read._id)));
    await ctx.db.delete(messageId);
  },
});

export const addExpense = mutation({
  args: {
    groupId: v.id('groups'),
    accountId: v.id('accounts'),
    title: v.string(),
    amountMinor: v.int64(),
    currency: v.string(),
    occurredAt: v.number(),
    categoryId: v.optional(v.id('categories')),
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    participants: v.array(
      v.object({
        userId: v.id('users'),
        amountMinor: v.int64(),
        method: v.union(
          v.literal('equal'),
          v.literal('exact'),
          v.literal('percentage'),
          v.literal('shares'),
        ),
        basisValue: v.optional(v.string()),
      }),
    ),
    clientMutationId: v.optional(v.string()),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    assertClientId(args.clientId);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'group.addExpense',
    );
    if (replay.found) {
      const previousId = ctx.db.normalizeId('transactions', String(replay.result));
      if (!previousId) throw new Error('INVALID_MUTATION_RECEIPT');
      return previousId;
    }
    await assertClientIdAvailable(args.clientId, () =>
      ctx.db
        .query('transactions')
        .withIndex('by_clientId', (query) => query.eq('clientId', args.clientId!))
        .unique(),
    );
    if (args.amountMinor <= 0n || !args.title.trim()) throw new Error('INVALID_AMOUNT');
    const group = await ctx.db.get(args.groupId);
    const account = await ctx.db.get(args.accountId);
    if (!group || group.archivedAt !== undefined) throw new Error('GROUP_ARCHIVED');
    if (!account) throw new Error('AUTH_REQUIRED');
    if (account.ownerId !== user._id) throw new Error('INSUFFICIENT_PERMISSION');
    const currency = args.currency.toUpperCase();
    assertCurrency(currency);
    if (
      currency !== group.currency ||
      currency !== account.currency ||
      account.archivedAt !== undefined
    )
      throw new Error('CURRENCY_MISMATCH');
    if (args.categoryId !== undefined) {
      const category = await ctx.db.get(args.categoryId);
      if (!category || category.ownerId !== user._id || category.archivedAt !== undefined)
        throw new Error('INVALID_CATEGORY');
    }
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const method = args.participants[0]?.method;
    if (
      !method ||
      new Set(args.participants.map((item) => item.userId)).size !== args.participants.length ||
      args.participants.some(
        (item) =>
          item.method !== method ||
          item.amountMinor < 0n ||
          (method === 'equal'
            ? item.basisValue !== undefined
            : !/^\d+$/.test(item.basisValue ?? '')),
      ) ||
      args.participants.reduce((sum, item) => sum + item.amountMinor, 0n) !== args.amountMinor
    )
      throw new Error('INVALID_SPLIT');
    const allocation = allocateParticipants(
      args.amountMinor,
      args.participants.map((item) => item.userId),
      method,
      method === 'equal' ? undefined : args.participants.map((item) => BigInt(item.basisValue!)),
    );
    if (
      allocation.some((item, index) => item.amountMinor !== args.participants[index]?.amountMinor)
    )
      throw new Error('INVALID_SPLIT');
    for (const participant of args.participants) {
      const participantMembership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (query) =>
          query.eq('groupId', args.groupId).eq('userId', participant.userId),
        )
        .unique();
      if (!participantMembership) throw new Error('NOT_MEMBER');
    }
    const now = Date.now();
    const transactionId = await ctx.db.insert('transactions', {
      ownerId: user._id,
      clientId: args.clientId,
      accountId: args.accountId,
      type: 'expense',
      amountMinor: args.amountMinor,
      currency,
      groupId: args.groupId,
      title: args.title.trim(),
      categoryId: args.categoryId,
      merchant: args.merchant,
      note: args.note,
      occurredAt: args.occurredAt,
      status: 'posted',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('expensePayers', {
      transactionId,
      userId: user._id,
      amountMinor: args.amountMinor,
    });
    for (const participant of args.participants) {
      await ctx.db.insert('expenseParticipants', {
        transactionId,
        userId: participant.userId,
        amountMinor: participant.amountMinor,
        method: participant.method,
        ...(participant.basisValue === undefined ? {} : { basisValue: participant.basisValue }),
      });
    }
    await ctx.db.patch(args.groupId, { updatedAt: now });
    const [transaction, payers, participants, groupMembers] = await Promise.all([
      ctx.db.get(transactionId),
      ctx.db
        .query('expensePayers')
        .withIndex('by_transaction', (query) => query.eq('transactionId', transactionId))
        .collect(),
      ctx.db
        .query('expenseParticipants')
        .withIndex('by_transaction', (query) => query.eq('transactionId', transactionId))
        .collect(),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
        .collect(),
    ]);
    const scopes = groupMembers.map((member) => member.userId);
    await publishMutationResult(
      ctx,
      user._id,
      args.clientMutationId,
      'group.addExpense',
      transactionId,
      'transactions',
      String(transactionId),
      now,
      transaction,
      scopes,
    );
    for (const scopeUserId of scopes) {
      for (const payer of payers)
        await recordSyncChange(ctx, scopeUserId, 'expensePayers', String(payer._id), now, payer);
      for (const participant of participants)
        await recordSyncChange(
          ctx,
          scopeUserId,
          'expenseParticipants',
          String(participant._id),
          now,
          participant,
        );
      await recordSyncChange(ctx, scopeUserId, 'groups', String(args.groupId), now, {
        ...group,
        updatedAt: now,
        _id: args.groupId,
      });
    }
    for (const participant of args.participants) {
      if (participant.userId !== user._id)
        await createNotification(
          ctx,
          participant.userId,
          `split:${transactionId}`,
          'group',
          'group',
          String(args.groupId),
          `New expense in ${group.name}`,
          args.title.trim(),
        );
    }
    return transactionId;
  },
});
