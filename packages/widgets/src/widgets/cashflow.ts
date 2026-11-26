import { CUR, DAY, NOW, dayLabels, monthLabels, series, walk } from '../sample';
import { defineWidget, type Minor } from '../types';

type Monthly = {
  currency: string;
  months: Array<{ label: string; inMinor: Minor; outMinor: Minor }>;
};
const ins = series(12, 10_000_000, 0.15, 301);
const outs = series(12, 7_400_000, 0.3, 302);

export const monthly = defineWidget<Monthly>({
  domain: 'cashflow',
  name: 'monthly',
  title: 'Cash flow',
  description: 'Money in above the line, money out below, and the net line, month by month.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(12).map((label, i) => ({ label, inMinor: ins[i]!, outMinor: outs[i]! })),
    },
  ],
  empty: { currency: CUR, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Cash flow', 'Monthly'),
        k.empty('No cash flow yet', 'Income and expenses will be charted here by month.', 'trend'),
      );
    const net = months.map((m) => k.num(m.inMinor) - k.num(m.outMinor));
    const negative = net.filter((n) => n < 0).length;
    return k.page(
      k.header(
        'Cash flow',
        months.length + ' months',
        negative
          ? k.pill(k.plural(negative, 'month') + ' negative', 'warn')
          : k.pill('Always positive', 'income'),
      ),
      k.stats([
        {
          label: 'Average net',
          value: k.money(k.avg(net), d.currency, { sign: true }),
          tone: k.toneOf(k.avg(net)),
        },
        {
          label: 'Best month',
          value: k.money(Math.max(...net), d.currency, { sign: true }),
          tone: 'income',
        },
        {
          label: 'Worst month',
          value: k.money(Math.min(...net), d.currency, { sign: true }),
          tone: k.toneOf(Math.min(...net)),
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
          net,
          currency: d.currency,
          height: 220,
          title: 'Cash flow by month',
        }),
      ),
    );
  },
});

type Period = {
  currency: string;
  incomeMinor: Minor;
  spentMinor: Minor;
  startAt: number;
  endAt: number;
  pageCount?: number;
  partial?: boolean;
};

/** Linked to `finapp.finance.dashboard.summary`. */
export const periodSummary = defineWidget<Period>({
  domain: 'cashflow',
  name: 'periodSummary',
  title: 'Period summary',
  description:
    'Income, spending and net for a date window, with the split as a bar and a note when the window was partial.',
  examples: [
    {
      currency: CUR,
      incomeMinor: 9_500_000,
      spentMinor: 4_218_050,
      startAt: NOW - 30 * DAY,
      endAt: NOW,
      pageCount: 104,
      partial: false,
    },
  ],
  empty: { currency: CUR, incomeMinor: 0, spentMinor: 0, startAt: NOW - 30 * DAY, endAt: NOW },
  render: (d, k) => {
    const income = k.num(d.incomeMinor);
    const spent = k.num(d.spentMinor);
    const range = k.date(d.startAt, 'day') + ' – ' + k.date(d.endAt, 'day');
    if (!income && !spent)
      return k.page(
        k.header('Summary', range),
        k.empty('No activity in this window', 'Try a longer date range.', 'calendar'),
      );
    return k.page(
      k.header('Summary', range, d.partial ? k.pill('Partial', 'warn') : ''),
      k.hero({
        label: 'Net',
        value: k.money(income - spent, d.currency, { sign: true }),
        tone: k.toneOf(income - spent),
        sub: income ? 'Kept ' + k.percent((income - spent) / income) + ' of income' : undefined,
      }),
      k.stats([
        { label: 'Income', value: k.money(income, d.currency), tone: 'income' },
        { label: 'Spent', value: k.money(spent, d.currency), tone: 'expense' },
        d.pageCount !== undefined ? { label: 'Transactions', value: String(d.pageCount) } : null,
      ]),
      income || spent
        ? k.card(
            k.segments({
              items: [
                { label: 'Spent', value: spent, tone: 'expense' },
                { label: 'Kept', value: Math.max(0, income - spent), tone: 'income' },
              ],
              currency: d.currency,
              title: 'Income split',
            }),
          )
        : '',
      d.partial
        ? k.note(
            'Only the first page of transactions was counted. Ask for the next page for an exact total.',
          )
        : '',
    );
  },
});

type Waterfall = {
  currency: string;
  period: string;
  openingMinor: Minor;
  steps: Array<{ label: string; amountMinor: Minor }>;
};

export const waterfall = defineWidget<Waterfall>({
  domain: 'cashflow',
  name: 'waterfall',
  title: 'Balance bridge',
  description:
    'How your balance got from the start of the month to now: income up, each spending category down.',
  examples: [
    {
      currency: CUR,
      period: 'November',
      openingMinor: 13_460_350,
      steps: [
        { label: 'Income', amountMinor: 9_500_000 },
        { label: 'Food', amountMinor: -1_120_000 },
        { label: 'Shopping', amountMinor: -1_420_000 },
        { label: 'Bills', amountMinor: -620_000 },
        { label: 'Transport', amountMinor: -436_500 },
        { label: 'Other', amountMinor: -621_550 },
      ],
    },
  ],
  empty: { currency: CUR, period: 'This month', openingMinor: 0, steps: [] },
  render: (d, k) => {
    const steps = k.arr(d.steps);
    if (!steps.length)
      return k.page(
        k.header('Cash flow', 'Balance bridge'),
        k.empty('No movement yet', undefined, 'trend'),
      );
    let running = k.num(d.openingMinor);
    const bars: Array<{ label: string; from: number; to: number; tone: string }> = [
      { label: 'Start', from: 0, to: running, tone: 'neutral' },
    ];
    steps.forEach((s) => {
      const next = running + k.num(s.amountMinor);
      bars.push({
        label: s.label,
        from: running,
        to: next,
        tone: k.num(s.amountMinor) >= 0 ? 'income' : 'expense',
      });
      running = next;
    });
    bars.push({ label: 'Now', from: 0, to: running, tone: 'accent' });
    const top = k.max(
      bars.map((b) => Math.max(b.from, b.to)),
      1,
    );
    const W = 600;
    const H = 200;
    const left = 64;
    const step = (W - left - 8) / bars.length;
    const bw = Math.min(24, step * 0.6);
    const ticks = k.niceTicks(0, top, 4);
    const y = (v: number) => H - 24 - (v / ticks[ticks.length - 1]!) * (H - 36);
    let svg = ticks
      .map(
        (t) =>
          '<line class="grid" x1="' +
          left +
          '" x2="' +
          (W - 8) +
          '" y1="' +
          k.round(y(t)) +
          '" y2="' +
          k.round(y(t)) +
          '"/><text class="ax" x="' +
          (left - 6) +
          '" y="' +
          k.round(y(t) + 3.5) +
          '" text-anchor="end">' +
          k.esc(k.money(t, d.currency, { compact: true })) +
          '</text>',
      )
      .join('');
    bars.forEach((b, i) => {
      const x = left + step * i + (step - bw) / 2;
      const up = b.to >= b.from;
      const fill =
        b.tone === 'neutral'
          ? 'var(--other)'
          : b.tone === 'income'
            ? 'var(--income)'
            : b.tone === 'expense'
              ? 'var(--expense)'
              : 'var(--accent)';
      svg +=
        '<path d="' +
        k.barPath(x, bw, y(up ? b.from : b.to), y(up ? b.to : b.from)) +
        '" style="fill:' +
        fill +
        '" data-tip="' +
        k.esc(
          b.label +
            ': ' +
            (i === 0 || i === bars.length - 1
              ? k.money(b.to, d.currency)
              : k.money(b.to - b.from, d.currency, { sign: true })),
        ) +
        '"/>';
      if (i < bars.length - 1)
        svg +=
          '<line x1="' +
          k.round(x + bw) +
          '" x2="' +
          k.round(x + step) +
          '" y1="' +
          k.round(y(b.to)) +
          '" y2="' +
          k.round(y(b.to)) +
          '" style="stroke:var(--muted);stroke-width:1;stroke-dasharray:2 2"/>';
      svg +=
        '<text class="ax" x="' +
        k.round(x + bw / 2) +
        '" y="' +
        (H - 6) +
        '" text-anchor="middle">' +
        k.esc(b.label) +
        '</text>';
    });
    return k.page(
      k.header('Cash flow', 'Balance bridge · ' + d.period),
      k.stats([
        { label: 'Start', value: k.money(d.openingMinor, d.currency) },
        {
          label: 'Now',
          value: k.money(running, d.currency),
          delta: k.num(d.openingMinor)
            ? (running - k.num(d.openingMinor)) / k.num(d.openingMinor)
            : null,
        },
      ]),
      k.card(
        '<figure class="fig"><svg class="chart" viewBox="0 0 ' +
          W +
          ' ' +
          H +
          '" width="100%" role="img" aria-label="Balance bridge">' +
          svg +
          '</svg>' +
          k.srTable(
            'Balance bridge',
            ['Step', 'Change', 'Balance after'],
            bars.map((b) => [
              b.label,
              k.money(b.to - b.from, d.currency),
              k.money(b.to, d.currency),
            ]),
          ) +
          '</figure>',
      ),
    );
  },
});

type Runway = {
  currency: string;
  liquidMinor: Minor;
  monthlyBurnMinor: Minor;
  monthlyIncomeMinor?: Minor;
  history?: number[];
};

export const runway = defineWidget<Runway>({
  domain: 'cashflow',
  name: 'runway',
  title: 'Runway',
  description:
    'How many months your liquid money lasts at your current spending, with and without income.',
  examples: [
    {
      currency: CUR,
      liquidMinor: 25_134_300,
      monthlyBurnMinor: 4_200_000,
      monthlyIncomeMinor: 9_500_000,
      history: [4.8, 5.1, 5.0, 5.4, 5.6, 5.98],
    },
  ],
  empty: { currency: CUR, liquidMinor: 0, monthlyBurnMinor: 0 },
  render: (d, k) => {
    const burn = k.num(d.monthlyBurnMinor);
    if (!burn)
      return k.page(
        k.header('Cash flow', 'Runway'),
        k.empty(
          'Not enough spending history',
          'A month of expenses is needed to estimate runway.',
          'clock',
        ),
      );
    const months = k.num(d.liquidMinor) / burn;
    return k.page(
      k.header('Cash flow', 'Runway'),
      k.hero({
        label: 'Without any income',
        value: months.toFixed(1) + ' months',
        tone: months < 3 ? 'expense' : months < 6 ? 'warn' : 'income',
        sub:
          k.money(d.liquidMinor, d.currency) + ' liquid at ' + k.money(burn, d.currency) + '/month',
        chart: k.arr(d.history).length > 1 ? k.sparkline(k.arr(d.history), { height: 36 }) : '',
      }),
      k.card(
        k.meter({
          label: 'Emergency fund (6 months)',
          value: months,
          max: 6,
          valueText: months.toFixed(1) + ' mo',
          maxText: '6 mo',
          tone: months >= 6 ? 'income' : 'warn',
        }),
      ),
      d.monthlyIncomeMinor !== undefined
        ? k.note(
            k.num(d.monthlyIncomeMinor) >= burn
              ? 'With your current income you are cash-flow positive — runway keeps growing.'
              : 'Income covers ' + k.percent(k.num(d.monthlyIncomeMinor) / burn) + ' of spending.',
          )
        : '',
    );
  },
});

type Projection = {
  currency: string;
  days: string[];
  balanceMinor: number[];
  bills: Array<{ day: number; name: string; amountMinor: Minor }>;
  lowWaterMinor?: Minor;
};
const proj = walk(30, 18_000_000, -120_000, 80_000, 311).map((v, i) =>
  i === 3 ? v + 9_500_000 : v,
);
for (let i = 4; i < 30; i++) proj[i] = proj[i]! + 9_500_000;

export const projection = defineWidget<Projection>({
  domain: 'cashflow',
  name: 'projection',
  title: '30-day projection',
  description:
    'Your projected balance for the next 30 days including scheduled bills and paydays, with the low point.',
  examples: [
    {
      currency: CUR,
      days: dayLabels(30).map((_, i) => String(((26 + i) % 30) + 1)),
      balanceMinor: proj,
      bills: [
        { day: 2, name: 'Rent', amountMinor: 2_800_000 },
        { day: 6, name: 'Card bill', amountMinor: 1_240_000 },
        { day: 12, name: 'SIP', amountMinor: 1_000_000 },
      ],
      lowWaterMinor: 1_000_000,
    },
  ],
  empty: { currency: CUR, days: [], balanceMinor: [], bills: [] },
  render: (d, k) => {
    const v = k.arr(d.balanceMinor);
    if (v.length < 2)
      return k.page(
        k.header('Cash flow', 'Projection'),
        k.empty(
          'Nothing scheduled',
          'Add recurring bills and income to project your balance.',
          'trend',
        ),
      );
    const low = Math.min(...v);
    return k.page(
      k.header(
        'Cash flow',
        'Next 30 days',
        low < k.num(d.lowWaterMinor || 0)
          ? k.pill('Dips below safety', 'expense')
          : k.pill('Stays healthy', 'income'),
      ),
      k.card(
        k.lineChart({
          labels: d.days,
          series: [{ name: 'Projected balance', values: v, tone: 0 }],
          currency: d.currency,
          zero: false,
          smooth: false,
          ref:
            d.lowWaterMinor !== undefined
              ? { value: k.num(d.lowWaterMinor), label: 'Safety buffer' }
              : undefined,
          title: 'Projected balance',
        }),
      ),
      k.arr(d.bills).length
        ? k.section(
            'Scheduled',
            k.list(
              d.bills.map((b) =>
                k.row({
                  lead: k.tile(k.icon('calendar', 16), 'warn'),
                  title: b.name,
                  sub: 'Day ' + (b.day + 1),
                  value: '−' + k.money(b.amountMinor, d.currency),
                  valueTone: 'expense',
                }),
              ),
            ),
          )
        : '',
    );
  },
});

type Weekly = {
  currency: string;
  weeks: Array<{ label: string; inMinor: Minor; outMinor: Minor }>;
};

export const weeklyFlow = defineWidget<Weekly>({
  domain: 'cashflow',
  name: 'weekly',
  title: 'Weekly cash flow',
  description: 'Money in and out per week with the net line, for the last 8 weeks.',
  examples: [
    {
      currency: CUR,
      weeks: Array.from({ length: 8 }, (_, i) => ({
        label: 'W' + (41 + i),
        inMinor: i % 4 === 3 ? 9_500_000 : series(8, 300_000, 0.9, 321)[i]!,
        outMinor: series(8, 1_050_000, 0.4, 322)[i]!,
      })),
    },
  ],
  empty: { currency: CUR, weeks: [] },
  render: (d, k) => {
    const weeks = k.arr(d.weeks);
    if (!weeks.length)
      return k.page(
        k.header('Cash flow', 'Weekly'),
        k.empty('No weekly activity yet', undefined, 'trend'),
      );
    return k.page(
      k.header('Cash flow', 'Weekly'),
      k.card(
        k.columns({
          labels: weeks.map((w) => w.label),
          series: [
            { name: 'In', values: weeks.map((w) => k.num(w.inMinor)) },
            { name: 'Out', values: weeks.map((w) => k.num(w.outMinor)) },
          ],
          mode: 'diverging',
          currency: d.currency,
          title: 'Weekly cash flow',
        }),
      ),
    );
  },
});

type Ratio = {
  currency: string;
  incomeMinor: Minor;
  expenseMinor: Minor;
  fixedMinor: Minor;
  variableMinor: Minor;
};

export const fixedVariable = defineWidget<Ratio>({
  domain: 'cashflow',
  name: 'fixedVsVariable',
  title: 'Fixed vs variable costs',
  description:
    'How much of your income is committed to fixed costs versus flexible spending, and what is left.',
  examples: [
    {
      currency: CUR,
      incomeMinor: 9_500_000,
      expenseMinor: 4_218_050,
      fixedMinor: 2_260_000,
      variableMinor: 1_958_050,
    },
  ],
  empty: { currency: CUR, incomeMinor: 0, expenseMinor: 0, fixedMinor: 0, variableMinor: 0 },
  render: (d, k) => {
    const income = k.num(d.incomeMinor);
    if (!income && !k.num(d.expenseMinor))
      return k.page(
        k.header('Cash flow', 'Fixed vs variable'),
        k.empty('No data yet', undefined, 'spark'),
      );
    const left = Math.max(0, income - k.num(d.fixedMinor) - k.num(d.variableMinor));
    return k.page(
      k.header('Cash flow', 'Fixed vs variable'),
      k.card(
        k.segments({
          items: [
            { label: 'Fixed', value: k.num(d.fixedMinor), tone: 0 },
            { label: 'Variable', value: k.num(d.variableMinor), tone: 1 },
            { label: 'Left over', value: left, tone: 'income' },
          ],
          currency: d.currency,
          title: 'Income split',
        }),
      ),
      k.note(
        income
          ? 'Fixed costs take ' +
              k.percent(k.num(d.fixedMinor) / income) +
              ' of your income before any choices.'
          : '',
      ),
    );
  },
});

type NetTrend = { currency: string; labels: string[]; netMinor: number[]; cumulative?: boolean };

export const netTrend = defineWidget<NetTrend>({
  domain: 'cashflow',
  name: 'netTrend',
  title: 'Net savings over time',
  description: 'Cumulative net (income minus spending) over the year as an area line.',
  examples: [
    {
      currency: CUR,
      labels: monthLabels(12),
      netMinor: ins
        .map((v, i) => v - outs[i]!)
        .reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] || 0) + v], []),
      cumulative: true,
    },
  ],
  empty: { currency: CUR, labels: [], netMinor: [] },
  render: (d, k) => {
    const v = k.arr(d.netMinor);
    if (v.length < 2)
      return k.page(
        k.header('Cash flow', 'Net over time'),
        k.empty('Not enough history', undefined, 'trend'),
      );
    return k.page(
      k.header(
        'Cash flow',
        d.cumulative ? 'Saved so far this year' : 'Net by month',
        k.pill(k.money(v[v.length - 1], d.currency, { sign: true }), k.toneOf(v[v.length - 1]!)),
      ),
      k.card(
        k.lineChart({
          labels: d.labels,
          series: [{ name: 'Net', values: v, tone: 'income' }],
          currency: d.currency,
          area: true,
          title: 'Net savings',
        }),
      ),
    );
  },
});

export const cashflowWidgets = [
  monthly,
  periodSummary,
  waterfall,
  runway,
  projection,
  weeklyFlow,
  fixedVariable,
  netTrend,
];
