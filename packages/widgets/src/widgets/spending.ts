import {
  CATEGORIES,
  CUR,
  MERCHANTS,
  WEEKDAYS,
  dayLabels,
  monthLabels,
  rng,
  series,
} from '../sample';
import { defineWidget, type Minor } from '../types';

type Cat = { name: string; icon?: string; amountMinor: Minor; count?: number; changePct?: number };
type ByCategory = { currency: string; period: string; categories: Cat[] };

const catAmounts = [
  1_120_000, 910_000, 436_500, 1_420_000, 620_000, 380_000, 210_000, 840_000, 120_000, 95_000,
];
const CATS: Cat[] = CATEGORIES.map((c, i) => ({
  name: c.name,
  icon: c.icon,
  amountMinor: catAmounts[i]!,
  count: 4 + ((i * 7) % 19),
  changePct: [0.12, -0.05, 0.31, 0.44, 0, -0.18, 0.06, 1.2, -0.4, 0.1][i],
}));
const emptyCats: ByCategory = { currency: CUR, period: 'This month', categories: [] };

export const byCategory = defineWidget<ByCategory>({
  domain: 'spending',
  name: 'byCategory',
  title: 'Spending by category',
  description:
    'Where the money went: a donut of categories with the total in the centre and a legend table (folds into Other past 8).',
  examples: [{ currency: CUR, period: 'November', categories: CATS }],
  empty: emptyCats,
  render: (d, k) => {
    const cats = k.arr(d.categories).filter((c) => k.num(c.amountMinor) > 0);
    if (!cats.length)
      return k.page(
        k.header('Spending', d.period),
        k.empty(
          'No spending yet',
          'Expenses in this period will be broken down by category.',
          'spark',
        ),
      );
    return k.page(
      k.header('Spending by category', d.period),
      k.card(
        k.donut({
          items: cats.map((c) => ({
            label: (c.icon ? c.icon + ' ' : '') + c.name,
            value: k.num(c.amountMinor),
          })),
          currency: d.currency,
          centerLabel: 'Spent',
          centerValue: k.money(k.sum(cats.map((c) => c.amountMinor)), d.currency, {
            compact: true,
          }),
          title: 'Spending by category',
        }),
      ),
    );
  },
});

export const categoryRanking = defineWidget<ByCategory>({
  domain: 'spending',
  name: 'categoryRanking',
  title: 'Top categories',
  description:
    'Categories ranked by spend as bars, with transaction counts and change from last period.',
  examples: [{ currency: CUR, period: 'November', categories: CATS }],
  empty: emptyCats,
  render: (d, k) => {
    const cats = k.arr(d.categories).filter((c) => k.num(c.amountMinor) > 0);
    if (!cats.length)
      return k.page(
        k.header('Top categories', d.period),
        k.empty('No spending yet', undefined, 'spark'),
      );
    return k.page(
      k.header('Top categories', d.period),
      k.card(
        k.barList({
          items: cats.map((c) => ({
            label: c.name,
            value: k.num(c.amountMinor),
            lead: k.glyph(c.name, c.icon),
            sub: k.join([
              c.count ? k.plural(c.count, 'transaction') : '',
              c.changePct !== undefined
                ? (c.count ? ' · ' : '') +
                  (c.changePct > 0 ? '▲ ' : c.changePct < 0 ? '▼ ' : '') +
                  k.percent(Math.abs(c.changePct)) +
                  ' vs last'
                : '',
            ]),
          })),
          currency: d.currency,
          title: 'Spending by category',
        }),
      ),
    );
  },
});

type Merchants = {
  currency: string;
  period: string;
  merchants: Array<{ name: string; amountMinor: Minor; visits: number; categoryName?: string }>;
};
const mAmounts = series(12, 300_000, 0.9, 81);

export const byMerchant = defineWidget<Merchants>({
  domain: 'spending',
  name: 'byMerchant',
  title: 'Top merchants',
  description: 'Merchants ranked by spend with visit counts and average ticket.',
  examples: [
    {
      currency: CUR,
      period: 'Last 90 days',
      merchants: MERCHANTS.map((name, i) => ({
        name,
        amountMinor: mAmounts[i]!,
        visits: 1 + ((i * 5) % 14),
        categoryName: CATEGORIES[i % 8]!.name,
      })),
    },
  ],
  empty: { currency: CUR, period: 'Last 90 days', merchants: [] },
  render: (d, k) => {
    const list = k.arr(d.merchants);
    if (!list.length)
      return k.page(
        k.header('Merchants', d.period),
        k.empty(
          'No merchants yet',
          'Add a merchant to expenses to see where you shop most.',
          'tag',
        ),
      );
    return k.page(
      k.header('Top merchants', d.period),
      k.card(
        k.barList({
          items: list.map((m) => ({
            label: m.name,
            value: k.num(m.amountMinor),
            lead: k.glyph(m.name),
            sub:
              k.plural(m.visits, 'visit') +
              ' · avg ' +
              k.money(k.num(m.amountMinor) / Math.max(1, m.visits), d.currency),
          })),
          currency: d.currency,
          title: 'Spending by merchant',
        }),
      ),
    );
  },
});

type Weekday = {
  currency: string;
  period: string;
  days: Array<{ label: string; amountMinor: Minor; count?: number }>;
};

export const dayOfWeek = defineWidget<Weekday>({
  domain: 'spending',
  name: 'dayOfWeek',
  title: 'Spending by weekday',
  description:
    'Average spend for each day of the week as columns, highlighting your most expensive day.',
  examples: [
    {
      currency: CUR,
      period: 'Last 12 weeks',
      days: WEEKDAYS.map((label, i) => ({
        label,
        amountMinor: [62_000, 48_000, 55_000, 71_000, 128_000, 186_000, 142_000][i]!,
        count: [9, 7, 8, 11, 16, 21, 17][i],
      })),
    },
  ],
  empty: { currency: CUR, period: 'Last 12 weeks', days: [] },
  render: (d, k) => {
    const days = k.arr(d.days);
    if (!days.length || !k.sum(days.map((x) => x.amountMinor)))
      return k.page(
        k.header('Weekdays', d.period),
        k.empty(
          'Not enough data',
          'A few weeks of spending will reveal your patterns.',
          'calendar',
        ),
      );
    const values = days.map((x) => k.num(x.amountMinor));
    const top = values.indexOf(Math.max(...values));
    return k.page(
      k.header('Spending by weekday', d.period),
      k.card(
        k.columns({
          labels: days.map((x) => x.label),
          series: [{ name: 'Average spend', values, tone: 0 }],
          currency: d.currency,
          highlight: top,
          title: 'Average spend by weekday',
        }),
      ),
      k.note(
        days[top]!.label +
          ' is your priciest day at ' +
          k.money(values[top], d.currency) +
          ' on average.',
      ),
    );
  },
});

type Hours = { currency: string; period: string; matrix: number[][] };
const hourRng = rng(91);
const HOURS = WEEKDAYS.map((_, day) =>
  Array.from({ length: 24 }, (_, h) => {
    const meal = h === 13 || h === 20 || h === 21 ? 3 : h >= 9 && h <= 22 ? 1 : 0.05;
    const weekend = day >= 5 ? 1.6 : 1;
    return Math.round(hourRng() * 30_000 * meal * weekend);
  }),
);

export const hourHeatmap = defineWidget<Hours>({
  domain: 'spending',
  name: 'hourHeatmap',
  title: 'When you spend',
  description: 'A weekday × hour heatmap of spending, showing your busiest times.',
  examples: [{ currency: CUR, period: 'Last 90 days', matrix: HOURS }],
  empty: { currency: CUR, period: 'Last 90 days', matrix: [] },
  render: (d, k) => {
    const m = k.arr(d.matrix);
    if (!m.length || !k.sum(m.map((r) => k.sum(r))))
      return k.page(
        k.header('Timing', d.period),
        k.empty('Not enough data', 'Spending with times attached will fill this heatmap.', 'clock'),
      );
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let best = { d: 0, h: 0, v: -1 };
    m.forEach((row, di) => row.forEach((v, h) => v > best.v && (best = { d: di, h, v })));
    const hours = Array.from({ length: 24 }, (_, h) =>
      h === 0 ? '12a' : h < 12 ? h + 'a' : h === 12 ? '12p' : h - 12 + 'p',
    );
    return k.page(
      k.header('When you spend', d.period),
      k.card(
        k.heatmap({
          rows: days,
          cols: hours,
          values: m,
          currency: d.currency,
          colStride: 3,
          title: 'Spending by weekday and hour',
        }),
      ),
      k.note('Peak: ' + days[best.d] + ' around ' + hours[best.h] + '.'),
    );
  },
});

type Months = {
  currency: string;
  months: Array<{ label: string; amountMinor: Minor; previousMinor?: Minor }>;
};
const cur12 = series(12, 4_000_000, 0.22, 101);
const prev12 = series(12, 3_700_000, 0.22, 102);

export const monthOverMonth = defineWidget<Months>({
  domain: 'spending',
  name: 'monthOverMonth',
  title: 'Month over month',
  description:
    'This year’s monthly spending next to last year’s as grouped columns, with the change.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(6).map((label, i) => ({
        label,
        amountMinor: cur12[i + 6]!,
        previousMinor: prev12[i + 6]!,
      })),
    },
  ],
  empty: { currency: CUR, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Spending', 'Month over month'),
        k.empty('No history yet', 'Monthly comparisons appear after your first month.', 'trend'),
      );
    const last = months[months.length - 1]!;
    const change = last.previousMinor
      ? (k.num(last.amountMinor) - k.num(last.previousMinor)) / k.num(last.previousMinor)
      : null;
    return k.page(
      k.header('Spending', 'Month over month', k.delta(change, 'down')),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [
            {
              name: 'Last year',
              values: months.map((m) => k.num(m.previousMinor)),
              tone: 'neutral',
            },
            { name: 'This year', values: months.map((m) => k.num(m.amountMinor)), tone: 0 },
          ],
          currency: d.currency,
          title: 'Monthly spending vs last year',
        }),
      ),
    );
  },
});

type Year = {
  currency: string;
  year: number;
  months: Array<{ label: string; spentMinor: Minor; incomeMinor: Minor }>;
  topCategory?: string;
  topMerchant?: string;
  transactions?: number;
  noSpendDays?: number;
};

export const yearInReview = defineWidget<Year>({
  domain: 'spending',
  name: 'yearInReview',
  title: 'Year in review',
  description: 'Your year: total spent and earned, monthly columns, savings rate and highlights.',
  examples: [
    {
      currency: CUR,
      year: 2026,
      months: monthLabels(11).map((label, i) => ({
        label,
        spentMinor: cur12[i]!,
        incomeMinor: 9_500_000 + (i === 3 ? 4_000_000 : 0),
      })),
      topCategory: 'Food & dining',
      topMerchant: 'Swiggy',
      transactions: 1184,
      noSpendDays: 41,
    },
  ],
  empty: { currency: CUR, year: 2026, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Year in review', String(d.year)),
        k.empty('Your year starts here', 'Come back after a month of activity.', 'star'),
      );
    const spent = k.sum(months.map((m) => m.spentMinor));
    const income = k.sum(months.map((m) => m.incomeMinor));
    return k.page(
      k.header('Year in review', String(d.year)),
      k.hero({
        label: 'Saved this year',
        value: k.money(income - spent, d.currency),
        tone: k.toneOf(income - spent),
        sub: k.percent(income ? (income - spent) / income : 0) + ' savings rate',
        aside: k.ring({
          value: income ? Math.max(0, (income - spent) / income) : 0,
          size: 72,
          tone: 'accent',
        }),
      }),
      k.stats([
        { label: 'Earned', value: k.money(income, d.currency, { compact: true }), tone: 'income' },
        { label: 'Spent', value: k.money(spent, d.currency, { compact: true }), tone: 'expense' },
        d.transactions ? { label: 'Transactions', value: k.number(d.transactions) } : null,
        d.noSpendDays ? { label: 'No-spend days', value: String(d.noSpendDays) } : null,
      ]),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [{ name: 'Spent', values: months.map((m) => k.num(m.spentMinor)), tone: 0 }],
          currency: d.currency,
          height: 170,
          title: 'Spending by month',
        }),
      ),
      d.topCategory || d.topMerchant
        ? k.card(
            k.kv([
              d.topCategory ? ['Top category', k.esc(d.topCategory)] : null,
              d.topMerchant ? ['Favourite merchant', k.esc(d.topMerchant)] : null,
            ]),
          )
        : '',
    );
  },
});

type Trend = {
  currency: string;
  labels: string[];
  valuesMinor: number[];
  averageMinor?: Minor;
  granularity?: string;
};

export const trend = defineWidget<Trend>({
  domain: 'spending',
  name: 'trend',
  title: 'Spending trend',
  description: 'Spending over time as an area line with the average marked.',
  examples: [
    { currency: CUR, labels: monthLabels(12), valuesMinor: cur12, granularity: 'Monthly' },
  ],
  empty: { currency: CUR, labels: [], valuesMinor: [] },
  render: (d, k) => {
    const v = k.arr(d.valuesMinor);
    if (v.length < 2)
      return k.page(
        k.header('Spending', 'Trend'),
        k.empty('Not enough history', 'Two periods of spending will draw a trend.', 'trend'),
      );
    const average = d.averageMinor !== undefined ? k.num(d.averageMinor) : k.avg(v);
    return k.page(
      k.header('Spending', 'Trend', d.granularity ? k.pill(d.granularity) : ''),
      k.stats([
        {
          label: 'Latest',
          value: k.money(v[v.length - 1], d.currency),
          delta: v[v.length - 2] ? (v[v.length - 1]! - v[v.length - 2]!) / v[v.length - 2]! : null,
          goodWhen: 'down',
        },
        { label: 'Average', value: k.money(average, d.currency) },
        { label: 'Peak', value: k.money(Math.max(...v), d.currency) },
      ]),
      k.card(
        k.lineChart({
          labels: d.labels,
          series: [{ name: 'Spent', values: v, tone: 0 }],
          currency: d.currency,
          area: true,
          ref: { value: average, label: 'Average' },
          title: 'Spending over time',
        }),
      ),
    );
  },
});

type Forecast = {
  currency: string;
  days: string[];
  actualMinor: Array<number | null>;
  projectedMinor: Array<number | null>;
  lastMonthMinor?: number[];
  projectedTotalMinor: Minor;
  limitMinor?: Minor;
};
const cumulative = (values: number[]) =>
  values.reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] || 0) + v], []);
const dailySpend = series(30, 140_000, 0.8, 111);
const cum = cumulative(dailySpend);
const lastCum = cumulative(series(30, 128_000, 0.8, 112));

export const forecast = defineWidget<Forecast>({
  domain: 'spending',
  name: 'forecast',
  title: 'Month-end forecast',
  description:
    'Cumulative spend so far, a dashed projection to month end, and last month for reference.',
  examples: [
    {
      currency: CUR,
      days: Array.from({ length: 30 }, (_, i) => String(i + 1)),
      actualMinor: cum.map((v, i) => (i < 26 ? v : null)),
      projectedMinor: cum.map((v, i) => (i >= 25 ? Math.round((cum[25]! / 26) * (i + 1)) : null)),
      lastMonthMinor: lastCum,
      projectedTotalMinor: Math.round((cum[25]! / 26) * 30),
      limitMinor: 4_500_000,
    },
  ],
  empty: { currency: CUR, days: [], actualMinor: [], projectedMinor: [], projectedTotalMinor: 0 },
  render: (d, k) => {
    if (!k.arr(d.days).length)
      return k.page(
        k.header('Forecast', 'This month'),
        k.empty(
          'No spending yet this month',
          'A forecast appears after a few days of activity.',
          'trend',
        ),
      );
    const over = d.limitMinor !== undefined && k.num(d.projectedTotalMinor) > k.num(d.limitMinor);
    return k.page(
      k.header(
        'Forecast',
        'This month',
        over ? k.pill('Over limit pace', 'expense') : k.pill('On track', 'income'),
      ),
      k.hero({
        label: 'Projected month-end spend',
        value: k.money(d.projectedTotalMinor, d.currency),
        tone: over ? 'expense' : null,
        sub: d.limitMinor !== undefined ? 'Limit ' + k.money(d.limitMinor, d.currency) : undefined,
      }),
      k.card(
        k.lineChart({
          labels: d.days,
          series: [
            { name: 'This month', values: d.actualMinor, tone: 0 },
            { name: 'Projection', values: d.projectedMinor, tone: 0, dashed: true },
            ...(d.lastMonthMinor
              ? [{ name: 'Last month', values: d.lastMonthMinor, tone: 'neutral' as const }]
              : []),
          ],
          currency: d.currency,
          area: false,
          ref:
            d.limitMinor !== undefined ? { value: k.num(d.limitMinor), label: 'Limit' } : undefined,
          title: 'Cumulative spending this month',
        }),
      ),
    );
  },
});

type Daily = {
  currency: string;
  averageMinor: Minor;
  previousAverageMinor?: Minor;
  last30: number[];
  noSpendDays?: number;
};

export const dailyAverage = defineWidget<Daily>({
  domain: 'spending',
  name: 'dailyAverage',
  title: 'Daily average',
  description: 'Your average daily spend with a 30-day bar sparkline, change and no-spend days.',
  examples: [
    {
      currency: CUR,
      averageMinor: 140_600,
      previousAverageMinor: 128_200,
      last30: dailySpend,
      noSpendDays: 4,
    },
  ],
  empty: { currency: CUR, averageMinor: 0, last30: [] },
  render: (d, k) => {
    if (!k.arr(d.last30).length)
      return k.page(
        k.header('Spending', 'Daily average'),
        k.empty('No spending yet', undefined, 'calendar'),
      );
    const change = d.previousAverageMinor
      ? (k.num(d.averageMinor) - k.num(d.previousAverageMinor)) / k.num(d.previousAverageMinor)
      : null;
    return k.page(
      k.header('Spending', 'Daily average', k.delta(change, 'down')),
      k.hero({
        label: 'Per day, last 30 days',
        value: k.money(d.averageMinor, d.currency),
        sub: d.noSpendDays ? d.noSpendDays + ' no-spend days' : undefined,
        chart: k.sparkline(d.last30, { bars: true, height: 56, tone: 0 }),
      }),
    );
  },
});

type Stacked = {
  currency: string;
  months: string[];
  categories: Array<{ name: string; valuesMinor: number[] }>;
};

export const stackedCategories = defineWidget<Stacked>({
  domain: 'spending',
  name: 'stackedCategories',
  title: 'Category mix by month',
  description: 'Monthly spending stacked by category, showing how the mix shifts over time.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(6),
      categories: CATS.slice(0, 5).map((c, i) => ({
        name: c.name,
        valuesMinor: series(6, k0(c.amountMinor), 0.3, 120 + i),
      })),
    },
  ],
  empty: { currency: CUR, months: [], categories: [] },
  render: (d, k) => {
    const cats = k.arr(d.categories);
    if (!cats.length || !k.arr(d.months).length)
      return k.page(
        k.header('Spending', 'Category mix'),
        k.empty('No history yet', undefined, 'spark'),
      );
    const shown =
      cats.length > 8
        ? cats
            .slice(0, 7)
            .concat([
              {
                name: 'Other',
                valuesMinor: d.months.map((_, i) =>
                  k.sum(cats.slice(7).map((c) => c.valuesMinor[i] || 0)),
                ),
              },
            ])
        : cats;
    return k.page(
      k.header('Spending', 'Category mix by month'),
      k.card(
        k.columns({
          labels: d.months,
          series: shown.map((c, i) => ({
            name: c.name,
            values: c.valuesMinor,
            tone: c.name === 'Other' && i === 7 ? ('neutral' as const) : i,
          })),
          mode: 'stacked',
          currency: d.currency,
          height: 210,
          title: 'Spending by category and month',
        }),
      ),
    );
  },
});

function k0(value: Minor): number {
  return Number(value);
}

type Weekly = {
  currency: string;
  weeks: Array<{ label: string; amountMinor: Minor }>;
  targetMinor?: Minor;
};

export const weekly = defineWidget<Weekly>({
  domain: 'spending',
  name: 'weekly',
  title: 'Weekly spending',
  description: 'Spending per week for the last few months against your weekly target.',
  examples: [
    {
      currency: CUR,
      weeks: Array.from({ length: 12 }, (_, i) => ({
        label: 'W' + (37 + i),
        amountMinor: series(12, 950_000, 0.35, 131)[i]!,
      })),
      targetMinor: 1_000_000,
    },
  ],
  empty: { currency: CUR, weeks: [] },
  render: (d, k) => {
    const weeks = k.arr(d.weeks);
    if (!weeks.length)
      return k.page(k.header('Spending', 'Weekly'), k.empty('No weeks yet', undefined, 'calendar'));
    const over =
      d.targetMinor !== undefined
        ? weeks.filter((w) => k.num(w.amountMinor) > k.num(d.targetMinor)).length
        : 0;
    return k.page(
      k.header(
        'Spending',
        'Weekly',
        d.targetMinor !== undefined
          ? k.pill(over + ' of ' + weeks.length + ' weeks over', over ? 'warn' : 'income')
          : '',
      ),
      k.card(
        k.columns({
          labels: weeks.map((w) => w.label),
          series: [{ name: 'Spent', values: weeks.map((w) => k.num(w.amountMinor)), tone: 0 }],
          currency: d.currency,
          ref:
            d.targetMinor !== undefined
              ? { value: k.num(d.targetMinor), label: 'Target' }
              : undefined,
          title: 'Weekly spending',
        }),
      ),
    );
  },
});

type MerchantTrend = {
  currency: string;
  months: string[];
  merchants: Array<{ name: string; valuesMinor: number[] }>;
};

export const merchantTrend = defineWidget<MerchantTrend>({
  domain: 'spending',
  name: 'merchantTrend',
  title: 'Merchant trends',
  description: 'Monthly spend at your top merchants as lines, to spot habits growing or fading.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(6),
      merchants: ['Swiggy', 'Amazon', 'Uber', 'BigBasket'].map((name, i) => ({
        name,
        valuesMinor: series(6, [420_000, 600_000, 210_000, 380_000][i]!, 0.35, 140 + i),
      })),
    },
  ],
  empty: { currency: CUR, months: [], merchants: [] },
  render: (d, k) => {
    const list = k.arr(d.merchants).slice(0, 8);
    if (!list.length)
      return k.page(
        k.header('Merchants', 'Trends'),
        k.empty('No merchant history', undefined, 'trend'),
      );
    return k.page(
      k.header('Merchants', 'Monthly trends'),
      k.card(
        k.lineChart({
          labels: d.months,
          series: list.map((m) => ({ name: m.name, values: m.valuesMinor })),
          currency: d.currency,
          area: false,
          markers: true,
          title: 'Monthly spend by merchant',
        }),
      ),
    );
  },
});

type Anomalies = {
  currency: string;
  items: Array<{
    title: string;
    amountMinor: Minor;
    typicalMinor: Minor;
    occurredAt: number;
    reason: string;
  }>;
};

export const anomalies = defineWidget<Anomalies>({
  domain: 'spending',
  name: 'anomalies',
  title: 'Unusual spending',
  description:
    'Purchases well above what is typical for the merchant or category, with how far above.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          title: 'Amazon',
          amountMinor: 2_499_900,
          typicalMinor: 180_000,
          occurredAt: Date.UTC(2026, 10, 21),
          reason: '14× your usual Amazon order',
        },
        {
          title: 'Airtel postpaid',
          amountMinor: 189_900,
          typicalMinor: 99_900,
          occurredAt: Date.UTC(2026, 10, 8),
          reason: 'Bill nearly doubled',
        },
        {
          title: 'Uber',
          amountMinor: 142_000,
          typicalMinor: 28_000,
          occurredAt: Date.UTC(2026, 10, 16),
          reason: 'Airport ride, 5× a typical trip',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Insights', 'Unusual spending'),
        k.empty('Nothing unusual', 'Your spending looks like your normal pattern.', 'check'),
      );
    return k.page(
      k.header('Insights', 'Unusual spending', k.pill(String(items.length), 'warn')),
      k.list(
        items.map((a) =>
          k.row({
            lead: k.tile(k.icon('alert', 16), 'warn'),
            title: a.title,
            sub: a.reason + ' · ' + k.date(a.occurredAt, 'day'),
            value: k.money(a.amountMinor, d.currency),
            valueSub: 'usually ' + k.money(a.typicalMinor, d.currency),
            valueTone: 'expense',
          }),
        ),
      ),
    );
  },
});

type Pace = {
  currency: string;
  days: string[];
  thisMonthMinor: Array<number | null>;
  lastMonthMinor: number[];
  dayOfMonth: number;
};

export const pace = defineWidget<Pace>({
  domain: 'spending',
  name: 'pace',
  title: 'Spending pace',
  description:
    'Cumulative spend this month against last month at the same point, so you know if you are ahead or behind.',
  examples: [
    {
      currency: CUR,
      days: Array.from({ length: 30 }, (_, i) => String(i + 1)),
      thisMonthMinor: cum.map((v, i) => (i < 26 ? v : null)),
      lastMonthMinor: lastCum,
      dayOfMonth: 26,
    },
  ],
  empty: { currency: CUR, days: [], thisMonthMinor: [], lastMonthMinor: [], dayOfMonth: 1 },
  render: (d, k) => {
    if (!k.arr(d.days).length)
      return k.page(k.header('Spending', 'Pace'), k.empty('No spending yet', undefined, 'trend'));
    const now = k.num(d.thisMonthMinor[d.dayOfMonth - 1]);
    const then = k.num(d.lastMonthMinor[d.dayOfMonth - 1]);
    const diff = now - then;
    return k.page(
      k.header('Spending', 'Pace vs last month'),
      k.hero({
        label: 'By day ' + d.dayOfMonth,
        value: k.money(Math.abs(diff), d.currency) + (diff > 0 ? ' ahead' : ' behind'),
        tone: diff > 0 ? 'expense' : 'income',
        sub: k.money(now, d.currency) + ' now vs ' + k.money(then, d.currency) + ' last month',
      }),
      k.card(
        k.lineChart({
          labels: d.days,
          series: [
            { name: 'This month', values: d.thisMonthMinor, tone: 0 },
            { name: 'Last month', values: d.lastMonthMinor, tone: 'neutral' },
          ],
          currency: d.currency,
          area: false,
          title: 'Cumulative spending',
        }),
      ),
    );
  },
});

type Needs = {
  currency: string;
  period: string;
  needsMinor: Minor;
  wantsMinor: Minor;
  savingsMinor: Minor;
  incomeMinor: Minor;
};

export const needsWants = defineWidget<Needs>({
  domain: 'spending',
  name: 'needsWants',
  title: 'Needs, wants, savings',
  description: 'Your income split into needs, wants and savings against the 50/30/20 guideline.',
  examples: [
    {
      currency: CUR,
      period: 'November',
      needsMinor: 2_480_000,
      wantsMinor: 1_738_050,
      savingsMinor: 5_281_950,
      incomeMinor: 9_500_000,
    },
  ],
  empty: {
    currency: CUR,
    period: 'This month',
    needsMinor: 0,
    wantsMinor: 0,
    savingsMinor: 0,
    incomeMinor: 0,
  },
  render: (d, k) => {
    const income = k.num(d.incomeMinor);
    if (!income)
      return k.page(
        k.header('Budget split', d.period),
        k.empty('No income recorded', 'Add income to compare your split with 50/30/20.', 'spark'),
      );
    const parts = [
      { label: 'Needs', value: k.num(d.needsMinor), goal: 0.5 },
      { label: 'Wants', value: k.num(d.wantsMinor), goal: 0.3 },
      { label: 'Savings', value: k.num(d.savingsMinor), goal: 0.2 },
    ];
    return k.page(
      k.header('Budget split', d.period, k.pill('50 / 30 / 20')),
      k.card(
        k.segments({
          items: parts.map((p, i) => ({ label: p.label, value: p.value, tone: i })),
          currency: d.currency,
          title: 'Needs, wants and savings',
        }),
      ),
      k.table(
        [
          { label: 'Bucket' },
          { label: 'Amount', align: 'right' },
          { label: 'Share', align: 'right' },
          { label: 'Guide', align: 'right' },
        ],
        parts.map((p) => [
          k.esc(p.label),
          k.esc(k.money(p.value, d.currency)),
          k.text(
            k.percent(p.value / income),
            p.label === 'Savings'
              ? p.value / income >= p.goal
                ? 'income'
                : 'warn'
              : p.value / income > p.goal
                ? 'warn'
                : null,
          ),
          k.esc(k.percent(p.goal)),
        ]),
        'Needs, wants and savings',
      ),
    );
  },
});

type ByAccount = {
  currency: string;
  period: string;
  accounts: Array<{ name: string; type: string; spentMinor: Minor }>;
};

export const byAccount = defineWidget<ByAccount>({
  domain: 'spending',
  name: 'byAccount',
  title: 'Spending by account',
  description: 'Which accounts and cards you spend from, as a donut with shares.',
  examples: [
    {
      currency: CUR,
      period: 'November',
      accounts: [
        { name: 'HDFC Regalia', type: 'card', spentMinor: 2_120_000 },
        { name: 'HDFC Savings (UPI)', type: 'bank', spentMinor: 1_480_000 },
        { name: 'Cash', type: 'cash', spentMinor: 312_000 },
        { name: 'Paytm wallet', type: 'wallet', spentMinor: 306_050 },
      ],
    },
  ],
  empty: { currency: CUR, period: 'This month', accounts: [] },
  render: (d, k) => {
    const list = k.arr(d.accounts).filter((a) => k.num(a.spentMinor) > 0);
    if (!list.length)
      return k.page(
        k.header('Spending', 'By account'),
        k.empty('No spending yet', undefined, 'card'),
      );
    return k.page(
      k.header('Spending by account', d.period),
      k.card(
        k.donut({
          items: list.map((a) => ({ label: a.name, value: k.num(a.spentMinor) })),
          currency: d.currency,
          centerLabel: 'Spent',
          title: 'Spending by account',
        }),
      ),
    );
  },
});

type Year365 = { currency: string; year: number; weeks: number[][] };
const yRng = rng(151);
const YEAR = Array.from({ length: 7 }, () =>
  Array.from({ length: 48 }, () => (yRng() < 0.2 ? 0 : Math.round(yRng() * yRng() * 600_000))),
);

export const yearHeatmap = defineWidget<Year365>({
  domain: 'spending',
  name: 'yearHeatmap',
  title: 'Spending year at a glance',
  description:
    'A contribution-style heatmap of daily spending for the year (weekday rows, week columns).',
  examples: [{ currency: CUR, year: 2026, weeks: YEAR }],
  empty: { currency: CUR, year: 2026, weeks: [] },
  render: (d, k) => {
    const rows = k.arr(d.weeks);
    if (!rows.length || !k.sum(rows.map((r) => k.sum(r))))
      return k.page(
        k.header('Year', String(d.year)),
        k.empty('No spending yet this year', undefined, 'calendar'),
      );
    const cols = (rows[0] || []).map((_, i) =>
      i % 4 === 0
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
            Math.floor(i / 4)
          ] || ''
        : '',
    );
    const zero = rows.reduce((n, r) => n + r.filter((v) => !v).length, 0);
    return k.page(
      k.header('Spending', String(d.year) + ' at a glance', k.pill(zero + ' no-spend days')),
      k.card(
        k.heatmap({
          rows: ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'],
          cols: cols.map((c, i) => c || 'Week ' + (i + 1)),
          values: rows,
          currency: d.currency,
          colStride: 4,
          title: 'Daily spending this year',
        }),
      ),
    );
  },
});

type CatDetail = {
  currency: string;
  category: { name: string; icon?: string };
  monthly: Array<{ label: string; amountMinor: Minor }>;
  merchants: Array<{ name: string; amountMinor: Minor }>;
  limitMinor?: Minor;
};

export const categoryDetail = defineWidget<CatDetail>({
  domain: 'spending',
  name: 'categoryDetail',
  title: 'Category deep dive',
  description: 'One category: 6-month trend against its limit and the merchants that make it up.',
  examples: [
    {
      currency: CUR,
      category: { name: 'Food & dining', icon: '🍜' },
      monthly: monthLabels(6).map((label, i) => ({
        label,
        amountMinor: series(6, 1_050_000, 0.25, 161)[i]!,
      })),
      merchants: [
        { name: 'Swiggy', amountMinor: 420_000 },
        { name: 'Zomato', amountMinor: 260_000 },
        { name: 'Blue Tokai', amountMinor: 96_000 },
        { name: 'Toit', amountMinor: 69_000 },
      ],
      limitMinor: 1_200_000,
    },
  ],
  empty: { currency: CUR, category: { name: 'Category' }, monthly: [], merchants: [] },
  render: (d, k) => {
    const monthly = k.arr(d.monthly);
    if (!monthly.length)
      return k.page(
        k.header('Category', d.category.name),
        k.empty('No spending in this category', undefined, 'tag'),
      );
    return k.page(
      k.header('Category', (d.category.icon ? d.category.icon + ' ' : '') + d.category.name),
      k.card(
        k.columns({
          labels: monthly.map((m) => m.label),
          series: [{ name: 'Spent', values: monthly.map((m) => k.num(m.amountMinor)), tone: 0 }],
          currency: d.currency,
          ref:
            d.limitMinor !== undefined ? { value: k.num(d.limitMinor), label: 'Limit' } : undefined,
          title: 'Monthly spending',
        }),
      ),
      k.arr(d.merchants).length
        ? k.section(
            'Merchants',
            k.card(
              k.barList({
                items: d.merchants.map((m) => ({ label: m.name, value: k.num(m.amountMinor) })),
                currency: d.currency,
                showShare: true,
                title: 'Merchants in category',
              }),
            ),
          )
        : '',
    );
  },
});

type MerchantDetail = {
  currency: string;
  merchant: string;
  visits: number;
  totalMinor: Minor;
  averageMinor: Minor;
  firstAt?: number;
  lastAt?: number;
  monthly: Array<{ label: string; amountMinor: Minor; visits: number }>;
};

export const merchantDetail = defineWidget<MerchantDetail>({
  domain: 'spending',
  name: 'merchantDetail',
  title: 'Merchant deep dive',
  description: 'One merchant: lifetime spend, visits, average ticket and monthly history.',
  examples: [
    {
      currency: CUR,
      merchant: 'Swiggy',
      visits: 86,
      totalMinor: 3_420_000,
      averageMinor: 39_800,
      firstAt: Date.UTC(2025, 1, 3),
      lastAt: Date.UTC(2026, 10, 25),
      monthly: monthLabels(8).map((label, i) => ({
        label,
        amountMinor: series(8, 420_000, 0.3, 171)[i]!,
        visits: 8 + (i % 4),
      })),
    },
  ],
  empty: {
    currency: CUR,
    merchant: 'Merchant',
    visits: 0,
    totalMinor: 0,
    averageMinor: 0,
    monthly: [],
  },
  render: (d, k) => {
    if (!d.visits)
      return k.page(
        k.header('Merchant', d.merchant),
        k.empty('No purchases here yet', undefined, 'tag'),
      );
    const monthly = k.arr(d.monthly);
    return k.page(
      k.header('Merchant', d.merchant, k.glyph(d.merchant)),
      k.stats([
        { label: 'Total', value: k.money(d.totalMinor, d.currency) },
        { label: 'Visits', value: String(d.visits) },
        { label: 'Average', value: k.money(d.averageMinor, d.currency) },
      ]),
      monthly.length > 1
        ? k.card(
            k.lineChart({
              labels: monthly.map((m) => m.label),
              series: [
                { name: 'Spent', values: monthly.map((m) => k.num(m.amountMinor)), tone: 0 },
              ],
              currency: d.currency,
              markers: true,
              title: 'Monthly spend',
            }),
          )
        : '',
      d.firstAt
        ? k.note(
            'Customer since ' +
              k.date(d.firstAt, 'month') +
              (d.lastAt ? ' · last visit ' + k.date(d.lastAt, 'day') : ''),
          )
        : '',
    );
  },
});

type Weekend = {
  currency: string;
  weekdayAvgMinor: Minor;
  weekendAvgMinor: Minor;
  weeks: Array<{ label: string; weekdayMinor: Minor; weekendMinor: Minor }>;
};

export const weekendWeekday = defineWidget<Weekend>({
  domain: 'spending',
  name: 'weekendVsWeekday',
  title: 'Weekend vs weekday',
  description: 'Average daily spend on weekends versus weekdays, week by week.',
  examples: [
    {
      currency: CUR,
      weekdayAvgMinor: 61_000,
      weekendAvgMinor: 164_000,
      weeks: Array.from({ length: 8 }, (_, i) => ({
        label: 'W' + (41 + i),
        weekdayMinor: series(8, 300_000, 0.3, 181)[i]!,
        weekendMinor: series(8, 330_000, 0.4, 182)[i]!,
      })),
    },
  ],
  empty: { currency: CUR, weekdayAvgMinor: 0, weekendAvgMinor: 0, weeks: [] },
  render: (d, k) => {
    const weeks = k.arr(d.weeks);
    if (!weeks.length)
      return k.page(
        k.header('Spending', 'Weekend vs weekday'),
        k.empty('Not enough data', undefined, 'calendar'),
      );
    const ratio = k.num(d.weekdayAvgMinor)
      ? k.num(d.weekendAvgMinor) / k.num(d.weekdayAvgMinor)
      : 0;
    return k.page(
      k.header('Spending', 'Weekend vs weekday'),
      k.stats([
        { label: 'Weekday / day', value: k.money(d.weekdayAvgMinor, d.currency) },
        {
          label: 'Weekend / day',
          value: k.money(d.weekendAvgMinor, d.currency),
          sub: ratio ? ratio.toFixed(1) + '× weekdays' : '',
        },
      ]),
      k.card(
        k.columns({
          labels: weeks.map((w) => w.label),
          series: [
            { name: 'Weekdays (5 days)', values: weeks.map((w) => k.num(w.weekdayMinor)) },
            { name: 'Weekend (2 days)', values: weeks.map((w) => k.num(w.weekendMinor)) },
          ],
          mode: 'stacked',
          currency: d.currency,
          title: 'Weekly spending split',
        }),
      ),
    );
  },
});

type Small = {
  currency: string;
  thresholdMinor: Minor;
  count: number;
  totalMinor: Minor;
  yearlyMinor: Minor;
  top: Array<{ name: string; count: number; amountMinor: Minor }>;
};

export const smallPurchases = defineWidget<Small>({
  domain: 'spending',
  name: 'smallPurchases',
  title: 'Small purchases add up',
  description:
    'Purchases under a threshold: how many, what they total, and what that is over a year.',
  examples: [
    {
      currency: CUR,
      thresholdMinor: 30_000,
      count: 47,
      totalMinor: 812_000,
      yearlyMinor: 9_744_000,
      top: [
        { name: 'Blue Tokai', count: 14, amountMinor: 364_000 },
        { name: 'Chai Point', count: 18, amountMinor: 162_000 },
        { name: 'Metro card top-up', count: 6, amountMinor: 120_000 },
        { name: 'Vending', count: 9, amountMinor: 81_000 },
      ],
    },
  ],
  empty: {
    currency: CUR,
    thresholdMinor: 30_000,
    count: 0,
    totalMinor: 0,
    yearlyMinor: 0,
    top: [],
  },
  render: (d, k) => {
    if (!d.count)
      return k.page(
        k.header('Spending', 'Small purchases'),
        k.empty(
          'No small purchases',
          'Nothing under ' + k.money(d.thresholdMinor, d.currency) + ' this month.',
          'check',
        ),
      );
    return k.page(
      k.header(
        'Spending',
        'Small purchases add up',
        k.pill('Under ' + k.money(d.thresholdMinor, d.currency, { compact: true })),
      ),
      k.hero({
        label: k.plural(d.count, 'purchase') + ' this month',
        value: k.money(d.totalMinor, d.currency),
        sub: '≈ ' + k.money(d.yearlyMinor, d.currency) + ' a year at this rate',
      }),
      k.card(
        k.barList({
          items: k
            .arr(d.top)
            .map((t) => ({ label: t.name, value: k.num(t.amountMinor), sub: t.count + '×' })),
          currency: d.currency,
          title: 'Small purchases by merchant',
        }),
      ),
    );
  },
});

type Shared = {
  currency: string;
  personalMinor: Minor;
  sharedMinor: Minor;
  groups: Array<{ name: string; myShareMinor: Minor }>;
};

export const sharedVsPersonal = defineWidget<Shared>({
  domain: 'spending',
  name: 'sharedVsPersonal',
  title: 'Shared vs personal spending',
  description: 'How much of your spending is your share of group expenses versus purely personal.',
  examples: [
    {
      currency: CUR,
      personalMinor: 3_218_050,
      sharedMinor: 1_000_000,
      groups: [
        { name: 'Goa trip', myShareMinor: 620_000 },
        { name: 'Flat 4B', myShareMinor: 310_000 },
        { name: 'Office lunch', myShareMinor: 70_000 },
      ],
    },
  ],
  empty: { currency: CUR, personalMinor: 0, sharedMinor: 0, groups: [] },
  render: (d, k) => {
    if (!k.num(d.personalMinor) && !k.num(d.sharedMinor))
      return k.page(
        k.header('Spending', 'Shared vs personal'),
        k.empty('No spending yet', undefined, 'users'),
      );
    return k.page(
      k.header('Spending', 'Shared vs personal'),
      k.card(
        k.segments({
          items: [
            { label: 'Personal', value: k.num(d.personalMinor), tone: 0 },
            { label: 'Shared (your share)', value: k.num(d.sharedMinor), tone: 1 },
          ],
          currency: d.currency,
          title: 'Shared vs personal',
        }),
      ),
      k.arr(d.groups).length
        ? k.section(
            'Your share by group',
            k.list(
              d.groups.map((g) =>
                k.row({
                  lead: k.tile(k.icon('users', 16), 1),
                  title: g.name,
                  value: k.money(g.myShareMinor, d.currency),
                }),
              ),
            ),
          )
        : '',
    );
  },
});

type Daily30 = { currency: string; days: Array<{ label: string; amountMinor: Minor }> };

export const dailyColumns = defineWidget<Daily30>({
  domain: 'spending',
  name: 'daily',
  title: 'Daily spending',
  description: 'Spending per day for the last 30 days as columns, with the average line.',
  examples: [
    {
      currency: CUR,
      days: dayLabels(30).map((label, i) => ({ label, amountMinor: dailySpend[i]! })),
    },
  ],
  empty: { currency: CUR, days: [] },
  render: (d, k) => {
    const days = k.arr(d.days);
    if (!days.length)
      return k.page(
        k.header('Spending', 'Daily'),
        k.empty('No spending yet', undefined, 'calendar'),
      );
    const values = days.map((x) => k.num(x.amountMinor));
    return k.page(
      k.header(
        'Spending',
        'Last ' + days.length + ' days',
        k.pill(k.money(k.sum(values), d.currency)),
      ),
      k.card(
        k.columns({
          labels: days.map((x) => x.label),
          series: [{ name: 'Spent', values, tone: 0 }],
          currency: d.currency,
          ref: { value: k.avg(values), label: 'Average' },
          title: 'Daily spending',
        }),
      ),
    );
  },
});

export const spendingWidgets = [
  byCategory,
  categoryRanking,
  byMerchant,
  dayOfWeek,
  hourHeatmap,
  monthOverMonth,
  yearInReview,
  trend,
  forecast,
  dailyAverage,
  stackedCategories,
  weekly,
  merchantTrend,
  anomalies,
  pace,
  needsWants,
  byAccount,
  yearHeatmap,
  categoryDetail,
  merchantDetail,
  weekendWeekday,
  smallPurchases,
  sharedVsPersonal,
  dailyColumns,
];
