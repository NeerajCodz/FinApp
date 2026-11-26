import { CUR, monthLabels, series } from '../sample';
import { defineWidget, type Minor } from '../types';

type Summary = {
  currency: string;
  period: string;
  totalMinor: Minor;
  previousMinor?: Minor;
  sources: Array<{ name: string; amountMinor: Minor }>;
  trend?: number[];
};

export const incomeSummary = defineWidget<Summary>({
  domain: 'income',
  name: 'summary',
  title: 'Income',
  description: 'Total income for the period with change, sparkline and the sources it came from.',
  examples: [
    {
      currency: CUR,
      period: 'November',
      totalMinor: 11_350_000,
      previousMinor: 10_200_000,
      sources: [
        { name: 'Salary', amountMinor: 9_500_000 },
        { name: 'Freelance design', amountMinor: 1_250_000 },
        { name: 'Interest', amountMinor: 180_000 },
        { name: 'Cashback', amountMinor: 420_000 },
      ],
      trend: series(8, 10_500_000, 0.1, 201),
    },
  ],
  empty: { currency: CUR, period: 'This month', totalMinor: 0, sources: [] },
  render: (d, k) => {
    if (!k.num(d.totalMinor))
      return k.page(
        k.header('Income', d.period),
        k.empty('No income yet', 'Income you record this period shows up here.', 'cash'),
      );
    const change = d.previousMinor
      ? (k.num(d.totalMinor) - k.num(d.previousMinor)) / k.num(d.previousMinor)
      : null;
    return k.page(
      k.header('Income', d.period, k.delta(change)),
      k.hero({
        label: 'Total income',
        value: k.money(d.totalMinor, d.currency),
        tone: 'income',
        chart:
          k.arr(d.trend).length > 1
            ? k.sparkline(k.arr(d.trend), { tone: 'income', height: 40 })
            : '',
      }),
      k.list(
        k
          .arr(d.sources)
          .map((s) =>
            k.row({
              lead: k.glyph(s.name, undefined, 'income'),
              title: s.name,
              value: '+' + k.money(s.amountMinor, d.currency),
              valueTone: 'income',
              valueSub: k.percent(k.num(s.amountMinor) / k.num(d.totalMinor)),
            }),
          ),
      ),
    );
  },
});

type Sources = {
  currency: string;
  period: string;
  sources: Array<{ name: string; amountMinor: Minor }>;
};

export const incomeSources = defineWidget<Sources>({
  domain: 'income',
  name: 'bySource',
  title: 'Income by source',
  description: 'A donut of where your income comes from, with shares and how concentrated it is.',
  examples: [
    {
      currency: CUR,
      period: 'Last 12 months',
      sources: [
        { name: 'Salary', amountMinor: 114_000_000 },
        { name: 'Freelance', amountMinor: 14_800_000 },
        { name: 'Rent from flat', amountMinor: 18_000_000 },
        { name: 'Dividends', amountMinor: 2_400_000 },
        { name: 'Interest', amountMinor: 1_900_000 },
      ],
    },
  ],
  empty: { currency: CUR, period: 'Last 12 months', sources: [] },
  render: (d, k) => {
    const list = k.arr(d.sources).filter((s) => k.num(s.amountMinor) > 0);
    if (!list.length)
      return k.page(k.header('Income', 'By source'), k.empty('No income yet', undefined, 'cash'));
    const total = k.sum(list.map((s) => s.amountMinor));
    const top = list.slice().sort((a, b) => k.num(b.amountMinor) - k.num(a.amountMinor))[0]!;
    return k.page(
      k.header('Income by source', d.period),
      k.card(
        k.donut({
          items: list.map((s) => ({ label: s.name, value: k.num(s.amountMinor) })),
          currency: d.currency,
          centerLabel: 'Earned',
          title: 'Income by source',
        }),
      ),
      k.note(
        top.name +
          ' is ' +
          k.percent(k.num(top.amountMinor) / total) +
          ' of your income' +
          (k.num(top.amountMinor) / total > 0.75 ? ' — consider diversifying.' : '.'),
      ),
    );
  },
});

type Monthly = { currency: string; months: Array<{ label: string; amountMinor: Minor }> };
const inc = series(12, 9_800_000, 0.12, 211);

export const incomeTrend = defineWidget<Monthly>({
  domain: 'income',
  name: 'trend',
  title: 'Income trend',
  description: 'Monthly income as columns with the 12-month average.',
  examples: [
    { currency: CUR, months: monthLabels(12).map((label, i) => ({ label, amountMinor: inc[i]! })) },
  ],
  empty: { currency: CUR, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(k.header('Income', 'Trend'), k.empty('No income history', undefined, 'trend'));
    const values = months.map((m) => k.num(m.amountMinor));
    return k.page(
      k.header('Income', 'Monthly trend'),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [{ name: 'Income', values, tone: 'income' }],
          currency: d.currency,
          ref: { value: k.avg(values), label: 'Average' },
          title: 'Monthly income',
        }),
      ),
    );
  },
});

type VsExp = {
  currency: string;
  months: Array<{ label: string; incomeMinor: Minor; expenseMinor: Minor }>;
};
const exp = series(12, 4_200_000, 0.22, 212);

export const incomeVsExpenses = defineWidget<VsExp>({
  domain: 'income',
  name: 'vsExpenses',
  title: 'Income vs expenses',
  description: 'Income and expenses side by side each month, with how much you kept.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(6).map((label, i) => ({
        label,
        incomeMinor: inc[i + 6]!,
        expenseMinor: exp[i + 6]!,
      })),
    },
  ],
  empty: { currency: CUR, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Income', 'vs expenses'),
        k.empty('No activity yet', undefined, 'trend'),
      );
    const kept = k.sum(months.map((m) => k.num(m.incomeMinor) - k.num(m.expenseMinor)));
    return k.page(
      k.header(
        'Income vs expenses',
        months.length + ' months',
        k.pill(
          'Kept ' + k.money(kept, d.currency, { compact: true }),
          kept >= 0 ? 'income' : 'expense',
        ),
      ),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [
            { name: 'Income', values: months.map((m) => k.num(m.incomeMinor)), tone: 'income' },
            { name: 'Expenses', values: months.map((m) => k.num(m.expenseMinor)), tone: 'expense' },
          ],
          currency: d.currency,
          title: 'Income and expenses by month',
        }),
      ),
    );
  },
});

type Paydays = {
  currency: string;
  upcoming: Array<{ name: string; expectedAt: number; amountMinor: Minor; account?: string }>;
  received: Array<{ name: string; receivedAt: number; amountMinor: Minor }>;
};

export const paydays = defineWidget<Paydays>({
  domain: 'income',
  name: 'paydays',
  title: 'Paydays',
  description: 'Expected income coming up and what has already landed this month.',
  examples: [
    {
      currency: CUR,
      upcoming: [
        {
          name: 'Salary — Acme Corp',
          expectedAt: Date.UTC(2026, 10, 30),
          amountMinor: 9_500_000,
          account: 'ICICI Salary',
        },
        {
          name: 'Rent — flat 2A',
          expectedAt: Date.UTC(2026, 11, 5),
          amountMinor: 1_500_000,
          account: 'HDFC Savings',
        },
      ],
      received: [
        {
          name: 'Freelance — Studio North',
          receivedAt: Date.UTC(2026, 10, 14),
          amountMinor: 1_250_000,
        },
        { name: 'Interest', receivedAt: Date.UTC(2026, 10, 1), amountMinor: 180_000 },
      ],
    },
  ],
  empty: { currency: CUR, upcoming: [], received: [] },
  render: (d, k) => {
    const up = k.arr(d.upcoming);
    const got = k.arr(d.received);
    if (!up.length && !got.length)
      return k.page(
        k.header('Income', 'Paydays'),
        k.empty('No paydays set up', 'Add recurring income to see when money lands.', 'calendar'),
      );
    return k.page(
      k.header('Income', 'Paydays'),
      up.length
        ? k.section(
            'Coming up',
            k.list(
              up.map((p) =>
                k.row({
                  lead: k.tile(k.icon('calendar', 16), 'income'),
                  title: p.name,
                  sub:
                    k.date(p.expectedAt, 'weekday') +
                    ' · in ' +
                    Math.max(0, k.daysUntil(p.expectedAt)) +
                    ' days' +
                    (p.account ? ' · ' + p.account : ''),
                  value: '+' + k.money(p.amountMinor, d.currency),
                  valueTone: 'income',
                }),
              ),
            ),
          )
        : '',
      got.length
        ? k.section(
            'Received',
            k.list(
              got.map((p) =>
                k.row({
                  lead: k.tile(k.icon('check', 16), 'income'),
                  title: p.name,
                  sub: k.date(p.receivedAt, 'day'),
                  value: '+' + k.money(p.amountMinor, d.currency),
                  valueTone: 'income',
                }),
              ),
            ),
          )
        : '',
    );
  },
});

type Rate = { months: Array<{ label: string; rate: number }>; current: number; target?: number };
const rates = series(12, 4600, 0.25, 213, 1).map((v) => v / 10000);

export const savingsRate = defineWidget<Rate>({
  domain: 'income',
  name: 'savingsRate',
  title: 'Savings rate',
  description:
    'The share of income you kept this month as a ring, with the 12-month trend and your target.',
  examples: [
    {
      months: monthLabels(12).map((label, i) => ({ label, rate: rates[i]! })),
      current: rates[11]!,
      target: 0.4,
    },
  ],
  empty: { months: [], current: 0 },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Savings', 'Savings rate'),
        k.empty(
          'Not enough data',
          'Record income and expenses for a month to see your rate.',
          'target',
        ),
      );
    const hit = d.target === undefined || d.current >= d.target;
    return k.page(
      k.header(
        'Savings',
        'Savings rate',
        d.target !== undefined
          ? k.pill('Target ' + k.percent(d.target), hit ? 'income' : 'warn')
          : '',
      ),
      k.card(
        '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: d.current,
            size: 112,
            tone: hit ? 'income' : 'warn',
            label: 'This month',
          }) +
          '<div class="grow" style="min-width:220px">' +
          k.lineChart({
            labels: months.map((m) => m.label),
            series: [{ name: 'Savings rate', values: months.map((m) => m.rate), tone: 'accent' }],
            format: 'percent',
            height: 150,
            ref: d.target !== undefined ? { value: d.target, label: 'Target' } : undefined,
            title: 'Savings rate by month',
          }) +
          '</div></div>',
      ),
    );
  },
});

type Salary = {
  currency: string;
  employer: string;
  history: Array<{ label: string; amountMinor: Minor }>;
  raises?: Array<{ at: string; pct: number }>;
};

export const salaryHistory = defineWidget<Salary>({
  domain: 'income',
  name: 'salaryHistory',
  title: 'Salary history',
  description: 'Your take-home pay over time with raises marked.',
  examples: [
    {
      currency: CUR,
      employer: 'Acme Corp',
      history: [
        'Q1 24',
        'Q2 24',
        'Q3 24',
        'Q4 24',
        'Q1 25',
        'Q2 25',
        'Q3 25',
        'Q4 25',
        'Q1 26',
        'Q2 26',
        'Q3 26',
        'Q4 26',
      ].map((label, i) => ({
        label,
        amountMinor: i < 4 ? 7_800_000 : i < 9 ? 8_600_000 : 9_500_000,
      })),
      raises: [
        { at: 'Q1 25', pct: 0.103 },
        { at: 'Q2 26', pct: 0.105 },
      ],
    },
  ],
  empty: { currency: CUR, employer: '', history: [] },
  render: (d, k) => {
    const h = k.arr(d.history);
    if (h.length < 2)
      return k.page(
        k.header('Income', 'Salary history'),
        k.empty(
          'Not enough salary history',
          'Mark an income category as salary to track it.',
          'trend',
        ),
      );
    const first = k.num(h[0]!.amountMinor);
    const last = k.num(h[h.length - 1]!.amountMinor);
    return k.page(
      k.header(
        'Salary',
        d.employer || 'Take-home pay',
        k.delta(first ? (last - first) / first : null),
      ),
      k.card(
        k.lineChart({
          labels: h.map((p) => p.label),
          series: [
            {
              name: 'Monthly take-home',
              values: h.map((p) => k.num(p.amountMinor)),
              tone: 'income',
            },
          ],
          currency: d.currency,
          zero: false,
          smooth: false,
          title: 'Take-home pay',
        }),
      ),
      k.arr(d.raises).length
        ? k.timeline(
            k
              .arr(d.raises)
              .map((r) => ({
                title: 'Raise of ' + k.percent(r.pct, 1),
                sub: r.at,
                tone: 'income' as const,
                icon: 'up',
              })),
          )
        : '',
    );
  },
});

type Side = {
  currency: string;
  goalMinor?: Minor;
  months: Array<{ label: string; amountMinor: Minor }>;
  clients: Array<{ name: string; amountMinor: Minor; invoices: number }>;
};

export const sideIncome = defineWidget<Side>({
  domain: 'income',
  name: 'sideIncome',
  title: 'Side income',
  description: 'Freelance and side-hustle earnings by month and by client, against a yearly goal.',
  examples: [
    {
      currency: CUR,
      goalMinor: 20_000_000,
      months: monthLabels(11).map((label, i) => ({
        label,
        amountMinor: series(11, 1_300_000, 0.7, 221)[i]!,
      })),
      clients: [
        { name: 'Studio North', amountMinor: 6_200_000, invoices: 5 },
        { name: 'Pixel & Co', amountMinor: 4_100_000, invoices: 3 },
        { name: 'Bloom Cafe', amountMinor: 1_800_000, invoices: 2 },
      ],
    },
  ],
  empty: { currency: CUR, months: [], clients: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Income', 'Side income'),
        k.empty('No side income yet', 'Tag freelance income to track it here.', 'spark'),
      );
    const total = k.sum(months.map((m) => m.amountMinor));
    return k.page(
      k.header('Income', 'Side income'),
      d.goalMinor !== undefined
        ? k.card(
            k.meter({
              label: 'Yearly goal',
              value: total,
              max: k.num(d.goalMinor),
              valueText: k.money(total, d.currency),
              maxText: k.money(d.goalMinor, d.currency),
              tone: 'income',
            }),
          )
        : '',
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [
            {
              name: 'Side income',
              values: months.map((m) => k.num(m.amountMinor)),
              tone: 'income',
            },
          ],
          currency: d.currency,
          height: 160,
          title: 'Side income by month',
        }),
      ),
      k.arr(d.clients).length
        ? k.section(
            'By client',
            k.card(
              k.barList({
                items: d.clients.map((c) => ({
                  label: c.name,
                  value: k.num(c.amountMinor),
                  sub: k.plural(c.invoices, 'invoice'),
                  tone: 'income',
                })),
                currency: d.currency,
                title: 'Side income by client',
              }),
            ),
          )
        : '',
    );
  },
});

export const incomeWidgets = [
  incomeSummary,
  incomeSources,
  incomeTrend,
  incomeVsExpenses,
  paydays,
  savingsRate,
  salaryHistory,
  sideIncome,
];
