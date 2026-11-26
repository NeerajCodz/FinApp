import { CUR, MERCHANTS, daysAgo, monthLabels, series, walk } from '../sample';
import { defineWidget, type Minor } from '../types';

type Account = {
  id: string;
  name: string;
  type: string;
  customType?: string;
  currency: string;
  balanceMinor: Minor;
  balanceFormatted?: string;
  color?: string;
  isIncludedInTotal?: boolean;
};

const ACCOUNTS: Account[] = [
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
    name: 'ICICI Salary',
    type: 'bank',
    currency: CUR,
    balanceMinor: 4_210_000,
    isIncludedInTotal: true,
  },
  {
    id: 'a3',
    name: 'HDFC Regalia',
    type: 'card',
    currency: CUR,
    balanceMinor: -1_240_000,
    isIncludedInTotal: true,
  },
  {
    id: 'a4',
    name: 'Paytm wallet',
    type: 'wallet',
    currency: CUR,
    balanceMinor: 182_000,
    isIncludedInTotal: true,
  },
  {
    id: 'a5',
    name: 'Cash',
    type: 'cash',
    currency: CUR,
    balanceMinor: 322_300,
    isIncludedInTotal: true,
  },
  {
    id: 'a6',
    name: 'Wise USD',
    type: 'bank',
    currency: 'USD',
    balanceMinor: 245_000,
    isIncludedInTotal: false,
  },
];

/** Linked to `finapp.finance.accounts.list` ({ items: AccountSummary[] }). */
export const accountList = defineWidget<{ items?: Account[] }>({
  domain: 'accounts',
  name: 'list',
  title: 'Accounts',
  description:
    'All your accounts with balances, grouped totals per currency and which ones count toward your total.',
  invoking: 'Loading your accounts…',
  examples: [{ items: ACCOUNTS }],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Accounts', 'Your accounts'),
        k.empty(
          'No accounts yet',
          'Add a bank account, card, wallet or cash to start tracking.',
          'wallet',
        ),
      );
    const totals: Record<string, number> = {};
    items.forEach((a) => {
      if (a.isIncludedInTotal !== false)
        totals[a.currency] = (totals[a.currency] || 0) + k.num(a.balanceMinor);
    });
    return k.page(
      k.header('Accounts', k.plural(items.length, 'account')),
      k.stats(
        Object.keys(totals).map((c) => ({
          label: 'Total ' + c,
          value: k.money(totals[c], c),
          tone: totals[c]! < 0 ? 'expense' : null,
        })),
      ),
      k.list(
        items.map((a) =>
          k.row({
            lead: k.accountIcon(a.type, k.num(a.balanceMinor) < 0 ? 'expense' : 'accent'),
            title: a.name,
            sub: [
              a.customType || a.type,
              a.currency,
              a.isIncludedInTotal === false ? 'not in total' : '',
            ]
              .filter(Boolean)
              .join(' · '),
            value: k.amount(a, 'balance'),
            valueTone: k.num(a.balanceMinor) < 0 ? 'expense' : null,
            muted: a.isIncludedInTotal === false,
          }),
        ),
      ),
    );
  },
});

type AccountCard = Account & {
  trend?: number[];
  inflowMinor?: Minor;
  outflowMinor?: Minor;
  lastActivityAt?: number;
  mask?: string;
};

export const accountCard = defineWidget<AccountCard | null>({
  domain: 'accounts',
  name: 'card',
  title: 'Account card',
  description: 'One account as a card: balance, 30-day trend, money in and out, and last activity.',
  examples: [
    {
      ...ACCOUNTS[0]!,
      mask: '4821',
      trend: walk(30, 15_000_000, 14_000, 180_000, 11),
      inflowMinor: 9_500_000,
      outflowMinor: 9_080_000,
      lastActivityAt: daysAgo(0, 8),
    },
    {
      ...ACCOUNTS[2]!,
      mask: '0094',
      trend: walk(30, -400_000, -28_000, 90_000, 12),
      inflowMinor: 2_000_000,
      outflowMinor: 2_840_000,
      lastActivityAt: daysAgo(1),
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.name)
      return k.page(
        k.empty('Account not found', 'It may have been archived or deleted.', 'wallet'),
      );
    const neg = k.num(d.balanceMinor) < 0;
    return k.page(
      k.card(
        '<div class="hd"><div class="hd-t" style="display:flex;gap:10px;align-items:center">' +
          k.accountIcon(d.type, neg ? 'expense' : 'accent') +
          '<div><h2>' +
          k.esc(d.name) +
          '</h2><div class="sub">' +
          k.esc(
            [d.customType || d.type, d.mask ? '•••• ' + d.mask : '', d.currency]
              .filter(Boolean)
              .join(' · '),
          ) +
          '</div></div></div>' +
          (d.isIncludedInTotal === false ? k.pill('Not in total') : '') +
          '</div>' +
          '<div class="big ' +
          (neg ? 'neg' : '') +
          '" style="margin:12px 0 4px">' +
          k.esc(k.amount(d, 'balance')) +
          '</div>' +
          (k.arr(d.trend).length > 1
            ? k.sparkline(k.arr(d.trend), { tone: neg ? 'expense' : 'accent', height: 48 })
            : '') +
          k.kv([
            d.inflowMinor !== undefined
              ? [
                  'Money in (30d)',
                  k.text(k.money(d.inflowMinor, d.currency, { sign: true }), 'income'),
                ]
              : null,
            d.outflowMinor !== undefined
              ? ['Money out (30d)', k.text('−' + k.money(d.outflowMinor, d.currency), 'expense')]
              : null,
            d.lastActivityAt ? ['Last activity', k.esc(k.ago(d.lastActivityAt))] : null,
          ]),
      ),
    );
  },
});

type Flow = {
  account: { name: string; currency: string };
  months: Array<{ label: string; inMinor: Minor; outMinor: Minor }>;
};

const fin = series(6, 9_800_000, 0.12, 21);
const fout = series(6, 8_600_000, 0.2, 22);

export const accountCashFlow = defineWidget<Flow>({
  domain: 'accounts',
  name: 'cashFlow',
  title: 'Account cash flow',
  description: 'Money in and out of one account by month as diverging columns with the net line.',
  examples: [
    {
      account: { name: 'HDFC Savings', currency: CUR },
      months: monthLabels(6).map((label, i) => ({ label, inMinor: fin[i]!, outMinor: fout[i]! })),
    },
  ],
  empty: { account: { name: 'Account', currency: CUR }, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    const cur = d.account.currency;
    if (!months.length)
      return k.page(
        k.header('Cash flow', d.account.name),
        k.empty(
          'No activity yet',
          'Transactions in this account will show up here by month.',
          'trend',
        ),
      );
    const totalIn = k.sum(months.map((m) => m.inMinor));
    const totalOut = k.sum(months.map((m) => m.outMinor));
    return k.page(
      k.header('Cash flow', d.account.name, k.pill(months.length + ' months')),
      k.stats([
        { label: 'In', value: k.money(totalIn, cur), tone: 'income' },
        { label: 'Out', value: k.money(totalOut, cur), tone: 'expense' },
        {
          label: 'Net',
          value: k.money(totalIn - totalOut, cur, { sign: true }),
          tone: k.toneOf(totalIn - totalOut),
        },
      ]),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [
            { name: 'In', values: months.map((m) => k.num(m.inMinor)) },
            { name: 'Out', values: months.map((m) => k.num(m.outMinor)) },
          ],
          mode: 'diverging',
          currency: cur,
          title: 'Money in and out by month',
        }),
      ),
    );
  },
});

type History = {
  currency: string;
  labels: string[];
  accounts: Array<{ name: string; values: number[] }>;
};

export const balanceHistory = defineWidget<History>({
  domain: 'accounts',
  name: 'balanceHistory',
  title: 'Balance history',
  description: 'Month-end balances of each account on one chart, so you can see where money moved.',
  examples: [
    {
      currency: CUR,
      labels: monthLabels(8),
      accounts: [
        { name: 'HDFC Savings', values: walk(8, 12_000_000, 420_000, 300_000, 31) },
        { name: 'ICICI Salary', values: walk(8, 3_000_000, 150_000, 500_000, 32) },
        { name: 'Paytm wallet', values: walk(8, 150_000, 4_000, 40_000, 33) },
      ],
    },
  ],
  empty: { currency: CUR, labels: [], accounts: [] },
  render: (d, k) => {
    const accounts = k.arr(d.accounts).slice(0, 8);
    if (!accounts.length || k.arr(d.labels).length < 2)
      return k.page(
        k.header('Accounts', 'Balance history'),
        k.empty(
          'No history yet',
          'Month-end balances appear after your first full month.',
          'trend',
        ),
      );
    return k.page(
      k.header('Accounts', 'Balance history'),
      k.card(
        k.lineChart({
          labels: d.labels,
          series: accounts.map((a) => ({ name: a.name, values: a.values })),
          currency: d.currency,
          area: false,
          title: 'Month-end balance by account',
        }),
      ),
    );
  },
});

export const accountCompare = defineWidget<{ items?: Account[] }>({
  domain: 'accounts',
  name: 'compare',
  title: 'Accounts ranked',
  description:
    'Accounts ranked by balance as horizontal bars, with each one’s share of your total.',
  examples: [{ items: ACCOUNTS.filter((a) => a.currency === CUR) }],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items).filter((a) => k.num(a.balanceMinor) > 0);
    if (!items.length)
      return k.page(
        k.header('Accounts', 'Ranked by balance'),
        k.empty('No positive balances', 'Accounts with money in them are ranked here.', 'wallet'),
      );
    const cur = items[0]!.currency;
    return k.page(
      k.header('Accounts', 'Ranked by balance'),
      k.card(
        k.barList({
          items: items.map((a) => ({
            label: a.name,
            value: k.num(a.balanceMinor),
            lead: k.accountIcon(a.type),
          })),
          currency: cur,
          showShare: true,
          title: 'Balance by account',
        }),
      ),
    );
  },
});

type Utilization = {
  currency: string;
  cards: Array<{
    name: string;
    balanceMinor: Minor;
    limitMinor: Minor;
    statementDay?: number;
    dueAt?: number;
  }>;
};

export const creditUtilization = defineWidget<Utilization>({
  domain: 'accounts',
  name: 'creditUtilization',
  title: 'Credit utilization',
  description:
    'How much of each card’s limit you are using, with the overall ratio and the 30% guideline.',
  examples: [
    {
      currency: CUR,
      cards: [
        {
          name: 'HDFC Regalia',
          balanceMinor: 1_240_000,
          limitMinor: 30_000_000,
          dueAt: Date.UTC(2026, 11, 5),
        },
        {
          name: 'Amazon Pay ICICI',
          balanceMinor: 3_620_000,
          limitMinor: 10_000_000,
          dueAt: Date.UTC(2026, 11, 12),
        },
        {
          name: 'OneCard',
          balanceMinor: 4_480_000,
          limitMinor: 5_000_000,
          dueAt: Date.UTC(2026, 11, 2),
        },
      ],
    },
  ],
  empty: { currency: CUR, cards: [] },
  render: (d, k) => {
    const cards = k.arr(d.cards);
    if (!cards.length)
      return k.page(
        k.header('Credit', 'Utilization'),
        k.empty('No credit cards', 'Add a card with a limit to track utilization.', 'card'),
      );
    const used = k.sum(cards.map((c) => Math.abs(k.num(c.balanceMinor))));
    const limit = k.sum(cards.map((c) => c.limitMinor));
    const ratio = limit ? used / limit : 0;
    return k.page(
      k.header('Credit', 'Utilization'),
      k.card(
        '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: ratio,
            tone: ratio > 0.3 ? 'warn' : 'income',
            label: 'Overall',
            size: 104,
          }) +
          '<div class="grow">' +
          k.kv([
            ['Used', k.esc(k.money(used, d.currency))],
            ['Total limit', k.esc(k.money(limit, d.currency))],
            ['Guideline', k.esc('Under 30%')],
          ]) +
          '</div></div>',
      ),
      k.card(
        cards
          .map((c) =>
            k.meter({
              label: c.name,
              value: Math.abs(k.num(c.balanceMinor)),
              max: k.num(c.limitMinor),
              valueText: k.money(Math.abs(k.num(c.balanceMinor)), d.currency),
              maxText: k.money(c.limitMinor, d.currency),
              warnAt: 0.3,
              sub: c.dueAt ? 'Payment due ' + k.date(c.dueAt, 'day') : undefined,
            }),
          )
          .join(''),
      ),
    );
  },
});

export const accountTypes = defineWidget<{ items?: Account[] }>({
  domain: 'accounts',
  name: 'typeMix',
  title: 'Account types',
  description: 'How many accounts of each type you have and what they hold, as a segmented bar.',
  examples: [{ items: ACCOUNTS.filter((a) => a.currency === CUR) }],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(k.header('Accounts', 'Types'), k.empty('No accounts yet', undefined, 'wallet'));
    const by: Record<string, { count: number; value: number; names: string[] }> = {};
    items.forEach((a) => {
      const t = a.customType || a.type;
      by[t] = by[t] || { count: 0, value: 0, names: [] };
      by[t]!.count += 1;
      by[t]!.names.push(a.name);
      by[t]!.value += Math.max(0, k.num(a.balanceMinor));
    });
    const types = Object.keys(by).sort((a, b) => by[b]!.value - by[a]!.value);
    const cur = items[0]!.currency;
    return k.page(
      k.header('Accounts', 'Types'),
      k.card(
        k.segments({
          items: types.map((t) => ({ label: t, value: by[t]!.value })),
          currency: cur,
          title: 'Balance by account type',
        }),
      ),
      k.table(
        [
          { label: 'Type' },
          { label: 'Accounts', align: 'right' },
          { label: 'Balance', align: 'right' },
        ],
        types.map((t) => [
          k.esc(t) + '<div class="sub">' + k.esc(by[t]!.names.join(', ')) + '</div>',
          String(by[t]!.count),
          k.esc(k.money(by[t]!.value, cur)),
        ]),
        'Accounts by type',
      ),
    );
  },
});

type Activity = {
  account: Account;
  transactions: Array<{
    id: string;
    title: string;
    type: string;
    amountMinor: Minor;
    currency: string;
    occurredAt: number;
    categoryName?: string;
  }>;
};

export const accountActivity = defineWidget<Activity>({
  domain: 'accounts',
  name: 'activity',
  title: 'Account activity',
  description: 'Recent transactions in one account with its balance and this month’s in/out.',
  examples: [
    {
      account: ACCOUNTS[0]!,
      transactions: MERCHANTS.slice(0, 6).map((m, i) => ({
        id: 't' + i,
        title: m,
        type: i === 3 ? 'income' : 'expense',
        amountMinor: series(6, 120_000, 0.8, 41)[i]!,
        currency: CUR,
        occurredAt: daysAgo(i),
        categoryName: i === 3 ? 'Refund' : undefined,
      })),
    },
  ],
  empty: { account: ACCOUNTS[0]!, transactions: [] },
  render: (d, k) => {
    const txs = k.arr(d.transactions);
    const inflow = k.sum(
      txs.filter((t) => t.type === 'income' || t.type === 'refund').map((t) => t.amountMinor),
    );
    const outflow = k.sum(txs.filter((t) => t.type === 'expense').map((t) => t.amountMinor));
    return k.page(
      k.header('Activity', d.account.name, k.pill(k.amount(d.account, 'balance'))),
      txs.length
        ? k.stats([
            { label: 'In', value: k.money(inflow, d.account.currency), tone: 'income' },
            { label: 'Out', value: k.money(outflow, d.account.currency), tone: 'expense' },
          ])
        : '',
      k.txList(
        txs,
        'No activity in this account',
        'Transactions you add to ' + d.account.name + ' appear here.',
      ),
    );
  },
});

type Low = {
  currency: string;
  accounts: Array<{
    name: string;
    balanceMinor: Minor;
    thresholdMinor: Minor;
    upcomingMinor?: Minor;
  }>;
};

export const lowBalance = defineWidget<Low>({
  domain: 'accounts',
  name: 'lowBalance',
  title: 'Low balance alerts',
  description: 'Accounts below their alert threshold, including bills due before the next payday.',
  examples: [
    {
      currency: CUR,
      accounts: [
        { name: 'Paytm wallet', balanceMinor: 18_200, thresholdMinor: 50_000 },
        {
          name: 'ICICI Salary',
          balanceMinor: 420_000,
          thresholdMinor: 500_000,
          upcomingMinor: 389_000,
        },
      ],
    },
  ],
  empty: { currency: CUR, accounts: [] },
  render: (d, k) => {
    const accounts = k.arr(d.accounts);
    if (!accounts.length)
      return k.page(
        k.header('Alerts', 'Low balances'),
        k.empty('All accounts are healthy', 'No account is below its alert threshold.', 'check'),
      );
    return k.page(
      k.header('Alerts', 'Low balances', k.pill(k.plural(accounts.length, 'account'), 'warn')),
      k.card(
        accounts
          .map((a) =>
            k.meter({
              label: a.name,
              value: k.num(a.balanceMinor),
              max: k.num(a.thresholdMinor),
              tone: 'warn',
              valueText: k.money(a.balanceMinor, d.currency),
              maxText: k.money(a.thresholdMinor, d.currency) + ' alert',
              sub: a.upcomingMinor
                ? k.money(a.upcomingMinor, d.currency) + ' in bills due before payday'
                : 'Below your alert threshold',
            }),
          )
          .join(''),
      ),
    );
  },
});

type Transfers = {
  currency: string;
  transfers: Array<{
    from: string;
    to: string;
    amountMinor: Minor;
    occurredAt: number;
    note?: string;
  }>;
};

export const accountTransfers = defineWidget<Transfers>({
  domain: 'accounts',
  name: 'transfers',
  title: 'Transfers between accounts',
  description: 'Money moved between your own accounts, with totals per route.',
  examples: [
    {
      currency: CUR,
      transfers: [
        {
          from: 'ICICI Salary',
          to: 'HDFC Savings',
          amountMinor: 5_000_000,
          occurredAt: daysAgo(3),
          note: 'Monthly sweep',
        },
        {
          from: 'HDFC Savings',
          to: 'HDFC Regalia',
          amountMinor: 2_840_000,
          occurredAt: daysAgo(6),
          note: 'Card bill',
        },
        { from: 'HDFC Savings', to: 'Paytm wallet', amountMinor: 200_000, occurredAt: daysAgo(9) },
        {
          from: 'ICICI Salary',
          to: 'HDFC Savings',
          amountMinor: 5_000_000,
          occurredAt: daysAgo(33),
          note: 'Monthly sweep',
        },
      ],
    },
  ],
  empty: { currency: CUR, transfers: [] },
  render: (d, k) => {
    const list = k.arr(d.transfers);
    if (!list.length)
      return k.page(
        k.header('Transfers', 'Between your accounts'),
        k.empty('No transfers', 'Moves between your own accounts appear here.', 'swap'),
      );
    const routes: Record<string, number> = {};
    list.forEach(
      (t) =>
        (routes[t.from + ' → ' + t.to] =
          (routes[t.from + ' → ' + t.to] || 0) + k.num(t.amountMinor)),
    );
    return k.page(
      k.header('Transfers', 'Between your accounts', k.pill(k.plural(list.length, 'transfer'))),
      k.section(
        'By route',
        k.card(
          k.barList({
            items: Object.keys(routes).map((r) => ({ label: r, value: routes[r]! })),
            currency: d.currency,
            tone: 'neutral',
            title: 'Transfers by route',
          }),
        ),
      ),
      k.section(
        'Recent',
        k.list(
          list.map((t) =>
            k.row({
              lead: k.tile(k.icon('swap', 16), 'neutral'),
              title: t.from + ' → ' + t.to,
              sub: [t.note, k.date(t.occurredAt, 'day')].filter(Boolean).join(' · '),
              value: k.money(t.amountMinor, d.currency),
            }),
          ),
        ),
      ),
    );
  },
});

type Reconcile = {
  account: string;
  currency: string;
  statementMinor: Minor;
  appMinor: Minor;
  statementDate: number;
  unmatched: Array<{
    title: string;
    amountMinor: Minor;
    occurredAt: number;
    side: 'statement' | 'app';
  }>;
};

export const reconcile = defineWidget<Reconcile>({
  domain: 'accounts',
  name: 'reconcile',
  title: 'Reconcile account',
  description:
    'Statement balance against the app balance, with the unmatched entries that explain the gap.',
  examples: [
    {
      account: 'HDFC Savings',
      currency: CUR,
      statementMinor: 15_380_000,
      appMinor: 15_420_000,
      statementDate: daysAgo(1),
      unmatched: [
        { title: 'ATM fee', amountMinor: -2_000, occurredAt: daysAgo(4), side: 'statement' },
        {
          title: 'Swiggy (pending)',
          amountMinor: -38_000,
          occurredAt: daysAgo(1),
          side: 'statement',
        },
      ],
    },
  ],
  empty: {
    account: 'Account',
    currency: CUR,
    statementMinor: 0,
    appMinor: 0,
    statementDate: 0,
    unmatched: [],
  },
  render: (d, k) => {
    const gap = k.num(d.appMinor) - k.num(d.statementMinor);
    const unmatched = k.arr(d.unmatched);
    if (!d.statementDate)
      return k.page(
        k.header('Reconcile', d.account),
        k.empty(
          'No statement yet',
          'Enter a statement balance to reconcile this account.',
          'receipt',
        ),
      );
    return k.page(
      k.header(
        'Reconcile',
        d.account,
        gap === 0
          ? k.pill('Balanced', 'income')
          : k.pill('Off by ' + k.money(Math.abs(gap), d.currency), 'warn'),
      ),
      k.stats([
        {
          label: 'Statement (' + k.date(d.statementDate, 'day') + ')',
          value: k.money(d.statementMinor, d.currency),
        },
        { label: 'In FinApp', value: k.money(d.appMinor, d.currency) },
        {
          label: 'Difference',
          value: k.money(gap, d.currency, { sign: true }),
          tone: gap === 0 ? 'income' : 'warn',
        },
      ]),
      unmatched.length
        ? k.section(
            'Unmatched',
            k.list(
              unmatched.map((u) =>
                k.row({
                  lead: k.tile(k.icon(u.side === 'statement' ? 'bank' : 'device', 16), 'warn'),
                  title: u.title,
                  sub:
                    (u.side === 'statement' ? 'Only on statement' : 'Only in FinApp') +
                    ' · ' +
                    k.date(u.occurredAt, 'day'),
                  value: k.money(u.amountMinor, d.currency, { sign: true }),
                  valueTone: k.toneOf(k.num(u.amountMinor)),
                }),
              ),
            ),
          )
        : k.notice('Every entry matches the statement.', 'income'),
    );
  },
});

type Detail = Account & {
  createdAt?: number;
  openingBalanceMinor?: Minor;
  transactionCount?: number;
  includeInAnalytics?: boolean;
  monthly?: Array<{ label: string; balanceMinor: Minor }>;
};

export const accountDetail = defineWidget<Detail | null>({
  domain: 'accounts',
  name: 'detail',
  title: 'Account details',
  description:
    'Everything about one account: type, currency, opening balance, settings and a 6-month balance chart.',
  examples: [
    {
      ...ACCOUNTS[1]!,
      createdAt: Date.UTC(2024, 2, 4),
      openingBalanceMinor: 1_200_000,
      transactionCount: 412,
      includeInAnalytics: true,
      monthly: monthLabels(6).map((label, i) => ({
        label,
        balanceMinor: walk(6, 3_000_000, 200_000, 400_000, 51)[i]!,
      })),
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.name)
      return k.page(
        k.empty('Account not found', 'It may have been archived or deleted.', 'wallet'),
      );
    const monthly = k.arr(d.monthly);
    return k.page(
      k.header('Account', d.name, k.pill(d.currency)),
      k.hero({
        label: 'Balance',
        value: k.amount(d, 'balance'),
        tone: k.num(d.balanceMinor) < 0 ? 'expense' : null,
        aside: k.accountIcon(d.type),
      }),
      monthly.length > 1
        ? k.card(
            k.columns({
              labels: monthly.map((m) => m.label),
              series: [
                {
                  name: 'Month-end balance',
                  values: monthly.map((m) => k.num(m.balanceMinor)),
                  tone: 0,
                },
              ],
              currency: d.currency,
              height: 160,
              title: 'Month-end balance',
            }),
          )
        : '',
      k.card(
        k.kv([
          ['Type', k.esc(d.customType || d.type)],
          d.openingBalanceMinor !== undefined
            ? ['Opening balance', k.esc(k.money(d.openingBalanceMinor, d.currency))]
            : null,
          d.transactionCount !== undefined
            ? ['Transactions', k.esc(k.number(d.transactionCount))]
            : null,
          ['Counts toward total', k.esc(d.isIncludedInTotal === false ? 'No' : 'Yes')],
          d.includeInAnalytics !== undefined
            ? ['Included in analytics', k.esc(d.includeInAnalytics ? 'Yes' : 'No')]
            : null,
          d.createdAt ? ['Added', k.esc(k.date(d.createdAt))] : null,
        ]),
      ),
    );
  },
});

export const accountWidgets = [
  accountList,
  accountCard,
  accountCashFlow,
  balanceHistory,
  accountCompare,
  creditUtilization,
  accountTypes,
  accountActivity,
  lowBalance,
  accountTransfers,
  reconcile,
  accountDetail,
];
