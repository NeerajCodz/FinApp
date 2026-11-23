import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOptionalUser } from '../shared/auth';
import { normalizeUsername } from '../users/domain';
import { avatarUrlForUser } from '../avatars/helpers';
import { groupBalances } from './ledger';
import { simplifyDebts } from '../splits/domain';

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
  // Route params may be malformed or local ids; resolve to empty rather than throwing.
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const groupId = ctx.db.normalizeId('groups', args.groupId);
    if (!groupId) return null;
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const group = await ctx.db.get(groupId);
    if (!group || group.archivedAt !== undefined) return null;
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) => query.eq('groupId', groupId).eq('userId', user._id))
      .unique();
    if (!membership) return null;
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', groupId))
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
          joinedAt: member.joinedAt,
        };
      }),
    );
    // People who left keep their names in expense history.
    const formerRows = await ctx.db
      .query('formerGroupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', groupId))
      .collect();
    const formerMembers = await Promise.all(
      formerRows.map(async (member) => {
        const profile = await ctx.db.get(member.userId);
        return {
          id: member.userId,
          displayName: profile?.displayName ?? profile?.name ?? 'Former member',
          username: profile?.username,
          avatarId: profile?.avatarId,
          joinedAt: member.joinedAt,
          leftAt: member.leftAt,
        };
      }),
    );
    const expenses = await ctx.db
      .query('transactions')
      .withIndex('by_group_occurredAt', (query) => query.eq('groupId', groupId))
      .collect();
    return {
      ...group,
      members,
      formerMembers,
      expenses: expenses
        .filter((expense) => expense.deletedAt === undefined && expense.status !== 'voided')
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 20),
    };
  },
});
export const chatMessages = query({
  // Route params may be malformed or local ids; resolve to empty rather than throwing.
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const groupId = ctx.db.normalizeId('groups', args.groupId);
    if (!groupId) return [];
    const now = Date.now();
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const group = await ctx.db.get(groupId);
    if (!group || group.archivedAt !== undefined) return [];
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) => query.eq('groupId', groupId).eq('userId', user._id))
      .unique();
    if (!membership) return [];
    const currentMembers = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', groupId))
      .collect();
    const currentMemberIds = new Set(currentMembers.map((member) => member.userId));
    const messages = (
      await ctx.db
        .query('groupMessages')
        .withIndex('by_group_createdAt', (query) => query.eq('groupId', groupId))
        .order('asc')
        .collect()
    ).filter((message) => message.expiresAt === undefined || message.expiresAt > now);
    return Promise.all(
      messages.map(async (message) => {
        const [sender, attachmentUrl, reads] = await Promise.all([
          ctx.db.get(message.senderId),
          message.storageId ? ctx.storage.getUrl(message.storageId) : Promise.resolve(null),
          ctx.db
            .query('groupMessageReads')
            .withIndex('by_message_user', (query) => query.eq('messageId', message._id))
            .collect(),
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
          seenBy: reads
            .filter((receipt) => currentMemberIds.has(receipt.userId))
            .map((receipt) => receipt.userId),
        };
      }),
    );
  },
});

/**
 * Live group balances with a suggested minimal set of transfers to settle everyone. Positive
 * amounts are owed to that member. Returns null for non-members or malformed ids.
 */
export const balances = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const groupId = ctx.db.normalizeId('groups', args.groupId);
    if (!groupId) return null;
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const group = await ctx.db.get(groupId);
    if (!group || group.archivedAt !== undefined) return null;
    const memberships = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (query) => query.eq('groupId', groupId))
      .collect();
    if (!memberships.some((member) => member.userId === user._id)) return null;
    let projected: Record<string, bigint>;
    try {
      projected = await groupBalances(ctx, groupId, group.currency);
    } catch (error) {
      if (error instanceof Error && error.message === 'INCOMPLETE_GROUP_SPLITS')
        return {
          currency: group.currency,
          status: 'incomplete' as const,
          members: [],
          transfers: [],
        };
      throw error;
    }
    for (const member of memberships) projected[member.userId] ??= 0n;
    const members = await Promise.all(
      Object.entries(projected).map(async ([userId, amountMinor]) => {
        const id = ctx.db.normalizeId('users', userId);
        const profile = id ? await ctx.db.get(id) : null;
        return {
          userId,
          displayName: profile?.displayName ?? profile?.name ?? 'Former member',
          current: memberships.some((member) => member.userId === userId),
          amountMinor,
        };
      }),
    );
    members.sort((left, right) =>
      right.amountMinor === left.amountMinor
        ? left.displayName.localeCompare(right.displayName)
        : right.amountMinor > left.amountMinor
          ? 1
          : -1,
    );
    return {
      currency: group.currency,
      status: 'ready' as const,
      members,
      transfers: simplifyDebts(projected),
    };
  },
});

/**
 * Audit trail of one group expense (created, edited, deleted, members added), oldest first,
 * with the acting member's display name. Deleted expenses keep their history. Returns null for
 * non-members or malformed ids.
 */
export const expenseHistory = query({
  args: { transactionId: v.string() },
  handler: async (ctx, args) => {
    const transactionId = ctx.db.normalizeId('transactions', args.transactionId);
    if (!transactionId) return null;
    const user = await getOptionalUser(ctx);
    if (!user) return null;
    const transaction = await ctx.db.get(transactionId);
    if (!transaction?.groupId) return null;
    const groupId = ctx.db.normalizeId('groups', transaction.groupId);
    if (!groupId) return null;
    const membership = await ctx.db
      .query('groupMembers')
      .withIndex('by_group_user', (query) => query.eq('groupId', groupId).eq('userId', user._id))
      .unique();
    if (!membership) return null;
    const events = (
      await ctx.db
        .query('ledgerEvents')
        .withIndex('by_entity', (query) =>
          query.eq('entityType', 'transaction').eq('entityId', String(transactionId)),
        )
        .collect()
    ).filter((event) => event.groupId === groupId);
    const names = new Map<string, string>();
    for (const actorId of new Set(events.map((event) => event.actorId))) {
      const actor = await ctx.db.get(actorId);
      names.set(actorId, actor?.displayName ?? actor?.name ?? 'Former member');
    }
    return events
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((event) => ({
        id: event._id,
        kind: event.kind,
        actorId: event.actorId,
        actorName: names.get(event.actorId) ?? 'Former member',
        summary: event.summary,
        balanceDeltas: event.balanceDeltas ?? {},
        version: event.version,
        createdAt: event.createdAt,
      }));
  },
});
