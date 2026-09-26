import { mutation } from '../_generated/server';
import { v } from 'convex/values';
import { requireIdentity, requireUser } from '../shared/auth';
import { assertCurrency } from '../shared/validators';
import {
  requireAdmin,
  requireMember,
  type GroupRole,
  type Membership,
} from '../shared/permissions';
import { changeMemberRole, createGroup, renameGroup, type Group } from './domain';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';
import { createNotification } from '../notifications/mutations';
import { allocateParticipants } from '../splits/domain';

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
    memberPhones: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
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
    if ((args.memberPhones?.length ?? 0) > 0 && owner.phoneVerificationTime === undefined)
      throw new Error('PHONE_UNVERIFIED');
    const currency = args.currency.toUpperCase();
    assertCurrency(currency);
    const name = args.name.trim();
    if (!name) throw new Error('INVALID_GROUP');
    const now = Date.now();
    const groupId = await ctx.db.insert('groups', {
      ownerId: owner._id,
      name,
      currency,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: owner._id,
      role: 'owner',
      joinedAt: now,
    });

    const usernames = [
      ...new Set(
        args.memberUsernames.map((value) => value.replace(/^@+/, '').trim().toLowerCase()),
      ),
    ].filter((value) => value.length > 0 && value !== owner.username);
    for (const username of usernames) {
      const member = await ctx.db
        .query('users')
        .withIndex('by_username', (query) => query.eq('username', username))
        .unique();
      if (member) {
        await ctx.db.insert('groupMembers', {
          groupId,
          userId: member._id,
          role: 'member',
          joinedAt: now,
        });
      } else {
        await ctx.db.insert('groupInvites', {
          groupId,
          inviterId: owner._id,
          inviteeEmail: '',
          inviteeUsername: username,
          status: 'pending',
          createdAt: now,
        });
      }
    }
    for (const phone of args.memberPhones ?? []) {
      const normalizedPhone = phone.replace(/[\s().-]/g, '');
      if (normalizedPhone && normalizedPhone !== owner.phone) {
        await ctx.db.insert('groupInvites', {
          groupId,
          inviterId: owner._id,
          inviteeEmail: '',
          inviteePhone: normalizedPhone,
          status: 'pending',
          createdAt: now,
        });
      }
    }
    const [group, memberships, invites] = await Promise.all([
      ctx.db.get(groupId),
      ctx.db
        .query('groupMembers')
        .withIndex('by_group', (query) => query.eq('groupId', groupId))
        .collect(),
      ctx.db
        .query('groupInvites')
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
    for (const invite of invites)
      await recordSyncChange(ctx, owner._id, 'groupInvites', String(invite._id), now, invite);
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
    name: v.string(),
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
    const updated = renameGroup(
      actor._id,
      {
        id: String(group._id),
        ownerId: String(group.ownerId),
        name: group.name,
        currency: group.currency,
        archivedAt: group.archivedAt,
      },
      roles,
      args.name,
    );
    const updatedAt = Date.now();
    await ctx.db.patch(args.groupId, { name: updated.name, updatedAt });
    await publishMutationResult(
      ctx,
      actor._id,
      args.clientMutationId,
      'group.update',
      args.groupId,
      'groups',
      String(args.groupId),
      updatedAt,
      { ...group, name: updated.name, updatedAt },
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

export const addExpense = mutation({
  args: {
    groupId: v.id('groups'),
    accountId: v.id('accounts'),
    title: v.string(),
    amountMinor: v.int64(),
    currency: v.string(),
    occurredAt: v.number(),
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
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
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
      accountId: args.accountId,
      type: 'expense',
      amountMinor: args.amountMinor,
      currency,
      groupId: args.groupId,
      title: args.title.trim(),
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
