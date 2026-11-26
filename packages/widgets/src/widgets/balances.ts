import { CUR, monthLabels, series, walk } from '../sample';
import { defineWidget, type Minor } from '../types';

type Point = { label: string; valueMinor: Minor };

type NetWorth = {
  currency: string;
  netWorthMinor: Minor;
  assetsMinor: Minor;
  liabilitiesMinor: Minor;
  changeMinor?: Minor;
  history?: Point[];
};

const nw = walk(12, 14_200_000, 380_000, 260_000, 4);

export const netWorth = defineWidget<NetWorth>({
  domain: 'balances',
  name: 'netWorth',
  title: 'Net worth',
  description: 'Net worth today with its 12-month trend, assets and liabilities.',
  examples: [
    {
      currency: CUR,
      netWorthMinor: nw[11]!,
      assetsMinor: nw[11]! + 1_850_000,
      liabilitiesMinor: 1_850_000,
      changeMinor: nw[11]! - nw[10]!,
      history: monthLabels(12).map((label, i) => ({ label, valueMinor: nw[i]! })),
    },
  ],
  empty: { currency: CUR, netWorthMinor: 0, assetsMinor: 0, liabilitiesMinor: 0, history: [] },
  render: (d, k) => {
    const history = k.arr(d.history);
    if (!history.length && !k.num(d.assetsMinor) && !k.num(d.liabilitiesMinor))
      return k.page(
        k.header('Balances', 'Net worth'),
        k.empty('No balances yet', 'Add your accounts to track net worth over time.', 'trend'),
      );
    const change = k.num(d.changeMinor);
    const prev = k.num(d.netWorthMinor) - change;
    return k.page(
      k.header('Balances', 'Net worth', k.delta(prev ? change / Math.abs(prev) : null)),
      k.hero({
        label: 'Net worth',
        value: k.money(d.netWorthMinor, d.currency),
        tone: k.num(d.netWorthMinor) < 0 ? 'expense' : null,
        sub: change ? k.money(change, d.currency, { sign: true }) + ' this month' : undefined,
      }),
      history.length > 1
        ? k.card(
            k.lineChart({
              labels: history.map((p) => p.label),
              series: [
                {
                  name: 'Net worth',
                  values: history.map((p) => k.num(p.valueMinor)),
                  tone: 'accent',
                },
              ],
              currency: d.currency,
              zero: false,
              title: 'Net worth by month',
            }),
          )
        : '',
      k.stats([
        { label: 'Assets', value: k.money(d.assetsMinor, d.currency), tone: 'income' },
        { label: 'Liabilities', value: k.money(d.liabilitiesMinor, d.currency), tone: 'expense' },
      ]),
    );
  },
});

type Breakdown = {
  currency: string;
  assets: Array<{ name: string; type: string; balanceMinor: Minor }>;
  liabilities: Array<{ name: string; type: string; balanceMinor: Minor }>;
};

export const assetsLiabilities = defineWidget<Breakdown>({
  domain: 'balances',
  name: 'assetsLiabilities',
  title: 'Assets and liabilities',
  description: 'What you own against what you owe, account by account, with the net in between.',
  examples: [
    {
      currency: CUR,
      assets: [
        { name: 'HDFC Savings', type: 'bank', balanceMinor: 15_420_000 },
        { name: 'ICICI Salary', type: 'bank', balanceMinor: 4_210_000 },
        { name: 'Paytm wallet', type: 'wallet', balanceMinor: 182_000 },
        { name: 'Cash', type: 'cash', balanceMinor: 322_300 },
      ],
      liabilities: [
        { name: 'HDFC Regalia card', type: 'card', balanceMinor: 1_240_000 },
        { name: 'Bike loan', type: 'loan', balanceMinor: 6_800_000 },
      ],
    },
  ],
  empty: { currency: CUR, assets: [], liabilities: [] },
  render: (d, k) => {
    const assets = k.arr(d.assets);
    const debts = k.arr(d.liabilities);
    if (!assets.length && !debts.length)
      return k.page(
        k.header('Balances', 'Assets and liabilities'),
        k.empty('No accounts yet', 'Add accounts to see what you own and owe.', 'wallet'),
      );
    const a = k.sum(assets.map((x) => Math.abs(k.num(x.balanceMinor))));
    const l = k.sum(debts.map((x) => Math.abs(k.num(x.balanceMinor))));
    return k.page(
      k.header('Balances', 'Assets and liabilities'),
      k.hero({
        label: 'Net',
        value: k.money(a - l, d.currency),
        tone: k.toneOf(a - l),
        sub: k.percent(a ? l / a : 0) + ' of assets is owed',
      }),
      k.card(
        k.segments({
          items: [
            { label: 'Assets', value: a, tone: 'income' },
            { label: 'Liabilities', value: l, tone: 'expense' },
          ],
          currency: d.currency,
          title: 'Assets vs liabilities',
        }),
      ),
      k.cols(
        k.section(
          'Assets',
          k.list(
            assets.map((x) =>
              k.row({
                lead: k.accountIcon(x.type, 'income'),
                title: x.name,
                sub: x.type,
                value: k.money(Math.abs(k.num(x.balanceMinor)), d.currency),
              }),
            ),
          ),
          k.money(a, d.currency),
        ),
        k.section(
          'Liabilities',
          debts.length
            ? k.list(
                debts.map((x) =>
                  k.row({
                    lead: k.accountIcon(x.type, 'expense'),
                    title: x.name,
                    sub: x.type,
                    value: k.money(Math.abs(k.num(x.balanceMinor)), d.currency),
                    valueTone: 'expense',
                  }),
                ),
              )
            : k.empty('Debt free', 'No cards or loans with a balance.', 'check'),
          k.money(l, d.currency),
        ),
      ),
    );
  },
});

type Totals = {
  totals: Array<{
    currency: string;
    balanceMinor: Minor;
    accountCount?: number;
    convertedMinor?: Minor;
  }>;
  baseCurrency?: string;
};

export const totalsByCurrency = defineWidget<Totals>({
  domain: 'balances',
  name: 'totalsByCurrency',
  title: 'Balances by currency',
  description:
    'Total balance per currency, with the number of accounts and an approximate value in your home currency.',
  examples: [
    {
      baseCurrency: 'INR',
      totals: [
        { currency: 'INR', balanceMinor: 18_742_300, accountCount: 4, convertedMinor: 18_742_300 },
        { currency: 'USD', balanceMinor: 245_000, accountCount: 1, convertedMinor: 20_580_000 },
        { currency: 'EUR', balanceMinor: 61_200, accountCount: 1, convertedMinor: 5_630_400 },
        { currency: 'JPY', balanceMinor: 18_000, accountCount: 1, convertedMinor: 1_000_800 },
      ],
    },
  ],
  empty: { totals: [] },
  render: (d, k) => {
    const totals = k.arr(d.totals);
    if (!totals.length)
      return k.page(
        k.header('Balances', 'By currency'),
        k.empty('No balances', 'Accounts you add will be totalled per currency.', 'globe'),
      );
    const base = d.baseCurrency || totals[0]!.currency;
    const converted = totals.filter((t) => t.convertedMinor !== undefined);
    return k.page(
      k.header(
        'Balances',
        'By currency',
        k.pill(k.plural(totals.length, 'currency', 'currencies')),
      ),
      converted.length
        ? k.hero({
            label: 'Approximate total in ' + base,
            value: k.money(k.sum(converted.map((t) => t.convertedMinor)), base),
          })
        : '',
      converted.length > 1
        ? k.card(
            k.donut({
              items: converted.map((t) => ({ label: t.currency, value: k.num(t.convertedMinor) })),
              currency: base,
              centerLabel: 'In ' + base,
              title: 'Share by currency',
            }),
          )
        : '',
      k.list(
        totals.map((t) =>
          k.row({
            lead: k.tile(k.esc(t.currency.slice(0, 3)), 'neutral', 40),
            title: t.currency,
            sub: t.accountCount ? k.plural(t.accountCount, 'account') : '',
            value: k.money(t.balanceMinor, t.currency),
            valueSub:
              t.convertedMinor !== undefined && t.currency !== base
                ? '≈ ' + k.money(t.convertedMinor, base)
                : '',
          }),
        ),
      ),
    );
  },
});

type Allocation = {
  currency: string;
  groups: Array<{ type: string; label?: string; balanceMinor: Minor }>;
};

export const allocation = defineWidget<Allocation>({
  domain: 'balances',
  name: 'allocation',
  title: 'Where your money sits',
  description:
    'Balances grouped by account type (bank, cash, wallet, investments) as a donut with shares.',
  examples: [
    {
      currency: CUR,
      groups: [
        { type: 'bank', label: 'Bank accounts', balanceMinor: 19_630_000 },
        { type: 'investment', label: 'Investments', balanceMinor: 8_400_000 },
        { type: 'wallet', label: 'Wallets', balanceMinor: 182_000 },
        { type: 'cash', label: 'Cash', balanceMinor: 322_300 },
        { type: 'deposit', label: 'Fixed deposits', balanceMinor: 5_000_000 },
      ],
    },
  ],
  empty: { currency: CUR, groups: [] },
  render: (d, k) => {
    const groups = k.arr(d.groups).filter((g) => k.num(g.balanceMinor) > 0);
    if (!groups.length)
      return k.page(
        k.header('Balances', 'Allocation'),
        k.empty('Nothing to allocate', 'Add accounts with a positive balance.', 'wallet'),
      );
    return k.page(
      k.header('Balances', 'Where your money sits'),
      k.card(
        k.donut({
          items: groups.map((g) => ({ label: g.label || g.type, value: k.num(g.balanceMinor) })),
          currency: d.currency,
          centerLabel: 'Total',
          title: 'Balance by account type',
        }),
      ),
    );
  },
});

type Liquidity = {
  currency: string;
  monthlySpendMinor: Minor;
  buckets: Array<{ label: string; balanceMinor: Minor; availableIn: string }>;
};

export const liquidity = defineWidget<Liquidity>({
  domain: 'balances',
  name: 'liquidity',
  title: 'Liquidity',
  description:
    'How quickly your money can be reached, and how many months of spending each tier covers.',
  examples: [
    {
      currency: CUR,
      monthlySpendMinor: 4_200_000,
      buckets: [
        { label: 'Cash & wallets', balanceMinor: 504_300, availableIn: 'Now' },
        { label: 'Savings accounts', balanceMinor: 19_630_000, availableIn: 'Same day' },
        { label: 'Fixed deposits', balanceMinor: 5_000_000, availableIn: '1–3 days' },
        { label: 'Investments', balanceMinor: 8_400_000, availableIn: '3–5 days' },
      ],
    },
  ],
  empty: { currency: CUR, monthlySpendMinor: 0, buckets: [] },
  render: (d, k) => {
    const buckets = k.arr(d.buckets);
    if (!buckets.length)
      return k.page(
        k.header('Balances', 'Liquidity'),
        k.empty('No balances yet', 'Add accounts to see how liquid your money is.', 'cash'),
      );
    const spend = k.num(d.monthlySpendMinor);
    let running = 0;
    return k.page(
      k.header('Balances', 'Liquidity'),
      k.hero({
        label: 'Months of spending covered',
        value: spend
          ? (k.sum(buckets.map((b) => b.balanceMinor)) / spend).toFixed(1) + ' months'
          : '—',
        sub: spend ? 'At ' + k.money(spend, d.currency) + ' a month' : undefined,
      }),
      k.card(
        buckets
          .map((b) => {
            running += k.num(b.balanceMinor);
            return k.meter({
              label: b.label + ' · ' + b.availableIn,
              value: running,
              max: spend * 12 || running,
              valueText: k.money(b.balanceMinor, d.currency),
              sub: spend ? 'Cumulative ' + (running / spend).toFixed(1) + ' months' : undefined,
              tone: 'accent',
            });
          })
          .join(''),
      ),
    );
  },
});

type Debts = {
  currency: string;
  debts: Array<{
    name: string;
    balanceMinor: Minor;
    limitMinor?: Minor;
    rate?: number;
    minimumMinor?: Minor;
    dueAt?: number;
  }>;
};

export const debts = defineWidget<Debts>({
  domain: 'balances',
  name: 'debts',
  title: 'Debts',
  description: 'Cards and loans with balances, interest rates, minimum payments and due dates.',
  examples: [
    {
      currency: CUR,
      debts: [
        {
          name: 'HDFC Regalia card',
          balanceMinor: 1_240_000,
          limitMinor: 30_000_000,
          rate: 0.42,
          minimumMinor: 62_000,
          dueAt: Date.UTC(2026, 11, 5),
        },
        {
          name: 'Bike loan',
          balanceMinor: 6_800_000,
          rate: 0.105,
          minimumMinor: 412_000,
          dueAt: Date.UTC(2026, 11, 10),
        },
        { name: 'Owed to Meera', balanceMinor: 250_000 },
      ],
    },
  ],
  empty: { currency: CUR, debts: [] },
  render: (d, k) => {
    const list = k
      .arr(d.debts)
      .slice()
      .sort((a, b) => (b.rate || 0) - (a.rate || 0));
    if (!list.length)
      return k.page(
        k.header('Balances', 'Debts'),
        k.empty('Debt free', 'No cards, loans or IOUs with a balance.', 'check'),
      );
    return k.page(
      k.header('Balances', 'Debts', k.pill('Highest rate first')),
      k.stats([
        {
          label: 'Total owed',
          value: k.money(k.sum(list.map((x) => x.balanceMinor)), d.currency),
          tone: 'expense',
        },
        {
          label: 'Minimums due',
          value: k.money(k.sum(list.map((x) => x.minimumMinor || 0)), d.currency),
        },
      ]),
      k.list(
        list.map((x) =>
          k.row({
            lead: k.tile(k.icon(x.limitMinor ? 'card' : 'swap', 16), 'expense'),
            title: x.name,
            sub: [
              x.rate ? k.percent(x.rate, 1) + ' APR' : '',
              x.minimumMinor ? 'Min ' + k.money(x.minimumMinor, d.currency) : '',
              x.dueAt ? 'Due ' + k.date(x.dueAt, 'day') : '',
            ]
              .filter(Boolean)
              .join(' · '),
            value: k.money(x.balanceMinor, d.currency),
            valueTone: 'expense',
            html: x.limitMinor
              ? '<div style="margin-top:6px">' +
                k.progress(k.num(x.balanceMinor) / k.num(x.limitMinor), 'expense') +
                '</div>'
              : '',
          }),
        ),
      ),
    );
  },
});

type Daily = {
  currency: string;
  days: Array<{ label: string; balanceMinor: Minor }>;
  lowMinor?: Minor;
};

const daily = walk(30, 18_000_000, -40_000, 420_000, 9);

export const dailyBalance = defineWidget<Daily>({
  domain: 'balances',
  name: 'dailyBalance',
  title: 'Daily balance',
  description: 'Your combined balance day by day for the last 30 days, with the low point marked.',
  examples: [
    {
      currency: CUR,
      days: daily.map((v, i) => ({
        label: String(((i + 27) % 30) + 1) + (i === 0 ? ' Oct' : ''),
        balanceMinor: v,
      })),
      lowMinor: Math.min(...daily),
    },
  ],
  empty: { currency: CUR, days: [] },
  render: (d, k) => {
    const days = k.arr(d.days);
    if (days.length < 2)
      return k.page(
        k.header('Balances', 'Daily balance'),
        k.empty(
          'Not enough history',
          'A few days of activity will draw your balance line.',
          'trend',
        ),
      );
    const values = days.map((x) => k.num(x.balanceMinor));
    const last = values[values.length - 1]!;
    const low = d.lowMinor !== undefined ? k.num(d.lowMinor) : Math.min(...values);
    return k.page(
      k.header('Balances', 'Daily balance', k.pill(days.length + ' days')),
      k.stats([
        { label: 'Today', value: k.money(last, d.currency) },
        { label: 'Low', value: k.money(low, d.currency), tone: 'warn' },
        { label: 'High', value: k.money(Math.max(...values), d.currency) },
      ]),
      k.card(
        k.lineChart({
          labels: days.map((x) => x.label),
          series: [{ name: 'Balance', values, tone: 0 }],
          currency: d.currency,
          zero: false,
          ref: { value: low, label: 'Low' },
          title: 'Balance by day',
        }),
      ),
    );
  },
});

type Snapshot = {
  currency: string;
  tiles: Array<{
    label: string;
    valueMinor: Minor;
    changePct?: number;
    trend?: number[];
    goodWhen?: 'up' | 'down';
  }>;
};

export const snapshot = defineWidget<Snapshot>({
  domain: 'balances',
  name: 'snapshot',
  title: 'Money snapshot',
  description:
    'Key numbers at a glance — balance, spent, income, saved — each with a sparkline and change.',
  examples: [
    {
      currency: CUR,
      tiles: [
        {
          label: 'Balance',
          valueMinor: 18_742_300,
          changePct: 0.042,
          trend: series(8, 17_000_000, 0.05, 3),
        },
        {
          label: 'Spent this month',
          valueMinor: 4_218_050,
          changePct: 0.081,
          goodWhen: 'down',
          trend: series(8, 4_000_000, 0.2, 5),
        },
        {
          label: 'Income',
          valueMinor: 9_500_000,
          changePct: 0,
          trend: series(8, 9_500_000, 0.02, 6),
        },
        {
          label: 'Saved',
          valueMinor: 5_281_950,
          changePct: -0.05,
          trend: series(8, 5_400_000, 0.15, 7),
        },
      ],
    },
  ],
  empty: { currency: CUR, tiles: [] },
  render: (d, k) => {
    const tiles = k.arr(d.tiles);
    if (!tiles.length)
      return k.page(
        k.header('Snapshot', 'Your money'),
        k.empty(
          'Nothing to show yet',
          'Numbers appear once you have accounts and activity.',
          'spark',
        ),
      );
    return k.page(
      k.header('Snapshot', 'Your money'),
      k.stats(
        tiles.map((t) => ({
          label: t.label,
          value: k.money(t.valueMinor, d.currency),
          delta: t.changePct,
          goodWhen: t.goodWhen,
          spark: k.arr(t.trend),
        })),
        150,
      ),
    );
  },
});

export const balanceWidgets = [
  netWorth,
  assetsLiabilities,
  totalsByCurrency,
  allocation,
  liquidity,
  debts,
  dailyBalance,
  snapshot,
];
