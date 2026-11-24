/**
 * Context for `@finai` replies in group chats and DMs. These internal queries take explicit
 * user ids (the reply runs in a scheduled action without auth) and only return what every
 * participant of the thread can already see: the thread's recent messages, its members, and
 * the ledger of groups all participants belong to. Nothing private to the requester (accounts,
 * personal transactions, other chats) is read here.
 */
import { v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { internalQuery, type QueryCtx } from '../_generated/server';
import { loadGroupLedger, ledgerBalances } from '../groups/ledger';
import { simplifyDebts } from '../splits/domain';

const scopeType = v.union(v.literal('group'), v.literal('direct'));

async function displayName(ctx: QueryCtx, userId: Id<'users'>, cache: Map<string, string>) {
  const key = String(userId);
  const cached = cache.get(key);
  if (cached) return cached;
  const user = await ctx.db.get(userId);
  const name = user?.displayName ?? user?.name ?? 'Member';
  cache.set(key, name);
  return name;
}

function messageText(message: Doc<'groupMessages'> | Doc<'directMessages'>): string {
  if (message.kind === 'bill') return '[shared a bill photo]';
  if (message.kind === 'image') return '[shared an image]';
  return message.text ?? '';
}

/** The participants of a thread, or null when the requester is not one of them. */
export async function threadParticipants(
  ctx: QueryCtx,
  type: 'group' | 'direct',
  scopeId: string,
  requesterId: Id<'users'>,
): Promise<{ title: string; userIds: Id<'users'>[]; group?: Doc<'groups'> } | null> {
  if (type === 'group') {
    const groupId = ctx.db.normalizeId('groups', scopeId);
    const group = groupId ? await ctx.db.get(groupId) : null;
    if (!group || group.archivedAt !== undefined) return null;
    const members = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect();
    if (!members.some((member) => member.userId === requesterId)) return null;
    return { title: group.name, userIds: members.map((member) => member.userId), group };
  }
  const conversationId = ctx.db.normalizeId('directConversations', scopeId);
  const conversation = conversationId ? await ctx.db.get(conversationId) : null;
  if (
    !conversation ||
    (conversation.userLowId !== requesterId && conversation.userHighId !== requesterId)
  )
    return null;
  return { title: 'Direct message', userIds: [conversation.userLowId, conversation.userHighId] };
}

/** Groups every listed user currently belongs to. */
async function sharedGroups(ctx: QueryCtx, userIds: readonly Id<'users'>[]) {
  if (!userIds.length) return [];
  const [first, ...rest] = userIds;
  const memberships = await ctx.db
    .query('groupMembers')
    .withIndex('by_user', (q) => q.eq('userId', first!))
    .collect();
  const groups = await Promise.all(
    memberships.map(async (membership) => {
      const group = await ctx.db.get(membership.groupId);
      if (!group || group.archivedAt !== undefined) return null;
      for (const userId of rest) {
        const member = await ctx.db
          .query('groupMembers')
          .withIndex('by_group_user', (q) => q.eq('groupId', group._id).eq('userId', userId))
          .unique();
        if (!member) return null;
      }
      return { id: group._id, name: group.name, currency: group.currency };
    }),
  );
  return groups.filter((group): group is NonNullable<typeof group> => group !== null);
}

/**
 * The thread's recent messages (oldest first, before the mention), participants, and — for a
 * DM — the groups both people share.
 */
export const threadSnapshot = internalQuery({
  args: {
    scopeType,
    scopeId: v.string(),
    requesterId: v.id('users'),
    beforeCreatedAt: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const thread = await threadParticipants(ctx, args.scopeType, args.scopeId, args.requesterId);
    if (!thread) return null;
    const names = new Map<string, string>();
    const take = Math.max(1, Math.min(60, Math.floor(args.limit)));
    const now = Date.now();
    const rows =
      args.scopeType === 'group'
        ? (
            await ctx.db
              .query('groupMessages')
              .withIndex('by_group_createdAt', (q) =>
                q.eq('groupId', thread.group!._id).lte('createdAt', args.beforeCreatedAt),
              )
              .order('desc')
              .take(take)
          ).filter((message) => message.expiresAt === undefined || message.expiresAt > now)
        : await ctx.db
            .query('directMessages')
            .withIndex('by_conversation_createdAt', (q) =>
              q
                .eq('conversationId', args.scopeId as Id<'directConversations'>)
                .lte('createdAt', args.beforeCreatedAt),
            )
            .order('desc')
            .take(take);
    const messages = await Promise.all(
      rows
        .filter((message) => message.kind !== 'ai' || message.ai?.status === 'done')
        .reverse()
        .map(async (message) => ({
          id: String(message._id),
          sender: message.kind === 'ai' ? 'FinAI' : await displayName(ctx, message.senderId, names),
          senderId: message.kind === 'ai' ? null : String(message.senderId),
          text: messageText(message).slice(0, 1_000),
          createdAt: message.createdAt,
        })),
    );
    const participants = await Promise.all(
      thread.userIds.map(async (userId) => ({
        id: String(userId),
        name: await displayName(ctx, userId, names),
      })),
    );
    return {
      title: thread.title,
      group: thread.group
        ? { id: String(thread.group._id), name: thread.group.name, currency: thread.group.currency }
        : null,
      participants,
      requesterName: await displayName(ctx, args.requesterId, names),
      sharedGroups: args.scopeType === 'direct' ? await sharedGroups(ctx, thread.userIds) : [],
      messages,
    };
  },
});

/**
 * A group's ledger for a thread: only when every viewer is a current member. Balances,
 * suggested transfers, recent expenses (with who paid and each share) and recent settlements.
 */
export const sharedLedger = internalQuery({
  args: { groupId: v.string(), viewerIds: v.array(v.id('users')) },
  handler: async (ctx, { groupId: rawGroupId, viewerIds }) => {
    const groupId = ctx.db.normalizeId('groups', rawGroupId);
    const group = groupId ? await ctx.db.get(groupId) : null;
    if (!group || group.archivedAt !== undefined) return null;
    const members = await ctx.db
      .query('groupMembers')
      .withIndex('by_group', (q) => q.eq('groupId', group._id))
      .collect();
    const memberIds = new Set(members.map((member) => String(member.userId)));
    if (!viewerIds.length || viewerIds.some((id) => !memberIds.has(String(id)))) return null;
    const names = new Map<string, string>();
    const nameOf = (userId: string) => displayName(ctx, userId as Id<'users'>, names);

    let ledger;
    try {
      ledger = await loadGroupLedger(ctx, group._id, group.currency);
    } catch (error) {
      if (error instanceof Error && error.message === 'INCOMPLETE_GROUP_SPLITS')
        return {
          group: { id: String(group._id), name: group.name, currency: group.currency },
          status: 'incomplete' as const,
          members: [],
          transfers: [],
          expenses: [],
          settlements: [],
        };
      throw error;
    }
    const balances = ledgerBalances(ledger);
    for (const member of members) balances[member.userId] ??= 0n;
    const memberRows = await Promise.all(
      Object.entries(balances).map(async ([userId, amountMinor]) => ({
        userId,
        name: await nameOf(userId),
        current: memberIds.has(userId),
        amountMinor,
      })),
    );
    memberRows.sort((a, b) =>
      a.amountMinor === b.amountMinor ? 0 : a.amountMinor > b.amountMinor ? -1 : 1,
    );
    const transfers = await Promise.all(
      simplifyDebts(balances).map(async (transfer) => ({
        fromUserId: transfer.fromUserId,
        fromName: await nameOf(transfer.fromUserId),
        toUserId: transfer.toUserId,
        toName: await nameOf(transfer.toUserId),
        amountMinor: transfer.amountMinor,
      })),
    );
    const recentExpenses = [...ledger.expenses]
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, 15);
    const expenses = await Promise.all(
      recentExpenses.map(async (expense) => ({
        id: String(expense._id),
        title: expense.title,
        amountMinor: expense.amountMinor,
        occurredAt: expense.occurredAt,
        paidBy: await Promise.all(
          ledger.payers
            .filter((row) => row.transactionId === expense._id)
            .map(async (row) => ({ name: await nameOf(row.userId), amountMinor: row.amountMinor })),
        ),
        shares: await Promise.all(
          ledger.participants
            .filter((row) => row.transactionId === expense._id)
            .map(async (row) => ({ name: await nameOf(row.userId), amountMinor: row.amountMinor })),
        ),
        ...(expense.items?.length
          ? {
              items: expense.items.slice(0, 20).map((item) => ({
                title: item.title,
                amountMinor: item.amountMinor,
              })),
            }
          : {}),
      })),
    );
    const settlements = await Promise.all(
      [...ledger.settlements]
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, 10)
        .map(async (row) => ({
          from: await nameOf(row.fromUserId),
          to: await nameOf(row.toUserId),
          amountMinor: row.amountMinor,
          occurredAt: row.occurredAt,
          ...(row.note ? { note: row.note } : {}),
        })),
    );
    return {
      group: { id: String(group._id), name: group.name, currency: group.currency },
      status: 'ready' as const,
      members: memberRows,
      transfers,
      expenses,
      settlements,
    };
  },
});
