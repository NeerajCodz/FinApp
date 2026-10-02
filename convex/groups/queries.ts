import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser } from '../shared/auth';
import { normalizeUsername } from '../users/domain';
import { avatarUrlForUser } from '../avatars/helpers';

async function hashInvitationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const previewInvitationLink = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!/^[\da-f]{64}$/.test(args.token)) return null;
    const tokenHash = await hashInvitationToken(args.token);
    const link = await ctx.db
      .query('groupInvitationLinks')
      .withIndex('by_token_hash', (index) => index.eq('tokenHash', tokenHash))
      .unique();
    if (!link || link.revokedAt !== undefined || link.expiresAt <= Date.now()) return null;
    const group = await ctx.db.get(link.groupId);
    if (!group || group.archivedAt !== undefined) return null;
    return { groupId: group._id, groupName: group.name, currency: group.currency };
  },
});
export const incomingInvitations = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const username = user.username?.replace(/^@+/, '').trim().toLowerCase();
    const email = user.email?.trim().toLowerCase();
    const phone = user.phone?.replace(/[\s().-]/g, '');
    const usernames = [
      ...new Set([username, user.username].filter((value): value is string => !!value)),
    ];
    const emails = [...new Set([email, user.email].filter((value): value is string => !!value))];
    const phones = [...new Set([phone, user.phone].filter((value): value is string => !!value))];
    const inviteSets = await Promise.all([
      ctx.db
        .query('groupInvites')
        .withIndex('by_invitee_user_status', (index) =>
          index.eq('inviteeUserId', user._id).eq('status', 'pending'),
        )
        .collect(),
      ...usernames.map((value) =>
        ctx.db
          .query('groupInvites')
          .withIndex('by_invitee_username', (index) => index.eq('inviteeUsername', value))
          .collect(),
      ),
      ...emails.map((value) =>
        ctx.db
          .query('groupInvites')
          .withIndex('by_invitee_email', (index) => index.eq('inviteeEmail', value))
          .collect(),
      ),
      ...phones.map((value) =>
        ctx.db
          .query('groupInvites')
          .withIndex('by_invitee_phone', (index) => index.eq('inviteePhone', value))
          .collect(),
      ),
    ]);
    const invites = new Map(
      inviteSets
        .flat()
        .filter((invite) => invite.status === 'pending')
        .map((invite) => [invite._id, invite]),
    );
    return Promise.all(
      [...invites.values()].map(async (invite) => {
        const [group, inviter] = await Promise.all([
          ctx.db.get(invite.groupId),
          ctx.db.get(invite.inviterId),
        ]);
        if (!group || group.archivedAt !== undefined) return null;
        return {
          id: invite._id,
          groupId: group._id,
          groupName: group.name,
          currency: group.currency,
          inviter: {
            displayName: inviter?.displayName ?? inviter?.name ?? 'Finapp user',
            username: inviter?.username,
          },
          createdAt: invite.createdAt,
        };
      }),
    ).then((invitations) =>
      invitations
        .filter((invitation) => invitation !== null)
        .sort((left, right) => right.createdAt - left.createdAt),
    );
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const [ownedGroups, memberships] = await Promise.all([
      ctx.db
        .query('groups')
        .withIndex('by_owner', (query) => query.eq('ownerId', user._id))
        .collect(),
      ctx.db
        .query('groupMembers')
        .withIndex('by_user', (query) => query.eq('userId', user._id))
        .collect(),
    ]);
    const groups = new Map(ownedGroups.map((group) => [group._id, group]));
    for (const membership of memberships) {
      const group = await ctx.db.get(membership.groupId);
      if (group) groups.set(group._id, group);
    }
    return [...groups.values()]
      .filter((group) => group.archivedAt === undefined)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  },
});

export const personTimeline = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const username = normalizeUsername(args.username);
    const person = await ctx.db
      .query('users')
      .withIndex('by_username', (query) => query.eq('username', username))
      .unique();
    if (!person) return [];
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_user', (query) => query.eq('userId', user._id))
      .collect();
    const groupIds = new Set<string>();
    for (const membership of memberships) {
      const otherMembership = await ctx.db
        .query('groupMembers')
        .withIndex('by_group_user', (query) =>
          query.eq('groupId', membership.groupId).eq('userId', person._id),
        )
        .unique();
      if (otherMembership) groupIds.add(membership.groupId);
    }
    const transactions = [];
    for (const groupId of groupIds) {
      const groupTransactions = await ctx.db
        .query('transactions')
        .withIndex('by_group_occurredAt', (query) => query.eq('groupId', groupId))
        .collect();
      transactions.push(...groupTransactions);
    }
    return transactions
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((transaction) => ({
        id: transaction._id,
        title: transaction.title,
        amountMinor: transaction.amountMinor,
        currency: transaction.currency,
        type: transaction.type,
        occurredAt: transaction.occurredAt,
        status: transaction.status,
      }));
  },
});

export const detail = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) return null;
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) return null;
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', args.groupId))
      .collect();
    const members = await Promise.all(
      memberships.map(async (member) => {
        const profile = await ctx.db.get(member.userId);
        return {
          id: member.userId,
          displayName: profile?.displayName ?? profile?.name ?? 'Finapp user',
          username: profile?.username,
          avatarId: profile?.avatarId,
          gender: profile?.gender,
          avatarUrl: profile ? await avatarUrlForUser(ctx, profile) : null,
          role: member.role,
        };
      }),
    );
    const expenses = await ctx.db
      .query('transactions')
      .withIndex('by_group_occurredAt', (query) => query.eq('groupId', args.groupId))
      .collect();
    return {
      ...group,
      members,
      expenses: expenses
        .filter((expense) => expense.deletedAt === undefined && expense.status !== 'voided')
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 20),
    };
  },
});
export const chatMessages = query({
  args: { groupId: v.id('groups') },
  handler: async (ctx, args) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const group = await ctx.db.get(args.groupId);
    if (!group || group.archivedAt !== undefined) return [];
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) =>
        query.eq('groupId', args.groupId).eq('userId', user._id),
      )
      .unique();
    if (!membership) return [];
    const now = Date.now();
    const messages = (
      await ctx.db
        .query('groupMessages')
        .withIndex('by_group_createdAt', (query) => query.eq('groupId', args.groupId))
        .order('asc')
        .collect()
    ).filter((message) => message.expiresAt === undefined || message.expiresAt > now);
    return Promise.all(
      messages.map(async (message) => {
        const [sender, attachmentUrl] = await Promise.all([
          ctx.db.get(message.senderId),
          message.storageId ? ctx.storage.getUrl(message.storageId) : Promise.resolve(null),
        ]);
        return {
          id: message._id,
          kind: message.kind,
          ...(message.text === undefined ? {} : { text: message.text }),
          senderId: message.senderId,
          senderName: sender?.displayName ?? sender?.name ?? 'Member',
          senderAvatarId: sender?.avatarId,
          senderGender: sender?.gender,
          senderAvatarUrl: sender ? await avatarUrlForUser(ctx, sender) : null,
          createdAt: message.createdAt,
          attachmentUrl,
          ...(message.mimeType === undefined ? {} : { mimeType: message.mimeType }),
          ...(message.size === undefined ? {} : { size: message.size }),
        };
      }),
    );
  },
});
