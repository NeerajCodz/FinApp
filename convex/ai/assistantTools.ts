/**
 * Tools for the in-app FinAI assistant. They run inside the user's own action, so every read
 * goes through the same public Convex queries the app and the MCP plugin use, with the user's
 * auth: FinAI can never see more than the user can. Writes only create confirmation cards.
 */
import { api } from '../_generated/api';
import type { FunctionReturnType } from 'convex/server';
import type { Id } from '../_generated/dataModel';
import type { FinView, ListItem, Tone } from './a2ui';
import { formatAbsMinor, formatMinor, shortDate } from './present';
import {
  amountMinor,
  date,
  int,
  oneOf,
  requiredStr,
  s,
  str,
  strList,
  ToolArgError,
  window,
} from './toolArgs';
import { propose, type FinaiTool, type FinaiToolCtx } from './toolContext';

const DAY = 86_400_000;
const transactionTypes = ['expense', 'income', 'transfer', 'refund', 'adjustment'] as const;

const toneForType = (type: string): Tone =>
  type === 'income' || type === 'refund' ? 'positive' : type === 'expense' ? 'negative' : 'neutral';

/** Raw 100-row pages `search_transactions` may scan for matches. */
const SEARCH_MAX_PAGES = 10;

function transactionItem(
  row: {
    id: string;
    title: string;
    type: string;
    amountMinor: bigint;
    currency: string;
    occurredAt: number;
    merchant?: string;
  },
  timeZone: string,
): ListItem {
  return {
    id: String(row.id),
    title: row.title,
    subtitle: [shortDate(row.occurredAt, timeZone), row.merchant].filter(Boolean).join(' · '),
    amount: `${row.type === 'expense' ? '−' : row.type === 'income' ? '+' : ''}${formatMinor(row.amountMinor, row.currency)}`,
    tone: toneForType(row.type),
  };
}

async function accounts(ctx: FinaiToolCtx) {
  return ctx.run.runQuery(api.accounts.queries.list, {});
}

async function groupContext(ctx: FinaiToolCtx, groupId: string) {
  const [group, balances] = await Promise.all([
    ctx.run.runQuery(api.mcp.groupSummary, { groupId: groupId as Id<'groups'> }),
    ctx.run.runQuery(api.groups.queries.balances, { groupId }),
  ]);
  if (!balances) throw new ToolArgError('NOT_MEMBER');
  return { group, balances };
}

function balanceView(
  title: string,
  meId: string,
  balances: {
    currency: string;
    members: { userId: string; displayName: string; amountMinor: bigint }[];
    transfers: { fromUserId: string; toUserId: string; amountMinor: bigint }[];
  },
): FinView {
  const names = new Map(balances.members.map((member) => [member.userId, member.displayName]));
  const label = (userId: string) =>
    userId === meId ? 'You' : (names.get(userId) ?? 'Former member');
  return {
    kind: 'balances',
    title,
    subtitle: balances.transfers.length
      ? `${balances.transfers.length} transfer${balances.transfers.length === 1 ? '' : 's'} settle everyone`
      : 'Everyone is settled up',
    members: balances.members.map((member) => ({
      name: label(member.userId),
      amount:
        member.amountMinor === 0n
          ? 'Settled'
          : `${member.amountMinor > 0n ? 'gets back' : 'owes'} ${formatAbsMinor(member.amountMinor, balances.currency)}`,
      tone: member.amountMinor > 0n ? 'positive' : member.amountMinor < 0n ? 'negative' : 'neutral',
    })),
    transfers: balances.transfers.map((transfer) => ({
      from: label(transfer.fromUserId),
      to: label(transfer.toUserId),
      amount: formatMinor(transfer.amountMinor, balances.currency),
    })),
  };
}

export const assistantTools: FinaiTool[] = [
  {
    name: 'get_overview',
    description:
      'Snapshot of the user’s money: income, spending and net over the last N days (default 30) in their default currency, total balance per currency across accounts, category limit usage this month and the latest transactions.',
    parameters: s.object({ days: s.integer('Window length in days (1-366). Default 30.', 1, 366) }),
    progress: { stage: 'searching', label: 'Reading your overview…' },
    run: async (ctx, args) => {
      const days = int(args, 'days', 30, 1, 366);
      const endAt = Date.now();
      const range = { startAt: endAt - days * DAY, endAt };
      const [summary, accountRows, limits] = await Promise.all([
        ctx.run.runQuery(api.dashboard.queries.summary, range),
        accounts(ctx),
        ctx.run.runQuery(api.categories.queries.limits, {}),
      ]);
      const currency = summary?.currency ?? ctx.defaultCurrency;
      const income = summary?.incomeMinor ?? 0n;
      const spent = summary?.spentMinor ?? 0n;
      const totals = new Map<string, bigint>();
      for (const account of accountRows)
        if (account.isIncludedInTotal)
          totals.set(account.currency, (totals.get(account.currency) ?? 0n) + account.balanceMinor);
      const views: FinView[] = [
        {
          kind: 'summary',
          title: `Last ${days} days`,
          subtitle: [...totals]
            .map(([code, value]) => `Balance ${formatMinor(value, code)}`)
            .join(' · '),
          metrics: [
            { label: 'Income', value: formatMinor(income, currency), tone: 'positive' },
            { label: 'Spent', value: formatMinor(spent, currency), tone: 'negative' },
            {
              label: 'Net',
              value: formatMinor(income - spent, currency),
              tone: income >= spent ? 'positive' : 'negative',
            },
          ],
        },
      ];
      if (limits.length)
        views.push({
          kind: 'progress',
          title: 'Category limits',
          items: limits.slice(0, 6).map((limit) => ({
            label: limit.name,
            progress: limit.percentUsed / 100,
            detail: `${formatMinor(limit.spentMinor, limit.currency)} of ${formatMinor(limit.limitMinor, limit.currency)}`,
            tone: limit.spentMinor > limit.limitMinor ? 'negative' : 'accent',
          })),
        });
      return {
        data: {
          window: { days, ...range },
          currency,
          incomeMinor: income,
          spentMinor: spent,
          netMinor: income - spent,
          totals: [...totals].map(([code, balanceMinor]) => ({ currency: code, balanceMinor })),
          accounts: accountRows.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            currency: account.currency,
            balanceMinor: account.balanceMinor,
          })),
          categoryLimits: limits.map((limit) => ({
            categoryId: limit.categoryId,
            name: limit.name,
            currency: limit.currency,
            limitMinor: limit.limitMinor,
            spentMinor: limit.spentMinor,
            remainingMinor: limit.remainingMinor,
          })),
          recent: (summary?.recent ?? []).map((row) => ({
            id: row._id,
            title: row.title,
            type: row.type,
            currency: row.currency,
            amountMinor: row.amountMinor,
            occurredAt: row.occurredAt,
          })),
        },
        views,
      };
    },
  },
  {
    name: 'search_transactions',
    description:
      'Search the user’s past personal transactions by text (title, merchant, note, line items), type, date window (default last 30 days, max 366) and amount range. Returns up to `limit` rows newest first, with line items.',
    parameters: s.object({
      query: s.string('Free text, e.g. "uber" or "pizza".'),
      type: s.enumOf('Transaction kind.', [...transactionTypes]),
      from: s.date('Inclusive start date.'),
      to: s.date('Inclusive end date.'),
      minAmount: s.amount('Smallest amount.'),
      maxAmount: s.amount('Largest amount.'),
      limit: s.integer('Rows to return (1-50). Default 20.', 1, 50),
      cursor: s.string(
        'Pass the `cursor` from a previous result to keep searching older transactions.',
      ),
    }),
    progress: { stage: 'searching', label: 'Searching your transactions…' },
    run: async (ctx, args) => {
      const range = window(args, 30);
      const currency = ctx.defaultCurrency;
      const limit = int(args, 'limit', 20, 1, 50);
      const filters = {
        ...range,
        type: oneOf(args, 'type', transactionTypes),
        search: str(args, 'query', 120),
        minAmountMinor: amountMinor(args, 'minAmount', currency),
        maxAmountMinor: amountMinor(args, 'maxAmount', currency),
      };
      // Filters apply after pagination, so walk raw pages until enough rows match.
      type Row = FunctionReturnType<typeof api.mcp.listTransactions>['items'][number];
      const items: Row[] = [];
      let cursor: string | null = str(args, 'cursor', 2000) ?? null;
      let isDone = false;
      for (let page = 0; page < SEARCH_MAX_PAGES && items.length < limit && !isDone; page++) {
        const result: FunctionReturnType<typeof api.mcp.listTransactions> = await ctx.run.runQuery(
          api.mcp.listTransactions,
          {
            ...filters,
            paginationOpts: { numItems: 100, cursor },
          },
        );
        items.push(...result.items);
        cursor = result.nextCursor;
        isDone = result.isDone;
      }
      // Stopped at the page budget with source left: hand back a cursor to continue from.
      const result = {
        items: items.slice(0, limit),
        isDone: isDone && items.length <= limit,
        cursor: !isDone && items.length < limit ? cursor : null,
      };
      return {
        data: {
          window: range,
          items: result.items,
          more: !result.isDone,
          ...(result.cursor
            ? {
                cursor: result.cursor,
                note: 'Only part of the history was searched. Call again with this cursor to continue.',
              }
            : {}),
        },
        views: [
          {
            kind: 'transactions',
            title: str(args, 'query') ? `Matches for “${str(args, 'query', 40)}”` : 'Transactions',
            emptyText: 'No transactions match.',
            items: result.items.map((row) =>
              transactionItem({ ...row, id: String(row.id), merchant: row.merchant }, ctx.timeZone),
            ),
          },
        ],
      };
    },
  },
  {
    name: 'spending_breakdown',
    description:
      'Spending and income for the trailing week, month or year in the default currency, broken down by category, merchant and account, with the previous period’s spending for comparison.',
    parameters: s.object(
      { period: s.enumOf('Window length ending now.', ['week', 'month', 'year']) },
      ['period'],
    ),
    progress: { stage: 'working', label: 'Crunching your spending…' },
    run: async (ctx, args) => {
      const period = oneOf(args, 'period', ['week', 'month', 'year'] as const) ?? 'month';
      const length = { week: 7, month: 30, year: 365 }[period] * DAY;
      const endAt = Date.now();
      const startAt = endAt - length;
      const result = await ctx.run.runQuery(api.analytics.queries.summary, {
        period,
        startAt,
        endAt,
        previousStartAt: startAt - length,
      });
      if (!result) throw new ToolArgError('AUTH_REQUIRED');
      const categories = result.categoryBreakdown.slice(0, 8);
      return {
        data: {
          period,
          currency: result.currency,
          spentMinor: result.spentMinor,
          incomeMinor: result.incomeMinor,
          previousSpentMinor: result.previousSpentMinor,
          categories: result.categoryBreakdown.slice(0, 12),
          merchants: result.merchantBreakdown.slice(0, 8),
          accounts: result.accountBreakdown.slice(0, 8),
        },
        views: [
          {
            kind: 'summary',
            title: `This ${period}`,
            subtitle: `Previous ${period}: ${formatMinor(result.previousSpentMinor, result.currency)} spent`,
            metrics: [
              {
                label: 'Spent',
                value: formatMinor(result.spentMinor, result.currency),
                tone: 'negative',
              },
              {
                label: 'Income',
                value: formatMinor(result.incomeMinor, result.currency),
                tone: 'positive',
              },
            ],
          },
          ...(categories.length
            ? [
                {
                  kind: 'bars' as const,
                  title: 'By category',
                  bars: categories.map((item) => ({
                    label: item.label,
                    value: Number(item.amountMinor),
                    display: formatMinor(item.amountMinor, result.currency),
                  })),
                },
              ]
            : []),
        ],
      };
    },
  },
  {
    name: 'list_accounts',
    description: 'The user’s active accounts with ids, types, currencies and balances.',
    progress: { stage: 'searching', label: 'Checking your accounts…' },
    run: async (ctx) => {
      const rows = await accounts(ctx);
      return {
        data: {
          items: rows.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            currency: account.currency,
            balanceMinor: account.balanceMinor,
            includedInTotal: account.isIncludedInTotal,
          })),
        },
        views: [
          {
            kind: 'transactions',
            title: 'Accounts',
            emptyText: 'No accounts yet.',
            items: rows.map((account) => ({
              id: String(account.id),
              title: account.name,
              subtitle: account.type,
              amount: formatMinor(account.balanceMinor, account.currency),
              tone: account.balanceMinor < 0n ? 'negative' : 'neutral',
            })),
          },
        ],
      };
    },
  },
  {
    name: 'list_categories',
    description: 'The user’s categories with ids (needed to file a new transaction).',
    progress: { stage: 'searching', label: 'Looking at categories…' },
    run: async (ctx) => {
      const rows = await ctx.run.runQuery(api.categories.queries.list, {});
      return {
        data: { items: rows.map((row) => ({ id: row._id, name: row.name, icon: row.icon })) },
      };
    },
  },
  {
    name: 'list_category_limits',
    description:
      'Category limits (each category’s monthly budget) with this month’s spent, remaining, percent used and alert level. Budgets are category limits.',
    progress: { stage: 'searching', label: 'Checking category limits…' },
    run: async (ctx) => {
      const rows = await ctx.run.runQuery(api.categories.queries.limits, {});
      return {
        data: {
          items: rows.map((limit) => ({
            categoryId: limit.categoryId,
            name: limit.name,
            currency: limit.currency,
            limitMinor: limit.limitMinor,
            spentMinor: limit.spentMinor,
            remainingMinor: limit.remainingMinor,
            percentUsed: limit.percentUsed,
            alertPercent: limit.alertPercent,
            status: limit.status,
          })),
        },
        views: rows.length
          ? [
              {
                kind: 'progress',
                title: 'Category limits',
                items: rows.slice(0, 8).map((limit) => ({
                  label: limit.name,
                  progress: limit.percentUsed / 100,
                  detail: `${formatMinor(limit.remainingMinor, limit.currency)} left`,
                  tone: limit.remainingMinor < 0n ? 'negative' : 'accent',
                })),
              },
            ]
          : [],
      };
    },
  },
  {
    name: 'list_goals',
    description: 'Active savings goals with ids, targets and target dates.',
    progress: { stage: 'searching', label: 'Checking goals…' },
    run: async (ctx) => {
      const result = await ctx.run.runQuery(api.mcp.listOwnedRecords, {
        resource: 'goals',
        paginationOpts: { numItems: 50, cursor: null },
      });
      return { data: result };
    },
  },
  {
    name: 'list_groups',
    description: 'Groups the user belongs to, with ids and currencies.',
    progress: { stage: 'searching', label: 'Looking at your groups…' },
    run: async (ctx) => {
      const result = await ctx.run.runQuery(api.mcp.listGroups, {
        paginationOpts: { numItems: 50, cursor: null },
      });
      return { data: result };
    },
  },
  {
    name: 'group_balances',
    description:
      'Who owes whom in one group: each member’s net balance (positive = gets money back) and the fewest transfers that settle everyone. Members include user ids.',
    parameters: s.object({ groupId: s.string('Group id from list_groups.') }, ['groupId']),
    progress: { stage: 'working', label: 'Working out balances…' },
    run: async (ctx, args) => {
      const groupId = requiredStr(args, 'groupId', 64);
      const { group, balances } = await groupContext(ctx, groupId);
      const meId = String(ctx.userId);
      return {
        data: { group: { id: group.id, name: group.name }, meId, ...balances },
        views: balances.status === 'ready' ? [balanceView(group.name, meId, balances)] : [],
      };
    },
  },
  {
    name: 'group_expenses',
    description: 'Recent expenses in one group (default last 90 days), newest first.',
    parameters: s.object(
      {
        groupId: s.string('Group id.'),
        from: s.date('Inclusive start date.'),
        to: s.date('Inclusive end date.'),
        limit: s.integer('Rows (1-50). Default 15.', 1, 50),
      },
      ['groupId'],
    ),
    progress: { stage: 'searching', label: 'Reading group expenses…' },
    run: async (ctx, args) => {
      const groupId = requiredStr(args, 'groupId', 64);
      const result = await ctx.run.runQuery(api.mcp.listGroupExpenses, {
        groupId: groupId as Id<'groups'>,
        ...window(args, 90),
        paginationOpts: { numItems: int(args, 'limit', 15, 1, 50), cursor: null },
      });
      return {
        data: result,
        views: [
          {
            kind: 'transactions',
            title: 'Group expenses',
            emptyText: 'No expenses in this window.',
            items: result.items.map((row) =>
              transactionItem({ ...row, id: String(row.id), type: 'expense' }, ctx.timeZone),
            ),
          },
        ],
      };
    },
  },
  {
    name: 'list_friends',
    description: 'The user’s friends with user ids and usernames.',
    progress: { stage: 'searching', label: 'Looking up friends…' },
    run: async (ctx) => {
      const rows = await ctx.run.runQuery(api.social.queries.friends, {});
      return { data: { items: rows } };
    },
  },

  // ---------- Writes: each only creates a confirmation card ----------
  {
    name: 'propose_transaction',
    description:
      'Prepare a new personal transaction for the user to confirm. Uses their default account in the currency unless accountId is given. Never say it is saved: the user must press Confirm.',
    parameters: s.object(
      {
        title: s.string('Short description, e.g. "Groceries".'),
        amount: s.amount('Total amount.'),
        type: s.enumOf('Kind. Default expense.', ['expense', 'income']),
        currency: s.string('ISO code. Default: the user’s default currency.'),
        accountId: s.string('Account id from list_accounts (optional).'),
        categoryId: s.string('Category id from list_categories (optional).'),
        merchant: s.string('Merchant (optional).'),
        note: s.string('Note (optional).'),
        date: s.date('When it happened. Default today.'),
      },
      ['title', 'amount'],
    ),
    progress: { stage: 'working', label: 'Preparing the transaction…' },
    run: async (ctx, args) => {
      const currency = (str(args, 'currency', 3) ?? ctx.defaultCurrency).toUpperCase();
      const total = amountMinor(args, 'amount', currency);
      if (total === undefined) throw new ToolArgError('MISSING_AMOUNT');
      const type = oneOf(args, 'type', ['expense', 'income'] as const) ?? 'expense';
      const title = requiredStr(args, 'title', 120);
      const occurredAt = date(args, 'date') ?? Date.now();
      const accountRows = await accounts(ctx);
      const accountId = str(args, 'accountId', 64);
      const account = accountId
        ? accountRows.find((row) => String(row.id) === accountId)
        : undefined;
      if (accountId && !account) throw new ToolArgError('ACCOUNT_NOT_FOUND');
      if (account && account.currency !== currency) throw new ToolArgError('CURRENCY_MISMATCH');
      return propose(ctx, {
        kind: 'transaction.create',
        title: `Add ${type}: ${title}`,
        payload: {
          type,
          title,
          amountMinor: total,
          currency,
          occurredAt,
          ...(account ? { accountId: account.id } : {}),
          ...(str(args, 'categoryId', 64) ? { categoryId: str(args, 'categoryId', 64) } : {}),
          ...(str(args, 'merchant') ? { merchant: str(args, 'merchant') } : {}),
          ...(str(args, 'note', 500) ? { note: str(args, 'note', 500) } : {}),
        },
        lines: [
          { label: 'Amount', value: formatMinor(total, currency) },
          { label: 'Account', value: account?.name ?? `Default ${currency} account` },
          { label: 'Date', value: shortDate(occurredAt, ctx.timeZone) },
          ...(str(args, 'merchant') ? [{ label: 'Merchant', value: str(args, 'merchant')! }] : []),
        ],
      });
    },
  },
  {
    name: 'propose_group_expense',
    description:
      'Prepare a shared expense the user paid in a group, split equally among participantIds (default: every member). The user must confirm it.',
    parameters: s.object(
      {
        groupId: s.string('Group id.'),
        title: s.string('What it was for.'),
        amount: s.amount('Total paid.'),
        participantIds: s.ids('Member user ids sharing it (from group_balances). Default all.'),
        note: s.string('Note (optional).'),
        date: s.date('When. Default today.'),
      },
      ['groupId', 'title', 'amount'],
    ),
    progress: { stage: 'working', label: 'Preparing the split…' },
    run: async (ctx, args) => {
      const groupId = requiredStr(args, 'groupId', 64);
      const { group, balances } = await groupContext(ctx, groupId);
      const current = balances.members.filter((member) => member.current);
      const requested = strList(args, 'participantIds');
      const participants = requested.length
        ? current.filter((member) => requested.includes(member.userId))
        : current;
      if (!participants.length || (requested.length && participants.length !== requested.length))
        throw new ToolArgError('UNKNOWN_PARTICIPANT');
      const total = amountMinor(args, 'amount', group.currency);
      if (total === undefined) throw new ToolArgError('MISSING_AMOUNT');
      const title = requiredStr(args, 'title', 120);
      const occurredAt = date(args, 'date') ?? Date.now();
      return propose(ctx, {
        kind: 'group.expense.create',
        title: `Split “${title}” in ${group.name}`,
        payload: {
          groupId,
          title,
          amountMinor: total,
          currency: group.currency,
          participantIds: participants.map((member) => member.userId),
          occurredAt,
          ...(str(args, 'note', 500) ? { note: str(args, 'note', 500) } : {}),
        },
        lines: [
          { label: 'Total', value: formatMinor(total, group.currency) },
          { label: 'Paid by', value: 'You' },
          {
            label: 'Split equally',
            value: participants
              .map((member) => (member.userId === String(ctx.userId) ? 'You' : member.displayName))
              .join(', '),
          },
          { label: 'Date', value: shortDate(occurredAt, ctx.timeZone) },
        ],
      });
    },
  },
  {
    name: 'propose_settlement',
    description:
      'Prepare a settle-up payment between the user and another member of a group. direction "pay" = the user pays them; "receive" = they paid the user. Amount defaults to the suggested transfer between the two. The user must confirm it.',
    parameters: s.object(
      {
        groupId: s.string('Group id.'),
        memberId: s.string('The other member’s user id.'),
        direction: s.enumOf('Who pays.', ['pay', 'receive']),
        amount: s.amount('Amount (optional).'),
        note: s.string('Note, e.g. a UPI reference (optional).'),
      },
      ['groupId', 'memberId', 'direction'],
    ),
    progress: { stage: 'working', label: 'Preparing the settlement…' },
    run: async (ctx, args) => settlementProposal(ctx, args),
  },
  {
    name: 'propose_goal_contribution',
    description: 'Prepare money added toward a savings goal. The user must confirm it.',
    parameters: s.object(
      { goalId: s.string('Goal id from list_goals.'), amount: s.amount('Amount saved.') },
      ['goalId', 'amount'],
    ),
    progress: { stage: 'working', label: 'Preparing the contribution…' },
    run: async (ctx, args) => {
      const goalId = requiredStr(args, 'goalId', 64);
      const goals = await ctx.run.runQuery(api.mcp.listOwnedRecords, {
        resource: 'goals',
        paginationOpts: { numItems: 100, cursor: null },
      });
      const goal = (goals.items as { id: string; name: string; currency: string }[]).find(
        (row) => String(row.id) === goalId,
      );
      if (!goal) throw new ToolArgError('GOAL_NOT_FOUND');
      const total = amountMinor(args, 'amount', goal.currency);
      if (total === undefined) throw new ToolArgError('MISSING_AMOUNT');
      return propose(ctx, {
        kind: 'goal.contribute',
        title: `Save toward ${goal.name}`,
        payload: { goalId, amountMinor: total },
        lines: [
          { label: 'Goal', value: goal.name },
          { label: 'Amount', value: formatMinor(total, goal.currency) },
        ],
      });
    },
  },
  {
    name: 'propose_reminder',
    description:
      'Prepare a payment reminder to a group member who owes the user. Allowed once per member per day. The user must confirm it.',
    parameters: s.object(
      { groupId: s.string('Group id.'), memberId: s.string('Member user id who owes the user.') },
      ['groupId', 'memberId'],
    ),
    progress: { stage: 'working', label: 'Preparing the reminder…' },
    run: async (ctx, args) => {
      const groupId = requiredStr(args, 'groupId', 64);
      const memberId = requiredStr(args, 'memberId', 64);
      const { group, balances } = await groupContext(ctx, groupId);
      const member = balances.members.find((row) => row.userId === memberId);
      if (!member || memberId === String(ctx.userId)) throw new ToolArgError('UNKNOWN_MEMBER');
      const owed = balances.transfers.find(
        (transfer) => transfer.fromUserId === memberId && transfer.toUserId === String(ctx.userId),
      );
      if (!owed) throw new ToolArgError('NOTHING_OWED');
      return propose(ctx, {
        kind: 'group.nudge',
        title: `Remind ${member.displayName}`,
        payload: { groupId, userId: memberId },
        lines: [
          { label: 'Group', value: group.name },
          { label: 'They owe you', value: formatMinor(owed.amountMinor, balances.currency) },
        ],
      });
    },
  },
];

async function settlementProposal(ctx: FinaiToolCtx, args: Record<string, unknown>) {
  const groupId = requiredStr(args, 'groupId', 64);
  const memberId = requiredStr(args, 'memberId', 64);
  const direction = oneOf(args, 'direction', ['pay', 'receive'] as const) ?? 'pay';
  const { group, balances } = await groupContext(ctx, groupId);
  const meId = String(ctx.userId);
  const member = balances.members.find((row) => row.userId === memberId);
  if (!member || memberId === meId) throw new ToolArgError('UNKNOWN_MEMBER');
  const fromUserId = direction === 'pay' ? meId : memberId;
  const toUserId = direction === 'pay' ? memberId : meId;
  const suggested = balances.transfers.find(
    (transfer) => transfer.fromUserId === fromUserId && transfer.toUserId === toUserId,
  );
  const total = amountMinor(args, 'amount', balances.currency) ?? suggested?.amountMinor;
  if (!total) throw new ToolArgError('NOTHING_OWED');
  return propose(ctx, {
    kind: 'settlement.create',
    title:
      direction === 'pay' ? `Pay ${member.displayName}` : `Record ${member.displayName} paid you`,
    payload: {
      groupId,
      fromUserId,
      toUserId,
      amountMinor: total,
      currency: balances.currency,
      ...(str(args, 'note', 300) ? { note: str(args, 'note', 300) } : {}),
    },
    lines: [
      { label: 'Group', value: group.name },
      { label: 'Amount', value: formatMinor(total, balances.currency) },
      {
        label: 'From → to',
        value: `${direction === 'pay' ? 'You' : member.displayName} → ${direction === 'pay' ? member.displayName : 'You'}`,
      },
    ],
  });
}
