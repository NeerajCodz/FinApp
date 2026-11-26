/**
 * The original five widgets (overview, transactions, group balances, expense detail, settle-up).
 * Their ids and URIs predate the `<domain>.<name>` scheme and stay unchanged so existing tool
 * links keep working. Data contracts match the existing MCP tool results.
 */
import { CUR, DAY, NOW, daysAgo } from '../sample';
import { defineWidget, type Minor } from '../types';

type Tx = {
  id: string;
  title: string;
  type: string;
  amountMinor: Minor;
  amountFormatted?: string;
  currency: string;
  merchant?: string;
  occurredAt: number;
  items?: Array<{
    id?: string;
    title: string;
    amountMinor: Minor;
    quantity?: number;
    participantIds?: string[];
  }>;
};

type Overview = {
  period?: { startAt: number; endAt: number };
  currency: string;
  incomeMinor: Minor;
  spentMinor: Minor;
  netMinor: Minor;
  spendingTrend?: number[];
  totals?: Array<{ currency: string; balanceMinor: Minor }>;
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    balanceMinor: Minor;
    isIncludedInTotal?: boolean;
  }>;
  budgets?: Array<{
    id: string;
    name: string;
    currency: string;
    amountMinor: Minor;
    spentMinor: Minor;
    remainingMinor?: Minor;
    progress?: number;
  }>;
  recent?: Tx[];
};

export const overview = defineWidget<Overview>({
  id: 'overview',
  name: 'overview',
  domain: 'core',
  uri: 'ui://finapp/overview.v1.html',
  title: 'Financial overview',
  description:
    'Net, income and spending for the period, account balances and category limit progress.',
  invoking: 'Gathering your accounts…',
  invoked: 'Overview ready',
  examples: [
    {
      period: { startAt: NOW - 30 * DAY, endAt: NOW },
      currency: CUR,
      incomeMinor: 9_500_000,
      spentMinor: 4_218_050,
      netMinor: 5_281_950,
      spendingTrend: [82000, 146000, 64000, 221000, 98000, 175000, 112000, 160000],
      totals: [{ currency: CUR, balanceMinor: 18_742_300 }],
      accounts: [
        {
          id: 'a1',
          name: 'HDFC Savings',
          type: 'bank',
          currency: CUR,
          balanceMinor: 15_420_000,
          isIncludedInTotal: true,
        },
        {
          id: 'a2',
          name: 'Cash',
          type: 'cash',
          currency: CUR,
          balanceMinor: 322_300,
          isIncludedInTotal: true,
        },
        {
          id: 'a3',
          name: 'Credit card',
          type: 'card',
          currency: CUR,
          balanceMinor: -1_200_000,
          isIncludedInTotal: true,
        },
      ],
      budgets: [
        {
          id: 'b1',
          name: 'Food & dining',
          currency: CUR,
          amountMinor: 1_200_000,
          spentMinor: 845_000,
          progress: 0.704,
        },
        {
          id: 'b2',
          name: 'Transport',
          currency: CUR,
          amountMinor: 400_000,
          spentMinor: 436_500,
          progress: 1.091,
        },
      ],
      recent: [
        {
          id: 'r1',
          title: 'Blue Tokai',
          type: 'expense',
          amountMinor: 42_000,
          currency: CUR,
          occurredAt: daysAgo(1),
        },
        {
          id: 'r2',
          title: 'Salary',
          type: 'income',
          amountMinor: 9_500_000,
          currency: CUR,
          occurredAt: daysAgo(3),
        },
      ],
    },
  ],
  empty: { currency: CUR, incomeMinor: 0, spentMinor: 0, netMinor: 0 },
  render: (d, k) => {
    const accounts = k.arr(d.accounts);
    const limits = k.arr(d.budgets);
    const recent = k.arr(d.recent);
    const trend = k.arr(d.spendingTrend);
    const net = k.num(d.netMinor);
    const nothing =
      !accounts.length && !recent.length && !k.num(d.incomeMinor) && !k.num(d.spentMinor);
    const period = d.period
      ? k.date(d.period.startAt, 'day') + ' – ' + k.date(d.period.endAt, 'day')
      : 'This period';
    if (nothing)
      return k.page(
        k.header('Overview', period),
        k.empty(
          'Nothing here yet',
          'Add an account or a transaction to see your overview.',
          'wallet',
        ),
      );
    return k.page(
      k.header('Overview', period),
      k.hero({
        label: 'Net this period',
        value: k.amount(d, 'net') || k.money(net, d.currency, { sign: true }),
        tone: k.toneOf(net),
        chart:
          trend.length > 1 ? k.sparkline(trend, { tone: 'accent', height: 44, bars: true }) : '',
      }),
      k.stats([
        { label: 'Income', value: k.amount(d, 'income'), tone: 'income' },
        { label: 'Spent', value: k.amount(d, 'spent'), tone: 'expense' },
        ...k
          .arr(d.totals)
          .map((t) => ({ label: 'Balance ' + t.currency, value: k.amount(t, 'balance') })),
      ]),
      accounts.length
        ? k.section(
            'Accounts',
            k.list(
              accounts.map((a) =>
                k.row({
                  lead: k.accountIcon(a.type),
                  title: a.name,
                  sub: a.type + (a.isIncludedInTotal === false ? ' · excluded from total' : ''),
                  value: k.amount(a, 'balance'),
                  valueTone: k.num(a.balanceMinor) < 0 ? 'expense' : null,
                }),
              ),
            ),
          )
        : '',
      limits.length
        ? k.section(
            'Category limits',
            k.card(
              limits
                .map((b) =>
                  k.meter({
                    label: b.name,
                    value: k.num(b.spentMinor),
                    max: k.num(b.amountMinor),
                    valueText: k.amount(b, 'spent'),
                    maxText: k.amount(b, 'amount'),
                  }),
                )
                .join(''),
            ),
          )
        : '',
      recent.length ? k.section('Recent', k.txList(recent)) : '',
    );
  },
});

type TxPage = { items?: Tx[]; nextCursor?: string | null; isDone?: boolean };

export const transactions = defineWidget<TxPage>({
  id: 'transactions',
  name: 'transactions',
  domain: 'core',
  uri: 'ui://finapp/transactions.v1.html',
  title: 'Transactions',
  description: 'A transaction list with expandable line items.',
  invoking: 'Searching transactions…',
  invoked: 'Transactions ready',
  examples: [
    {
      items: [
        {
          id: 't1',
          title: 'Big Basket',
          type: 'expense',
          amountMinor: 186_000,
          currency: CUR,
          merchant: 'BigBasket',
          occurredAt: daysAgo(1),
          items: [
            { id: 'i1', title: 'Coffee beans', amountMinor: 96_000, quantity: 2 },
            { id: 'i2', title: 'Oat milk', amountMinor: 54_000, quantity: 3 },
            { id: 'i3', title: 'Bananas', amountMinor: 36_000 },
          ],
        },
        {
          id: 't2',
          title: 'Uber to airport',
          type: 'expense',
          amountMinor: 74_350,
          currency: CUR,
          merchant: 'Uber',
          occurredAt: daysAgo(2),
        },
        {
          id: 't3',
          title: 'Refund — headphones',
          type: 'refund',
          amountMinor: 549_900,
          currency: CUR,
          occurredAt: daysAgo(4),
        },
      ],
      nextCursor: 'preview',
      isDone: false,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items);
    return k.page(
      k.header(
        'Transactions',
        k.plural(items.length, 'result'),
        d.isDone === false ? k.pill('More available') : '',
      ),
      k.txList(
        items,
        'No transactions match these filters',
        'Try a wider date range or fewer filters.',
      ),
      d.isDone === false ? k.note('Ask for the next page to continue.') : '',
    );
  },
});

type Balances = {
  group?: { id: string; name: string; currency?: string };
  currency: string;
  status?: string;
  myBalanceMinor?: Minor;
  members?: Array<{ userId: string; displayName: string; amountMinor: Minor; isMe?: boolean }>;
  transfers?: Array<{
    fromUserId: string;
    fromName: string;
    toUserId: string;
    toName: string;
    amountMinor: Minor;
    direction?: string;
  }>;
  accounts?: Array<{ id: string; name: string; currency: string; balanceMinor: Minor }>;
};

const goa = { id: 'preview-group', name: 'Goa trip', currency: CUR };

export const groupBalances = defineWidget<Balances>({
  id: 'groupBalances',
  name: 'groupBalances',
  domain: 'core',
  uri: 'ui://finapp/group-balances.v1.html',
  title: 'Group balances',
  description: 'Who owes whom in a group, with suggested transfers, reminders and settle-up.',
  invoking: 'Working out balances…',
  invoked: 'Balances ready',
  views: ['settleUp'],
  examples: [
    {
      group: goa,
      currency: CUR,
      status: 'ready',
      myBalanceMinor: 345_000,
      members: [
        { userId: 'you', displayName: 'You', amountMinor: 345_000, isMe: true },
        { userId: 'sam', displayName: 'Sam', amountMinor: -120_000 },
        { userId: 'alex', displayName: 'Alex', amountMinor: -225_000 },
      ],
      transfers: [
        {
          fromUserId: 'alex',
          fromName: 'Alex',
          toUserId: 'you',
          toName: 'You',
          amountMinor: 225_000,
          direction: 'you_receive',
        },
        {
          fromUserId: 'sam',
          fromName: 'Sam',
          toUserId: 'you',
          toName: 'You',
          amountMinor: 120_000,
          direction: 'you_receive',
        },
      ],
    },
  ],
  empty: {
    group: goa,
    currency: CUR,
    status: 'ready',
    myBalanceMinor: 0,
    members: [],
    transfers: [],
  },
  render: (d, k) => {
    const name = (d.group && d.group.name) || 'Group';
    if (d.status && d.status !== 'ready')
      return k.page(
        k.header('Group balances', name),
        k.notice('Balances are still being prepared for this group. Try again shortly.'),
      );
    const mine = k.num(d.myBalanceMinor);
    const members = k.arr(d.members);
    const transfers = k.arr(d.transfers);
    const top = k.max(
      members.map((m) => Math.abs(k.num(m.amountMinor))),
      1,
    );
    const groupId = d.group ? d.group.id : '';
    return k.page(
      k.header('Group balances', name, k.pill(d.currency)),
      k.hero({
        label: mine === 0 ? 'All square' : mine > 0 ? 'You are owed' : 'You owe',
        value: mine === 0 ? 'Settled up' : k.money(Math.abs(mine), d.currency),
        tone: k.toneOf(mine),
      }),
      members.length
        ? k.section(
            'Members',
            k.list(
              members.map((m) => {
                const v = k.num(m.amountMinor);
                return k.row({
                  lead: k.avatar(m.displayName),
                  title: m.displayName + (m.isMe ? ' (you)' : ''),
                  html:
                    '<div style="margin-top:6px">' +
                    k.progress(Math.abs(v) / top, v < 0 ? 'expense' : 'income') +
                    '</div>',
                  value:
                    v === 0
                      ? 'settled'
                      : (v > 0 ? 'gets ' : 'owes ') + k.money(Math.abs(v), d.currency),
                  valueTone: k.toneOf(v),
                });
              }),
            ),
          )
        : '',
      transfers.length
        ? k.section(
            'Suggested transfers',
            k.list(
              transfers.map((t) =>
                k.row({
                  lead: k.tile(
                    k.icon('swap', 16),
                    t.direction === 'you_pay'
                      ? 'expense'
                      : t.direction === 'you_receive'
                        ? 'income'
                        : 'neutral',
                  ),
                  title: t.fromName + ' → ' + t.toName,
                  sub:
                    t.direction === 'you_pay'
                      ? 'You pay'
                      : t.direction === 'you_receive'
                        ? 'You receive'
                        : 'Between others',
                  value: k.money(t.amountMinor, d.currency),
                  html:
                    t.direction === 'you_pay'
                      ? '<div class="actions" style="margin-top:6px">' +
                        k.button({
                          label: 'Settle up',
                          call: 'finapp.groups.settle_up.prepare',
                          args: { groupId },
                          view: 'settleUp',
                          primary: true,
                        }) +
                        '</div>'
                      : t.direction === 'you_receive'
                        ? '<div class="actions" style="margin-top:6px">' +
                          k.button({
                            label: 'Remind',
                            call: 'finapp.groups.nudge',
                            args: { groupId, userId: t.fromUserId },
                            ok: {
                              alreadySent: 'Already reminded ' + t.fromName + ' today.',
                              muted: t.fromName + ' has turned off payment reminders.',
                              '*': 'Reminder sent to ' + t.fromName + '.',
                            },
                          }) +
                          '</div>'
                        : '',
                }),
              ),
            ) + '<div data-flash aria-live="polite"></div>',
          )
        : k.empty('Nobody owes anything', 'Everyone in ' + name + ' is settled up. Nice.', 'check'),
    );
  },
});

type Expense = {
  id: string;
  title: string;
  type?: string;
  amountMinor: Minor;
  currency: string;
  occurredAt?: number;
  merchant?: string;
  categoryName?: string;
  accountName?: string;
  note?: string;
  deleted?: boolean;
  items?: Array<{
    id?: string;
    title: string;
    amountMinor: Minor;
    quantity?: number;
    participantIds?: string[];
  }>;
  group?: {
    id: string;
    name: string;
    version?: number;
    payers?: Array<{ userId: string; displayName: string; amountMinor: Minor }>;
    participants?: Array<{
      userId: string;
      displayName: string;
      amountMinor: Minor;
      method?: string;
      basisValue?: string;
    }>;
  } | null;
} | null;

export const expense = defineWidget<Expense>({
  id: 'expense',
  name: 'expense',
  domain: 'core',
  uri: 'ui://finapp/expense.v1.html',
  title: 'Expense detail',
  description: 'One expense with payers, split, line items and edit history.',
  invoking: 'Opening the expense…',
  invoked: 'Expense ready',
  views: ['groups.expenseHistory'],
  examples: [
    {
      id: 'preview-expense',
      title: 'Beach shack dinner',
      type: 'expense',
      amountMinor: 360_000,
      currency: CUR,
      occurredAt: daysAgo(2, 20),
      merchant: 'Curlies',
      items: [
        { id: 'e1', title: 'Prawn curry', amountMinor: 180_000, participantIds: ['you', 'alex'] },
        { id: 'e2', title: 'Veg thali', amountMinor: 90_000, participantIds: ['sam'] },
        { id: 'e3', title: 'Drinks', amountMinor: 90_000 },
      ],
      group: {
        id: 'preview-group',
        name: 'Goa trip',
        version: 2,
        payers: [{ userId: 'you', displayName: 'You', amountMinor: 360_000 }],
        participants: [
          { userId: 'you', displayName: 'You', amountMinor: 120_000, method: 'itemized' },
          { userId: 'alex', displayName: 'Alex', amountMinor: 120_000, method: 'itemized' },
          { userId: 'sam', displayName: 'Sam', amountMinor: 120_000, method: 'itemized' },
        ],
      },
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.title)
      return k.page(
        k.empty(
          'This transaction is not available',
          'It may have been deleted or you may no longer have access.',
          'receipt',
        ),
      );
    const g = d.group;
    const names: Record<string, string> = {};
    if (g)
      k.arr(g.participants)
        .concat(k.arr(g.payers) as never[])
        .forEach((p) => (names[p.userId] = p.displayName));
    const meta = [k.date(d.occurredAt), d.merchant, d.categoryName, d.accountName]
      .filter(Boolean)
      .join(' · ');
    return k.page(
      k.header(
        g ? 'Group expense · ' + g.name : 'Transaction',
        d.title,
        d.deleted ? k.pill('Deleted', 'warn') : g && g.version ? k.pill('v' + g.version) : '',
      ),
      k.hero({
        label: d.type === 'income' ? 'Received' : 'Amount',
        value: k.amount(d, 'amount'),
        sub: meta,
      }),
      d.note ? k.card(k.esc(d.note)) : '',
      k.arr(d.items).length ? k.section('Line items', k.lineItems(d.items, d.currency, names)) : '',
      g && k.arr(g.payers).length
        ? k.section(
            'Paid by',
            k.list(
              k
                .arr(g.payers)
                .map((p) =>
                  k.person({ name: p.displayName, value: k.money(p.amountMinor, d.currency) }),
                ),
            ),
          )
        : '',
      g && k.arr(g.participants).length
        ? k.section(
            'Split',
            k.list(
              k
                .arr(g.participants)
                .map((p) =>
                  k.person({
                    name: p.displayName,
                    sub: [p.method, p.basisValue].filter(Boolean).join(' · '),
                    value: k.money(p.amountMinor, d.currency),
                  }),
                ),
            ),
          )
        : '',
      g
        ? k.actions(
            k.button({
              label: 'Show edit history',
              call: 'finapp.groups.expenses.history',
              args: { expenseId: d.id },
              view: 'groups.expenseHistory',
              into: 'fa-history',
            }),
          ) + '<div id="fa-history"></div>'
        : '',
    );
  },
});

export const settleUp = defineWidget<Balances>({
  id: 'settleUp',
  name: 'settleUp',
  domain: 'core',
  uri: 'ui://finapp/settle-up.v1.html',
  title: 'Settle up',
  description: 'Pick a suggested transfer and record the settlement from one of your accounts.',
  invoking: 'Preparing settle-up…',
  invoked: 'Ready to settle up',
  examples: [
    {
      group: goa,
      currency: CUR,
      status: 'ready',
      myBalanceMinor: -150_000,
      members: [],
      transfers: [
        {
          fromUserId: 'you',
          fromName: 'You',
          toUserId: 'alex',
          toName: 'Alex',
          amountMinor: 150_000,
          direction: 'you_pay',
        },
      ],
      accounts: [
        { id: 'a1', name: 'HDFC Savings', currency: CUR, balanceMinor: 15_420_000 },
        { id: 'a2', name: 'Cash', currency: CUR, balanceMinor: 322_300 },
      ],
    },
  ],
  empty: { group: goa, currency: CUR, transfers: [], accounts: [] },
  render: (d, k) => {
    const name = (d.group && d.group.name) || 'Group';
    const transfers = k.arr(d.transfers);
    if (!transfers.length)
      return k.page(
        k.header('Settle up', name),
        k.empty('Nothing to settle', 'You have nothing to settle in this group.', 'check'),
      );
    const accounts = k.arr(d.accounts);
    const major = (minor: unknown) => {
      const digits = k.digits(d.currency);
      return (Math.abs(k.num(minor)) / Math.pow(10, digits)).toFixed(digits);
    };
    const radios = transfers
      .map(
        (t, i) =>
          '<label class="choice"><input type="radio" name="transfer" value="' +
          k.esc(
            JSON.stringify({
              fromUserId: t.fromUserId,
              toUserId: t.toUserId,
              _fromName: t.fromName,
              _toName: t.toName,
            }),
          ) +
          '" data-fill="' +
          k.esc(JSON.stringify({ amountMinor: major(t.amountMinor) })) +
          '"' +
          (i === 0 ? ' checked' : '') +
          ' />' +
          '<div class="grow"><div class="title">' +
          k.esc(t.fromName + ' → ' + t.toName) +
          '</div><div class="sub">' +
          k.esc(
            t.direction === 'you_pay'
              ? 'You pay'
              : t.direction === 'you_receive'
                ? 'You receive'
                : 'Between others',
          ) +
          '</div></div>' +
          '<span class="amount">' +
          k.esc(k.money(t.amountMinor, d.currency)) +
          '</span></label>',
      )
      .join('');
    return k.page(
      k.header('Settle up', name, k.pill(d.currency)),
      '<form class="w">' +
        k.section('Suggested transfers', '<div class="card list">' + radios + '</div>') +
        (accounts.length
          ? ''
          : k.notice('Add an account in ' + d.currency + ' to record a settlement.', 'expense')) +
        '<div class="stats" style="--min:160px"><label class="field">Amount (' +
        k.esc(d.currency) +
        ')<input name="amountMinor" inputmode="decimal" autocomplete="off" value="' +
        k.esc(major(transfers[0]!.amountMinor)) +
        '" /></label>' +
        '<label class="field">Your account<select name="accountId">' +
        accounts
          .map(
            (a) =>
              '<option value="' +
              k.esc(a.id) +
              '">' +
              k.esc(a.name + ' · ' + k.amount(a, 'balance', d.currency)) +
              '</option>',
          )
          .join('') +
        '</select></label></div>' +
        '<label class="field">Note (optional)<input name="note" maxlength="500" placeholder="e.g. UPI reference" /></label>' +
        k.actions(
          k.button({
            label: 'Record settlement',
            primary: true,
            call: 'finapp.groups.settlements.create',
            args: { groupId: d.group ? d.group.id : '', currency: d.currency },
            fields: 'transfer:json,accountId,amountMinor:minor,note?',
            currency: d.currency,
            mutation: true,
            ok: 'Settlement of {amountMinor} {currency} recorded ({fromName} → {toName}).',
            say:
              'I recorded a settlement of {amountMinor} {currency} from {fromName} to {toName} in ' +
              name +
              '.',
          }),
        ) +
        '</form>',
    );
  },
});

export const coreWidgets = [overview, transactions, groupBalances, expense, settleUp];
