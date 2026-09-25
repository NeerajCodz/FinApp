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
import { changeMemberRole, createGroup, type Group } from './domain';
import { publishMutationResult, recordSyncChange, replayMutationResult } from '../sync/common';

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
    const replay = await replayMutationResult(ctx, owner._id, args.clientMutationId, 'group.create');
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
      ctx.db.query('groupMembers').withIndex('by_group', (query) => query.eq('groupId', groupId)).collect(),
      ctx.db.query('groupInvites').withIndex('by_group', (query) => query.eq('groupId', groupId)).collect(),
    ]);
    const scopes = memberships.map((membership) => membership.userId);
    await publishMutationResult(
      ctx, owner._id, args.clientMutationId, 'group.create', groupId,
      'groups', String(groupId), now, group, scopes,
    );
    for (const scopeUserId of scopes) {
      for (const member of memberships)
        await recordSyncChange(ctx, scopeUserId, 'groupMembers', String(member._id), now, member);
    }
    for (const invite of invites)
      await recordSyncChange(ctx, owner._id, 'groupInvites', String(invite._id), now, invite);
    return groupId;
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
    participantUsernames: v.array(v.string()),
    clientMutationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const replay = await replayMutationResult(ctx, user._id, args.clientMutationId, 'group.addExpense');
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
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) throw new Error('NOT_MEMBER');
    const handles = [
      ...new Set(
        args.participantUsernames.map((value) => value.replace(/^@+/, '').trim().toLowerCase()),
      ),
    ].filter(Boolean);
    const participantIds = [user._id];
    for (const handle of handles) {
      const participant = await ctx.db
        .query('users')
        .withIndex('by_username', (query) => query.eq('username', handle))
        .unique();
      if (!participant) throw new Error('UNKNOWN_USERNAME');
      const participantMembership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (query) =>
          query.eq('groupId', args.groupId).eq('userId', participant._id),
        )
        .unique();
      if (!participantMembership) throw new Error('NOT_MEMBER');
      if (!participantIds.includes(participant._id)) participantIds.push(participant._id);
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
    const base = args.amountMinor / BigInt(participantIds.length);
    let remainder = args.amountMinor % BigInt(participantIds.length);
    for (const participantId of participantIds) {
      const share = base + (remainder > 0n ? 1n : 0n);
      remainder -= remainder > 0n ? 1n : 0n;
      await ctx.db.insert('expenseParticipants', {
        transactionId,
        userId: participantId,
        amountMinor: share,
        method: 'equal',
      });
    }
    await ctx.db.patch(args.groupId, { updatedAt: now });
    const [transaction, payers, participants, groupMembers] = await Promise.all([
      ctx.db.get(transactionId),
      ctx.db.query('expensePayers').withIndex('by_transaction', (query) => query.eq('transactionId', transactionId)).collect(),
      ctx.db.query('expenseParticipants').withIndex('by_transaction', (query) => query.eq('transactionId', transactionId)).collect(),
      ctx.db.query('groupMembers').withIndex('by_group', (query) => query.eq('groupId', args.groupId)).collect(),
    ]);
    const scopes = groupMembers.map((member) => member.userId);
    await publishMutationResult(
      ctx, user._id, args.clientMutationId, 'group.addExpense', transactionId,
      'transactions', String(transactionId), now, transaction, scopes,
    );
    for (const scopeUserId of scopes) {
      for (const payer of payers)
        await recordSyncChange(ctx, scopeUserId, 'expensePayers', String(payer._id), now, payer);
      for (const participant of participants)
        await recordSyncChange(ctx, scopeUserId, 'expenseParticipants', String(participant._id), now, participant);
      await recordSyncChange(ctx, scopeUserId, 'groups', String(args.groupId), now, {
        ...group, updatedAt: now, _id: args.groupId,
      });
    }
    return transactionId;
  },
});
