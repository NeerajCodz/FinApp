import { api } from '@convex/_generated/api';
import type { ConvexHttpClient } from 'convex/browser';
import { z } from 'zod';
import { formatMinor } from '../money';
import {
  confirm,
  currency,
  cursor,
  defineTool,
  docId,
  id,
  idempotencyKey,
  limit,
  lineItems,
  minorUnits,
  mutationId,
  page,
  prepareItems,
  timestamp,
  type ToolFactory,
} from '../toolkit';

const DAY = 86_400_000;
const groupWindow = {
  startAt: timestamp
    .optional()
    .describe('Inclusive start (epoch ms). Default: 90 days before endAt.'),
  endAt: timestamp.optional().describe('Exclusive end (epoch ms). Default: now.'),
};
function window(args: { startAt?: number; endAt?: number }) {
  const endAt = args.endAt ?? Date.now();
  return { startAt: args.startAt ?? endAt - 90 * DAY, endAt };
}

const splitMethod = z
  .enum(['equal', 'exact', 'percentage', 'shares', 'itemized'])
  .describe(
    "How this share was computed. 'itemized' = derived from line items, each shared equally among its participantIds.",
  );
const participants = z
  .array(
    z.object({
      userId: docId('Member user'),
      amountMinor: minorUnits.describe('This member’s share; shares must sum to amountMinor.'),
      method: splitMethod,
      basisValue: z
        .string()
        .max(32)
        .optional()
        .describe('Percentage or share count behind the amount, e.g. "25" or "2".'),
    }),
  )
  .min(1)
  .max(100)
  .describe('Every member sharing the cost with their exact share in minor units.');
const payers = z
  .array(z.object({ userId: docId('Paying member'), amountMinor: minorUnits }))
  .min(1)
  .max(100)
  .optional()
  .describe('Who paid and how much (must sum to amountMinor). Omit to keep current payers scaled.');

type SplitInput = z.infer<typeof participants>;
function splitPayload(rows: SplitInput) {
  return rows.map((row) => ({
    userId: id<'users'>(row.userId),
    amountMinor: row.amountMinor,
    method: row.method,
    ...(row.basisValue === undefined ? {} : { basisValue: row.basisValue }),
  }));
}

function invitationUrl(token: string): string {
  const path = `/group/invite?token=${encodeURIComponent(token)}`;
  const base = process.env.MCP_ISSUER_URL?.trim();
  try {
    return base ? new URL(path, base).toString() : path;
  } catch {
    return path;
  }
}

async function loadBalances(client: ConvexHttpClient, groupId: string) {
  const [balances, me, group] = await Promise.all([
    client.query(api.groups.queries.balances, { groupId }),
    client.query(api.users.queries.current, {}),
    client.query(api.mcp.groupSummary, { groupId: id<'groups'>(groupId) }),
  ]);
  if (!balances || !me) throw new Error('NOT_MEMBER');
  const names = new Map(balances.members.map((member) => [member.userId, member.displayName]));
  const myId = String(me._id);
  const transfers = balances.transfers.map((transfer) => ({
    fromUserId: transfer.fromUserId,
    fromName: names.get(transfer.fromUserId) ?? 'Former member',
    toUserId: transfer.toUserId,
    toName: names.get(transfer.toUserId) ?? 'Former member',
    amountMinor: transfer.amountMinor,
    direction:
      transfer.fromUserId === myId ? 'you_pay' : transfer.toUserId === myId ? 'you_receive' : null,
  }));
  const mine = balances.members.find((member) => member.userId === myId)?.amountMinor ?? 0n;
  return {
    group: { id: group.id, name: group.name, currency: group.currency, role: group.memberRole },
    currency: balances.currency,
    status: balances.status,
    meId: myId,
    myBalanceMinor: mine,
    members: balances.members.map((member) => ({ ...member, isMe: member.userId === myId })),
    transfers,
  };
}

function balanceSummary(data: unknown) {
  const value = data as Awaited<ReturnType<typeof loadBalances>>;
  if (value.status !== 'ready') return 'Balances are still being computed for this group.';
  const mine = value.myBalanceMinor;
  const amount = formatMinor(mine < 0n ? -mine : mine, value.currency);
  const position =
    mine === 0n ? 'You are settled up' : mine > 0n ? `You are owed ${amount}` : `You owe ${amount}`;
  return `${position} in ${value.group.name}. ${value.transfers.length} suggested transfer(s) settle everyone.`;
}

export const groupTools: ToolFactory = (client) => [
  defineTool({
    name: 'finapp.groups.list',
    title: 'List my groups',
    description: 'One page of groups you belong to.',
    scope: 'finapp:read',
    input: { limit, cursor },
    run: (args) => client.query(api.mcp.listGroups, { paginationOpts: page(args) }),
  }),
  defineTool({
    name: 'finapp.groups.detail.get',
    title: 'Get group',
    description:
      'Group metadata (name, currency, type, dates) and your role. Use members/expenses/balances tools for the rest.',
    scope: 'finapp:read',
    input: { groupId: docId('Group') },
    run: (args) => client.query(api.mcp.groupSummary, { groupId: id<'groups'>(args.groupId) }),
  }),
  defineTool({
    name: 'finapp.groups.create',
    title: 'Create group',
    description:
      'Create a shared group and invite members by exact Finapp usernames (no phone numbers or emails).',
    scope: 'finapp:write:groups',
    input: {
      name: z.string().min(1).max(120),
      currency,
      memberUsernames: z.array(z.string().min(3).max(32)).max(50).default([]),
      description: z.string().max(500).optional(),
      groupType: z.string().max(40).optional().describe('e.g. "trip", "home", "couple".'),
      icon: z.string().max(80).optional(),
      color: z.string().max(32).optional(),
      startAt: timestamp.optional(),
      endAt: timestamp.optional(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.create, {
        name: args.name,
        currency: args.currency,
        memberUsernames: args.memberUsernames,
        description: args.description,
        groupType: args.groupType,
        icon: args.icon,
        color: args.color,
        startAt: args.startAt,
        endAt: args.endAt,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.groups.update',
    title: 'Update group settings',
    description:
      'Change group name, appearance, description, type, dates or chat retention. Only send fields to change; null clears.',
    scope: 'finapp:write:groups',
    input: {
      groupId: docId('Group'),
      name: z.string().min(1).max(120).optional(),
      icon: z.string().max(80).nullable().optional(),
      color: z.string().max(32).optional(),
      description: z.string().max(500).nullable().optional(),
      groupType: z.string().max(40).nullable().optional(),
      purpose: z.string().max(200).nullable().optional(),
      location: z.string().max(200).nullable().optional(),
      startAt: timestamp.nullable().optional(),
      endAt: timestamp.nullable().optional(),
      messageRetentionMs: z.number().int().positive().nullable().optional(),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.updateSettings, {
        ...args,
        groupId: id<'groups'>(args.groupId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Members ----------
  defineTool({
    name: 'finapp.groups.members.list',
    title: 'List group members',
    description: 'One page of current members of a group you belong to.',
    scope: 'finapp:read',
    input: { groupId: docId('Group'), limit, cursor },
    run: (args) =>
      client.query(api.mcp.listGroupMembers, {
        groupId: id<'groups'>(args.groupId),
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.groups.members.invite',
    title: 'Invite member',
    description: 'Invite a Finapp username to a group you administer.',
    scope: 'finapp:write:groups',
    input: { groupId: docId('Group'), username: z.string().min(3).max(32) },
    run: (args) =>
      client.mutation(api.groups.mutations.addMember, {
        groupId: id<'groups'>(args.groupId),
        username: args.username,
      }),
  }),
  defineTool({
    name: 'finapp.groups.members.set_role',
    title: 'Change member role',
    description: 'Promote a member to admin or demote an admin to member.',
    scope: 'finapp:write:groups',
    input: {
      groupId: docId('Group'),
      memberUserId: docId('Member user'),
      role: z.enum(['admin', 'member']),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.setMemberRole, {
        groupId: id<'groups'>(args.groupId),
        memberUserId: id<'users'>(args.memberUserId),
        role: args.role,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.groups.members.remove',
    title: 'Remove member',
    description:
      'Remove a member from a group you administer. Fails with OUTSTANDING_BALANCE (and the amount) while they still owe or are owed money.',
    scope: 'finapp:write:groups',
    destructive: true,
    input: {
      groupId: docId('Group'),
      memberUserId: docId('Member user'),
      confirm: confirm('remove this member from the group'),
    },
    run: (args) =>
      client.mutation(api.groups.mutations.removeMember, {
        groupId: id<'groups'>(args.groupId),
        memberUserId: id<'users'>(args.memberUserId),
      }),
  }),
  defineTool({
    name: 'finapp.groups.leave',
    title: 'Leave group',
    description:
      'Leave a group. Fails with OUTSTANDING_BALANCE while your balance is not zero; settle up first.',
    scope: 'finapp:write:groups',
    destructive: true,
    input: { groupId: docId('Group'), confirm: confirm('leave this group') },
    run: (args) =>
      client.mutation(api.groups.mutations.leaveGroup, { groupId: id<'groups'>(args.groupId) }),
  }),
  defineTool({
    name: 'finapp.groups.transfer_ownership',
    title: 'Transfer group ownership',
    description:
      'Make another current member the owner of a group you own, after explicit user confirmation. You become an admin and can no longer undo this yourself. Owners must transfer ownership before they can leave.',
    scope: 'finapp:write:groups',
    destructive: true,
    input: {
      groupId: docId('Group'),
      newOwnerId: docId('New owner user (a current member)'),
      confirm: confirm('hand ownership of this group to that member'),
      clientMutationId: mutationId,
    },
    run: async (args) => ({
      groupId: await client.mutation(api.groups.mutations.transferOwnership, {
        groupId: id<'groups'>(args.groupId),
        newOwnerId: id<'users'>(args.newOwnerId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    }),
  }),

  // ---------- Invitations ----------
  defineTool({
    name: 'finapp.groups.invitations.list',
    title: 'List my group invitations',
    description:
      'One page of pending invitations addressed to you. Check each lookup mode: user, username and email.',
    scope: 'finapp:read',
    input: { lookup: z.enum(['user', 'username', 'email']).default('user'), limit, cursor },
    run: (args) =>
      client.query(api.mcp.listGroupInvitations, {
        lookup: args.lookup,
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.groups.invitations.respond',
    title: 'Respond to group invitation',
    description: 'Accept or decline a group invitation addressed to you.',
    scope: 'finapp:write:groups',
    input: {
      inviteId: docId('Invitation'),
      response: z.enum(['accept', 'decline']),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.respondToInvitation, {
        inviteId: id<'groupInvites'>(args.inviteId),
        response: args.response,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.groups.invitation_links.create',
    title: 'Create invitation link',
    description:
      'Create a shareable join link for a group you administer (invalidates any previous link). Expires in 1, 7 or 30 days.',
    scope: 'finapp:write:groups',
    input: {
      groupId: docId('Group'),
      expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).default(7),
    },
    run: async (args) => {
      const result = await client.mutation(api.groups.mutations.createInvitationLink, {
        groupId: id<'groups'>(args.groupId),
        expiresInMs: (args.expiresInDays * DAY) as 86_400_000,
      });
      return { url: invitationUrl(result.token), expiresAt: result.expiresAt };
    },
  }),
  defineTool({
    name: 'finapp.groups.invitation_links.revoke',
    title: 'Revoke invitation link',
    description: 'Disable the active join link of a group you administer.',
    scope: 'finapp:write:groups',
    destructive: true,
    input: { groupId: docId('Group'), confirm: confirm('revoke this invitation link') },
    run: (args) =>
      client.mutation(api.groups.mutations.revokeInvitationLink, {
        groupId: id<'groups'>(args.groupId),
      }),
  }),
  defineTool({
    name: 'finapp.groups.invitation_links.preview',
    title: 'Preview invitation link',
    description: 'Show which group a join token (64 hex chars from the link) belongs to.',
    scope: 'finapp:read',
    input: { token: z.string().regex(/^[\da-f]{64}$/) },
    run: (args) => client.query(api.groups.queries.previewInvitationLink, { token: args.token }),
  }),
  defineTool({
    name: 'finapp.groups.invitation_links.join',
    title: 'Join with invitation link',
    description: 'Join a group using the token from its invitation link.',
    scope: 'finapp:write:groups',
    input: { token: z.string().regex(/^[\da-f]{64}$/) },
    run: async (args) => ({
      groupId: await client.mutation(api.groups.mutations.joinByInvitationLink, {
        token: args.token,
      }),
    }),
  }),

  // ---------- Balances & settling up ----------
  defineTool({
    name: 'finapp.groups.balances',
    title: 'Group balances',
    description:
      'Who owes whom in a group: each member’s net balance (positive = owed money) and the minimal set of suggested transfers that settles everyone. Renders a balances card in supporting clients.',
    scope: 'finapp:read',
    widget: 'groupBalances',
    input: { groupId: docId('Group') },
    run: (args) => loadBalances(client, args.groupId),
    summarize: balanceSummary,
  }),
  defineTool({
    name: 'finapp.groups.settle_up.prepare',
    title: 'Prepare settle-up',
    description:
      'Everything needed to settle up in a group: balances, the suggested transfers involving you, and your accounts in the group currency. Renders an interactive settle-up card where the user can record a settlement or send a reminder.',
    scope: 'finapp:read',
    widget: 'settleUp',
    input: { groupId: docId('Group') },
    run: async (args) => {
      const [balances, accounts] = await Promise.all([
        loadBalances(client, args.groupId),
        client.query(api.accounts.queries.list, {}),
      ]);
      return {
        ...balances,
        transfers: balances.transfers.filter((transfer) => transfer.direction !== null),
        accounts: accounts
          .filter((account) => account.currency === balances.currency)
          .map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency,
            balanceMinor: account.balanceMinor,
          })),
      };
    },
    summarize: balanceSummary,
  }),
  defineTool({
    name: 'finapp.groups.nudge',
    title: 'Send payment reminder',
    description:
      'Remind a member who owes you in this group. Allowed once per member per day and only while they owe you (NOTHING_OWED otherwise).',
    scope: 'finapp:write:groups',
    input: { groupId: docId('Group'), userId: docId('Member user who owes you') },
    run: (args) =>
      client.mutation(api.notifications.mutations.nudge, {
        groupId: id<'groups'>(args.groupId),
        userId: id<'users'>(args.userId),
      }),
  }),

  // ---------- Expenses ----------
  defineTool({
    name: 'finapp.groups.expenses.list',
    title: 'List group expenses',
    description:
      'One page of a group’s expense ledger in a date window (default last 90 days, max 366), newest first, with line items and versions.',
    scope: 'finapp:read',
    widget: 'transactions',
    input: { groupId: docId('Group'), ...groupWindow, limit, cursor },
    run: (args) =>
      client.query(api.mcp.listGroupExpenses, {
        groupId: id<'groups'>(args.groupId),
        ...window(args),
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.groups.expenses.get',
    title: 'Get group expense',
    description:
      'One group expense with payers, each participant’s share, line items, and the current version (pass it as expectedVersion when updating or deleting).',
    scope: 'finapp:read',
    widget: 'expense',
    input: { expenseId: docId('Expense transaction') },
    run: (args) => client.query(api.mcp.getTransaction, { transactionId: args.expenseId }),
  }),
  defineTool({
    name: 'finapp.groups.expenses.history',
    title: 'Expense history',
    description:
      'Audit trail of one group expense (created, edited, deleted, members added), oldest first, with who did it and the balance impact.',
    scope: 'finapp:read',
    input: { expenseId: docId('Expense transaction') },
    run: async (args) => {
      const [events, expense] = await Promise.all([
        client.query(api.groups.queries.expenseHistory, { transactionId: args.expenseId }),
        client.query(api.mcp.getTransaction, { transactionId: args.expenseId }),
      ]);
      if (!events) throw new Error('NOT_MEMBER');
      return { currency: expense.currency, title: expense.title, events };
    },
  }),
  defineTool({
    name: 'finapp.groups.expenses.create',
    title: 'Add group expense',
    description:
      'Record a shared expense paid from one of your accounts. Give every participant’s share in minor units (shares sum to amountMinor). Optional line items (sum to amountMinor) enable itemized splits.',
    scope: 'finapp:write:groups',
    input: {
      groupId: docId('Group'),
      accountId: docId('Your paying account'),
      title: z.string().min(1).max(200),
      amountMinor: minorUnits,
      currency,
      occurredAt: timestamp,
      categoryId: docId('Category').optional(),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      participants,
      items: lineItems,
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.addExpense, {
        groupId: id<'groups'>(args.groupId),
        accountId: id<'accounts'>(args.accountId),
        title: args.title,
        amountMinor: args.amountMinor,
        currency: args.currency,
        occurredAt: args.occurredAt,
        categoryId: id<'categories'>(args.categoryId),
        merchant: args.merchant,
        note: args.note,
        participants: splitPayload(args.participants),
        clientMutationId: idempotencyKey(args.clientMutationId),
        items: prepareItems(args.items, args.amountMinor),
      }),
  }),
  defineTool({
    name: 'finapp.groups.expenses.update',
    title: 'Edit group expense',
    description:
      'Replace a group expense’s details, split, payers and line items. Read it first with finapp.groups.expenses.get and pass its version as expectedVersion; TRANSACTION_CHANGED means someone edited it meanwhile. Only the creator or an admin can edit.',
    scope: 'finapp:write:groups',
    input: {
      expenseId: docId('Expense transaction'),
      accountId: docId('Paying account'),
      title: z.string().min(1).max(200),
      amountMinor: minorUnits,
      currency,
      occurredAt: timestamp,
      categoryId: docId('Category').optional(),
      merchant: z.string().max(200).optional(),
      note: z.string().max(2000).optional(),
      participants,
      payers,
      items: lineItems,
      expectedVersion: z
        .number()
        .int()
        .min(1)
        .describe('Version from expenses.get; required so a concurrent edit is never overwritten.'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.updateExpense, {
        transactionId: id<'transactions'>(args.expenseId),
        accountId: id<'accounts'>(args.accountId),
        title: args.title,
        amountMinor: args.amountMinor,
        currency: args.currency,
        occurredAt: args.occurredAt,
        categoryId: id<'categories'>(args.categoryId),
        merchant: args.merchant,
        note: args.note,
        participants: splitPayload(args.participants),
        payers: args.payers?.map((payer) => ({
          userId: id<'users'>(payer.userId),
          amountMinor: payer.amountMinor,
        })),
        expectedVersion: args.expectedVersion,
        clientMutationId: idempotencyKey(args.clientMutationId),
        items: prepareItems(args.items, args.amountMinor),
      }),
  }),
  defineTool({
    name: 'finapp.groups.expenses.delete',
    title: 'Delete group expense',
    description:
      'Delete a group expense after explicit confirmation (creator or admin only). History is kept and members are notified. Pass expectedVersion from expenses.get.',
    scope: 'finapp:write:groups',
    destructive: true,
    input: {
      expenseId: docId('Expense transaction'),
      expectedVersion: z.number().int().min(1).optional(),
      confirm: confirm('delete this shared expense'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.deleteExpense, {
        transactionId: id<'transactions'>(args.expenseId),
        expectedVersion: args.expectedVersion,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),
  defineTool({
    name: 'finapp.groups.expenses.add_members',
    title: 'Add late joiners to expenses',
    description:
      'Include members who joined later in existing expenses; their equal shares are re-split. Use member ids from members.list.',
    scope: 'finapp:write:groups',
    input: {
      groupId: docId('Group'),
      // Matches the backend limits in groups.mutations.addMembersToExpenses.
      expenseIds: z.array(docId('Expense transaction')).min(1).max(50),
      userIds: z.array(docId('Member user')).min(1).max(20),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.groups.mutations.addMembersToExpenses, {
        groupId: id<'groups'>(args.groupId),
        expenseIds: args.expenseIds.map((value) => id<'transactions'>(value)),
        userIds: args.userIds.map((value) => id<'users'>(value)),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Settlements ----------
  defineTool({
    name: 'finapp.groups.settlements.list',
    title: 'List settlements',
    description: 'One page of settlements in a group for a date window (default last 90 days).',
    scope: 'finapp:read',
    input: { groupId: docId('Group'), ...groupWindow, limit, cursor },
    run: (args) =>
      client.query(api.mcp.listGroupSettlements, {
        groupId: id<'groups'>(args.groupId),
        ...window(args),
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.groups.settlements.create',
    title: 'Record settlement',
    description:
      'Record a payment between two members (usually one suggested by finapp.groups.balances) from your account, with an optional note.',
    scope: 'finapp:write:groups',
    input: {
      groupId: docId('Group'),
      fromUserId: docId('Paying member'),
      toUserId: docId('Receiving member'),
      accountId: docId('Your account'),
      amountMinor: minorUnits,
      currency,
      occurredAt: timestamp.optional().describe('Default: now.'),
      note: z.string().max(280).optional().describe('At most 280 characters, e.g. "UPI ref 1234".'),
      clientMutationId: mutationId,
    },
    run: async (args) => ({
      settlementId: await client.mutation(api.settlements.mutations.create, {
        groupId: id<'groups'>(args.groupId),
        fromUserId: id<'users'>(args.fromUserId),
        toUserId: id<'users'>(args.toUserId),
        accountId: id<'accounts'>(args.accountId),
        amountMinor: args.amountMinor,
        currency: args.currency,
        occurredAt: args.occurredAt ?? Date.now(),
        note: args.note,
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
    }),
  }),
  defineTool({
    name: 'finapp.groups.settlements.delete',
    title: 'Undo settlement',
    description: 'Undo (delete) a recorded settlement after explicit confirmation.',
    scope: 'finapp:write:groups',
    destructive: true,
    input: {
      settlementId: docId('Settlement'),
      confirm: confirm('undo this settlement'),
      clientMutationId: mutationId,
    },
    run: (args) =>
      client.mutation(api.settlements.mutations.remove, {
        settlementId: id<'settlements'>(args.settlementId),
        clientMutationId: idempotencyKey(args.clientMutationId),
      }),
  }),

  // ---------- Chat & shared history ----------
  defineTool({
    name: 'finapp.groups.messages.list',
    title: 'List group messages',
    description: 'One page of group chat messages in a date window (default last 90 days).',
    scope: 'finapp:read',
    input: { groupId: docId('Group'), ...groupWindow, limit, cursor },
    run: (args) =>
      client.query(api.mcp.listGroupMessages, {
        groupId: id<'groups'>(args.groupId),
        ...window(args),
        paginationOpts: page(args),
      }),
  }),
  defineTool({
    name: 'finapp.groups.messages.send',
    title: 'Send group message',
    description: 'Send a text message to a group chat.',
    scope: 'finapp:write:groups',
    input: { groupId: docId('Group'), text: z.string().min(1).max(4000) },
    run: (args) =>
      client.mutation(api.groups.mutations.sendChatText, {
        groupId: id<'groups'>(args.groupId),
        text: args.text,
      }),
  }),
  defineTool({
    name: 'finapp.groups.messages.pinned',
    title: 'Pinned group messages',
    description:
      'Pinned messages in a group chat plus your unread count and read position (epoch ms).',
    scope: 'finapp:read',
    input: { groupId: docId('Group') },
    run: async (args) => {
      const meta = await client.query(api.groups.queries.chatMeta, { groupId: args.groupId });
      if (!meta) throw new Error('NOT_MEMBER');
      return {
        pinned: meta.pinned,
        unreadCount: meta.unreadCount,
        myLastReadAt: meta.myLastReadAt,
        canPinAny: meta.canPinAny,
      };
    },
  }),
  defineTool({
    name: 'finapp.groups.messages.pin',
    title: 'Pin or unpin group message',
    description: 'Pin (or unpin) a group chat message. At most 20 pins per chat.',
    scope: 'finapp:write:groups',
    input: { messageId: docId('Group message'), pinned: z.boolean() },
    run: (args) =>
      client.mutation(api.groups.mutations.setChatMessagePinned, {
        messageId: id<'groupMessages'>(args.messageId),
        pinned: args.pinned,
      }),
  }),
  defineTool({
    name: 'finapp.groups.messages.react',
    title: 'React to group message',
    description: 'Toggle an emoji reaction on a group chat message.',
    scope: 'finapp:write:groups',
    input: { messageId: docId('Group message'), emoji: z.enum(['❤️', '👍', '😂', '😮']) },
    run: (args) =>
      client.mutation(api.groups.mutations.toggleChatReaction, {
        messageId: id<'groupMessages'>(args.messageId),
        emoji: args.emoji,
      }),
  }),
  defineTool({
    name: 'finapp.groups.messages.mark_read',
    title: 'Mark group chat read',
    description:
      'Mark a group chat read up to readAt (default now), clearing its unread count. Use after showing the user messages they asked about.',
    scope: 'finapp:write:groups',
    idempotent: true,
    input: {
      groupId: docId('Group'),
      readAt: timestamp.optional().describe('Mark messages up to this time read. Default: now.'),
    },
    run: (args) =>
      client.mutation(api.presence.mutations.markRead, {
        scopeType: 'group',
        scopeId: args.groupId,
        readAt: args.readAt ?? Date.now(),
      }),
  }),
  defineTool({
    name: 'finapp.groups.unread_counts',
    title: 'Unread group chats',
    description:
      'Unread message counts per group id (groups with no unread messages are omitted; capped at 99).',
    scope: 'finapp:read',
    input: {},
    run: async () => ({ counts: await client.query(api.groups.queries.chatUnreadCounts, {}) }),
  }),
  defineTool({
    name: 'finapp.groups.shared_history',
    title: 'Shared expenses with a person',
    description:
      'Expenses from every group you share with a person (by username), newest first; at most `limit` rows.',
    scope: 'finapp:read',
    input: { username: z.string().min(3).max(32), limit },
    run: async (args) => ({
      items: await client.query(api.groups.queries.personTimeline, {
        username: args.username,
        limit: args.limit,
      }),
    }),
  }),
];
