/**
 * Tools for `@finai` replies in a group chat or DM. They read only the shared ledger of groups
 * every participant belongs to (`chatContext.sharedLedger`), never the requester's private
 * data. Writes create confirmation cards only the requester can confirm; their own accounts
 * are picked when they confirm, in their own session.
 */
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { FinView } from './a2ui';
import { formatAbsMinor, formatMinor, shortDate } from './present';
import { amountMinor, date, oneOf, requiredStr, s, str, strList, ToolArgError } from './toolArgs';
import { propose, type FinaiTool, type FinaiToolCtx } from './toolContext';

export type ChatScopeInfo = {
  /** Everyone in the thread; ledger reads require all of them to be group members. */
  viewerIds: Id<'users'>[];
  /** The thread's own group (group chats) — the default for every tool. */
  groupId: string | null;
  /** Groups the DM participants share (DMs). */
  sharedGroupIds: string[];
};

type Ledger = NonNullable<Awaited<ReturnType<typeof loadLedger>>>;

async function loadLedger(ctx: FinaiToolCtx, info: ChatScopeInfo, args: Record<string, unknown>) {
  const groupId = str(args, 'groupId', 64) ?? info.groupId ?? info.sharedGroupIds[0];
  if (!groupId) throw new ToolArgError('NO_SHARED_GROUP');
  if (info.groupId ? groupId !== info.groupId : !info.sharedGroupIds.includes(groupId))
    throw new ToolArgError('GROUP_NOT_IN_THIS_CHAT');
  const ledger = await ctx.run.runQuery(internal.ai.chatContext.sharedLedger, {
    groupId,
    viewerIds: info.viewerIds,
  });
  if (!ledger) throw new ToolArgError('GROUP_NOT_IN_THIS_CHAT');
  return ledger;
}

function balancesView(ledger: Ledger): FinView {
  const currency = ledger.group.currency;
  return {
    kind: 'balances',
    title: ledger.group.name,
    subtitle: ledger.transfers.length
      ? `${ledger.transfers.length} transfer${ledger.transfers.length === 1 ? '' : 's'} settle everyone`
      : 'Everyone is settled up',
    members: ledger.members
      .filter((member) => member.current || member.amountMinor !== 0n)
      .map((member) => ({
        name: member.name,
        amount:
          member.amountMinor === 0n
            ? 'Settled'
            : `${member.amountMinor > 0n ? 'gets back' : 'owes'} ${formatAbsMinor(member.amountMinor, currency)}`,
        tone:
          member.amountMinor > 0n ? 'positive' : member.amountMinor < 0n ? 'negative' : 'neutral',
      })),
    transfers: ledger.transfers.map((transfer) => ({
      from: transfer.fromName,
      to: transfer.toName,
      amount: formatMinor(transfer.amountMinor, currency),
    })),
  };
}

const groupIdParam = s.string(
  'Group id. Omit in a group chat (defaults to this group); in a DM use one of the shared groups.',
);

export function chatTools(info: ChatScopeInfo): FinaiTool[] {
  return [
    {
      name: 'group_ledger',
      description:
        'The group’s balances (who owes whom, member user ids), the fewest transfers that settle everyone, recent expenses with who paid and each share, and recent settlements.',
      parameters: s.object({ groupId: groupIdParam }),
      progress: { stage: 'working', label: 'Reading the group ledger…' },
      run: async (ctx, args) => {
        const ledger = await loadLedger(ctx, info, args);
        if (ledger.status !== 'ready') return { data: ledger };
        return {
          data: { ...ledger, currency: ledger.group.currency },
          views: [balancesView(ledger)],
        };
      },
    },
    {
      name: 'recent_expenses',
      description: 'The group’s latest expenses as a list card, with who paid.',
      parameters: s.object({ groupId: groupIdParam }),
      progress: { stage: 'searching', label: 'Looking through expenses…' },
      run: async (ctx, args) => {
        const ledger = await loadLedger(ctx, info, args);
        const currency = ledger.group.currency;
        return {
          data: { currency, expenses: ledger.expenses },
          views: [
            {
              kind: 'transactions',
              title: `Recent in ${ledger.group.name}`,
              emptyText: 'No expenses yet.',
              items: ledger.expenses.map((expense) => ({
                id: expense.id,
                title: expense.title,
                subtitle: [
                  shortDate(expense.occurredAt, ctx.timeZone),
                  expense.paidBy.length
                    ? `paid by ${expense.paidBy.map((p) => p.name).join(', ')}`
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · '),
                amount: formatMinor(expense.amountMinor, currency),
                tone: 'neutral',
              })),
            },
          ],
        };
      },
    },
    {
      name: 'propose_group_expense',
      description:
        'Prepare a shared expense paid by the person who asked, split equally among participantIds (default: every current member). They must confirm it.',
      parameters: s.object(
        {
          groupId: groupIdParam,
          title: s.string('What it was for.'),
          amount: s.amount('Total paid.'),
          participantIds: s.ids('Member user ids sharing it (from group_ledger). Default all.'),
          date: s.date('When. Default today.'),
        },
        ['title', 'amount'],
      ),
      progress: { stage: 'working', label: 'Preparing the split…' },
      run: async (ctx, args) => {
        const ledger = await loadLedger(ctx, info, args);
        const current = ledger.members.filter((member) => member.current);
        const requested = strList(args, 'participantIds');
        const participants = requested.length
          ? current.filter((member) => requested.includes(member.userId))
          : current;
        if (!participants.length || (requested.length && participants.length !== requested.length))
          throw new ToolArgError('UNKNOWN_PARTICIPANT');
        const currency = ledger.group.currency;
        const total = amountMinor(args, 'amount', currency);
        if (total === undefined) throw new ToolArgError('MISSING_AMOUNT');
        const title = requiredStr(args, 'title', 120);
        const occurredAt = date(args, 'date') ?? Date.now();
        const me = String(ctx.userId);
        return propose(ctx, {
          kind: 'group.expense.create',
          title: `Split “${title}” in ${ledger.group.name}`,
          payload: {
            groupId: ledger.group.id,
            title,
            amountMinor: total,
            currency,
            participantIds: participants.map((member) => member.userId),
            occurredAt,
          },
          lines: [
            { label: 'Total', value: formatMinor(total, currency) },
            {
              label: 'Paid by',
              value: ledger.members.find((member) => member.userId === me)?.name ?? 'Requester',
            },
            { label: 'Split equally', value: participants.map((member) => member.name).join(', ') },
            { label: 'Date', value: shortDate(occurredAt, ctx.timeZone) },
          ],
        });
      },
    },
    {
      name: 'propose_settlement',
      description:
        'Prepare a settle-up payment between the person who asked and another member. direction "pay" = the asker pays them; "receive" = they paid the asker. Amount defaults to the suggested transfer. The asker must confirm it.',
      parameters: s.object(
        {
          groupId: groupIdParam,
          memberId: s.string('The other member’s user id.'),
          direction: s.enumOf('Who pays.', ['pay', 'receive']),
          amount: s.amount('Amount (optional).'),
        },
        ['memberId', 'direction'],
      ),
      progress: { stage: 'working', label: 'Preparing the settlement…' },
      run: async (ctx, args) => {
        const ledger = await loadLedger(ctx, info, args);
        const me = String(ctx.userId);
        const memberId = requiredStr(args, 'memberId', 64);
        const member = ledger.members.find((row) => row.userId === memberId);
        if (!member || memberId === me) throw new ToolArgError('UNKNOWN_MEMBER');
        const direction = oneOf(args, 'direction', ['pay', 'receive'] as const) ?? 'pay';
        const fromUserId = direction === 'pay' ? me : memberId;
        const toUserId = direction === 'pay' ? memberId : me;
        const currency = ledger.group.currency;
        const suggested = ledger.transfers.find(
          (transfer) => transfer.fromUserId === fromUserId && transfer.toUserId === toUserId,
        );
        const total = amountMinor(args, 'amount', currency) ?? suggested?.amountMinor;
        if (!total) throw new ToolArgError('NOTHING_OWED');
        const myName = ledger.members.find((row) => row.userId === me)?.name ?? 'Requester';
        return propose(ctx, {
          kind: 'settlement.create',
          title: `${direction === 'pay' ? myName : member.name} pays ${direction === 'pay' ? member.name : myName}`,
          payload: { groupId: ledger.group.id, fromUserId, toUserId, amountMinor: total, currency },
          lines: [
            { label: 'Group', value: ledger.group.name },
            { label: 'Amount', value: formatMinor(total, currency) },
          ],
        });
      },
    },
    {
      name: 'propose_reminder',
      description:
        'Prepare a payment reminder from the person who asked to a member who owes them. They must confirm it.',
      parameters: s.object(
        { groupId: groupIdParam, memberId: s.string('Member user id who owes the asker.') },
        ['memberId'],
      ),
      progress: { stage: 'working', label: 'Preparing the reminder…' },
      run: async (ctx, args) => {
        const ledger = await loadLedger(ctx, info, args);
        const me = String(ctx.userId);
        const memberId = requiredStr(args, 'memberId', 64);
        const member = ledger.members.find((row) => row.userId === memberId);
        if (!member || memberId === me) throw new ToolArgError('UNKNOWN_MEMBER');
        const owed = ledger.transfers.find(
          (transfer) => transfer.fromUserId === memberId && transfer.toUserId === me,
        );
        if (!owed) throw new ToolArgError('NOTHING_OWED');
        return propose(ctx, {
          kind: 'group.nudge',
          title: `Remind ${member.name}`,
          payload: { groupId: ledger.group.id, userId: memberId },
          lines: [
            { label: 'Group', value: ledger.group.name },
            { label: 'Owes', value: formatMinor(owed.amountMinor, ledger.group.currency) },
          ],
        });
      },
    },
  ];
}
