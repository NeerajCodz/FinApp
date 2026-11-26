import { CATEGORIES, CUR, monthLabels, series } from '../sample';
import { defineWidget, type Minor } from '../types';

/** Shape of `finapp.finance.categories.list` items (categories.queries.overview). */
type Category = {
  _id?: string;
  id?: string;
  name: string;
  icon?: string;
  color?: string;
  monthlyLimitMinor?: Minor | null;
  limitCurrency?: string;
  monthSpentMinor?: Minor;
  monthReceivedMinor?: Minor;
  monthCurrency?: string | null;
  includeInBudgets?: boolean;
  archivedAt?: number;
};

const limits = [
  1_200_000,
  1_000_000,
  400_000,
  1_200_000,
  700_000,
  300_000,
  null,
  1_000_000,
  null,
  200_000,
];
const spent = [
  845_000, 910_000, 436_500, 1_420_000, 620_000, 380_000, 210_000, 140_000, 120_000, 95_000,
];
const ITEMS: Category[] = CATEGORIES.map((c, i) => ({
  id: 'c' + i,
  name: c.name,
  icon: c.icon,
  monthlyLimitMinor: limits[i],
  limitCurrency: CUR,
  monthSpentMinor: spent[i],
  monthCurrency: CUR,
  includeInBudgets: true,
}));

/** Linked to `finapp.finance.categories.list`. Budgets are modelled as category limits. */
export const limitsList = defineWidget<{ items?: Category[] }>({
  domain: 'categories',
  name: 'limits',
  title: 'Category limits',
  description:
    'This month’s spending in each category against its monthly limit, over-limit first, plus categories without a limit.',
  invoking: 'Checking your category limits…',
  examples: [{ items: ITEMS }],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items).filter((c) => !c.archivedAt);
    if (!items.length)
      return k.page(
        k.header('Categories', 'Limits'),
        k.empty(
          'No categories yet',
          'Create categories and set monthly limits to keep spending in check.',
          'tag',
        ),
      );
    const cur = (c: Category) => c.monthCurrency || c.limitCurrency || 'INR';
    const withLimit = items
      .filter((c) => k.num(c.monthlyLimitMinor) > 0)
      .sort(
        (a, b) =>
          k.num(b.monthSpentMinor) / k.num(b.monthlyLimitMinor) -
          k.num(a.monthSpentMinor) / k.num(a.monthlyLimitMinor),
      );
    const without = items.filter(
      (c) => !(k.num(c.monthlyLimitMinor) > 0) && k.num(c.monthSpentMinor) > 0,
    );
    const over = withLimit.filter(
      (c) => k.num(c.monthSpentMinor) > k.num(c.monthlyLimitMinor),
    ).length;
    const totalLimit = k.sum(withLimit.map((c) => c.monthlyLimitMinor));
    const totalSpent = k.sum(withLimit.map((c) => c.monthSpentMinor));
    const c0 = cur(items[0]!);
    return k.page(
      k.header(
        'Categories',
        'Limits this month',
        over ? k.pill(over + ' over', 'expense') : k.pill('All within limits', 'income'),
      ),
      withLimit.length
        ? k.stats([
            {
              label: 'Spent of limits',
              value: k.money(totalSpent, c0),
              sub: 'of ' + k.money(totalLimit, c0),
            },
            {
              label: 'Left',
              value: k.money(Math.max(0, totalLimit - totalSpent), c0),
              tone: totalSpent > totalLimit ? 'expense' : 'income',
            },
          ])
        : '',
      withLimit.length
        ? k.card(
            withLimit
              .map((c) => {
                const s = k.num(c.monthSpentMinor);
                const l = k.num(c.monthlyLimitMinor);
                return k.meter({
                  lead: k.glyph(c.name, c.icon),
                  label: c.name,
                  value: s,
                  max: l,
                  valueText: k.money(s, cur(c)),
                  maxText: k.money(l, cur(c)),
                  sub: s > l ? k.money(s - l, cur(c)) + ' over' : k.money(l - s, cur(c)) + ' left',
                });
              })
              .join(''),
          )
        : k.notice('No category has a monthly limit yet. Set one to start tracking.'),
      without.length
        ? k.section(
            'No limit set',
            k.list(
              without.map((c) =>
                k.row({
                  lead: k.glyph(c.name, c.icon, 'neutral'),
                  title: c.name,
                  value: k.money(c.monthSpentMinor, cur(c)),
                }),
              ),
            ),
          )
        : '',
    );
  },
});

type LimitDetail = {
  currency: string;
  category: { name: string; icon?: string };
  limitMinor: Minor;
  spentMinor: Minor;
  dayOfMonth: number;
  daysInMonth: number;
  daily: number[];
  transactions?: Array<{ title: string; amountMinor: Minor; occurredAt: number }>;
};
const foodDaily = series(26, 32_000, 0.9, 401);

export const limitDetail = defineWidget<LimitDetail>({
  domain: 'categories',
  name: 'limitDetail',
  title: 'Category limit',
  description:
    'One category limit: a progress ring, daily allowance left, cumulative pace against the limit.',
  examples: [
    {
      currency: CUR,
      category: { name: 'Food & dining', icon: '🍜' },
      limitMinor: 1_200_000,
      spentMinor: foodDaily.reduce((a, b) => a + b, 0),
      dayOfMonth: 26,
      daysInMonth: 30,
      daily: foodDaily,
      transactions: [
        { title: 'Swiggy', amountMinor: 48_000, occurredAt: Date.UTC(2026, 10, 25) },
        { title: 'Toit', amountMinor: 69_000, occurredAt: Date.UTC(2026, 10, 22) },
      ],
    },
  ],
  empty: {
    currency: CUR,
    category: { name: 'Category' },
    limitMinor: 0,
    spentMinor: 0,
    dayOfMonth: 1,
    daysInMonth: 30,
    daily: [],
  },
  render: (d, k) => {
    const limit = k.num(d.limitMinor);
    if (!limit)
      return k.page(
        k.header('Limit', d.category.name),
        k.empty(
          'No limit set',
          'Set a monthly limit for ' + d.category.name + ' to track it here.',
          'target',
        ),
      );
    const spentNow = k.num(d.spentMinor);
    const daysLeft = Math.max(1, d.daysInMonth - d.dayOfMonth + 1);
    const perDay = Math.max(0, limit - spentNow) / daysLeft;
    let run = 0;
    const cum = k.arr(d.daily).map((v) => (run += v));
    const labels = Array.from({ length: d.daysInMonth }, (_, i) => String(i + 1));
    const ideal = labels.map((_, i) => Math.round((limit * (i + 1)) / d.daysInMonth));
    return k.page(
      k.header('Limit', (d.category.icon ? d.category.icon + ' ' : '') + d.category.name),
      k.card(
        '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: spentNow / limit,
            size: 108,
            tone: spentNow > limit ? 'expense' : spentNow / limit > 0.85 ? 'warn' : 'accent',
            sub: 'used',
          }) +
          '<div class="grow">' +
          k.kv([
            ['Spent', k.esc(k.money(spentNow, d.currency))],
            ['Limit', k.esc(k.money(limit, d.currency))],
            [
              'Left per day',
              k.text(k.money(perDay, d.currency), perDay > 0 ? 'income' : 'expense'),
            ],
          ]) +
          '</div></div>',
      ),
      cum.length > 1
        ? k.card(
            k.lineChart({
              labels,
              series: [
                {
                  name: 'Spent so far',
                  values: labels.map((_, i) => (i < cum.length ? cum[i]! : null)),
                  tone: 0,
                },
                { name: 'Even pace', values: ideal, tone: 'neutral', dashed: true },
              ],
              currency: d.currency,
              area: false,
              ref: { value: limit, label: 'Limit' },
              title: 'Cumulative spend vs limit',
            }),
          )
        : '',
      k.arr(d.transactions).length
        ? k.section(
            'Latest',
            k.list(
              d.transactions!.map((t) =>
                k.row({
                  title: t.title,
                  sub: k.date(t.occurredAt, 'day'),
                  value: '−' + k.money(t.amountMinor, d.currency),
                  valueTone: 'expense',
                }),
              ),
            ),
          )
        : '',
    );
  },
});

type Over = {
  currency: string;
  items: Array<{
    name: string;
    icon?: string;
    limitMinor: Minor;
    spentMinor: Minor;
    projectedMinor?: Minor;
  }>;
};

export const overLimit = defineWidget<Over>({
  domain: 'categories',
  name: 'overLimit',
  title: 'Over-limit alerts',
  description: 'Categories already over their limit or projected to go over by month end.',
  examples: [
    {
      currency: CUR,
      items: [
        { name: 'Shopping', icon: '🛍️', limitMinor: 1_200_000, spentMinor: 1_420_000 },
        { name: 'Transport', icon: '🚕', limitMinor: 400_000, spentMinor: 436_500 },
        {
          name: 'Groceries',
          icon: '🛒',
          limitMinor: 1_000_000,
          spentMinor: 910_000,
          projectedMinor: 1_050_000,
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Limits', 'Alerts'),
        k.empty('Everything within limits', 'No category is over or on track to go over.', 'check'),
      );
    return k.page(
      k.header('Limits', 'Alerts', k.pill(String(items.length), 'expense')),
      k.list(
        items.map((c) => {
          const over = k.num(c.spentMinor) - k.num(c.limitMinor);
          return k.row({
            lead: k.glyph(c.name, c.icon, over > 0 ? 'expense' : 'warn'),
            title: c.name,
            sub:
              over > 0
                ? 'Over by ' + k.money(over, d.currency)
                : 'Projected ' + k.money(c.projectedMinor, d.currency) + ' by month end',
            value: k.money(c.spentMinor, d.currency),
            valueSub: 'of ' + k.money(c.limitMinor, d.currency),
            valueTone: over > 0 ? 'expense' : 'warn',
          });
        }),
      ),
    );
  },
});

type Grid = { items?: Category[] };

export const categoryGrid = defineWidget<Grid>({
  domain: 'categories',
  name: 'grid',
  title: 'Categories',
  description: 'All your categories as tiles with icon, this month’s spend and limit status.',
  examples: [{ items: ITEMS }],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Categories', 'All'),
        k.empty('No categories', 'Create a category to organize spending.', 'tag'),
      );
    return k.page(
      k.header('Categories', k.plural(items.length, 'category', 'categories')),
      k.grid(
        items.map((c) => {
          const l = k.num(c.monthlyLimitMinor);
          const s = k.num(c.monthSpentMinor);
          const cur = c.monthCurrency || c.limitCurrency || 'INR';
          return k.card(
            '<div style="display:flex;gap:8px;align-items:center">' +
              k.glyph(c.name, c.icon) +
              '<div class="grow"><div class="title" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
              k.esc(c.name) +
              '</div><div class="sub">' +
              k.esc(k.money(s, cur)) +
              (l ? ' of ' + k.esc(k.money(l, cur, { compact: true })) : '') +
              '</div></div></div>' +
              (l
                ? '<div style="margin-top:8px">' +
                  k.progress(s / l, s > l ? 'expense' : s / l > 0.85 ? 'warn' : 'accent') +
                  '</div>'
                : ''),
          );
        }),
        160,
      ),
    );
  },
});

type History = {
  currency: string;
  category: string;
  months: Array<{ label: string; spentMinor: Minor; limitMinor: Minor }>;
};

export const limitHistory = defineWidget<History>({
  domain: 'categories',
  name: 'limitHistory',
  title: 'Limit history',
  description:
    'Monthly spend in a category against its limit for the last 6 months, with months over highlighted.',
  examples: [
    {
      currency: CUR,
      category: 'Food & dining',
      months: monthLabels(6).map((label, i) => ({
        label,
        spentMinor: series(6, 1_150_000, 0.2, 411)[i]!,
        limitMinor: 1_200_000,
      })),
    },
  ],
  empty: { currency: CUR, category: 'Category', months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Limit history', d.category),
        k.empty('No history yet', undefined, 'trend'),
      );
    const over = months.filter((m) => k.num(m.spentMinor) > k.num(m.limitMinor)).length;
    return k.page(
      k.header(
        'Limit history',
        d.category,
        k.pill(over + ' of ' + months.length + ' months over', over ? 'warn' : 'income'),
      ),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [{ name: 'Spent', values: months.map((m) => k.num(m.spentMinor)), tone: 0 }],
          net: months.map((m) => k.num(m.limitMinor)),
          netName: 'Limit',
          currency: d.currency,
          title: 'Spent vs limit by month',
        }),
      ),
    );
  },
});

type Summary = {
  currency: string;
  totalLimitMinor: Minor;
  totalSpentMinor: Minor;
  dayOfMonth: number;
  daysInMonth: number;
  onTrack: number;
  near: number;
  over: number;
};

export const limitsSummary = defineWidget<Summary>({
  domain: 'categories',
  name: 'limitsSummary',
  title: 'Limits overview',
  description:
    'All category limits combined: a ring for the month, time elapsed, and how many categories are on track, near or over.',
  examples: [
    {
      currency: CUR,
      totalLimitMinor: 6_000_000,
      totalSpentMinor: 4_651_500,
      dayOfMonth: 26,
      daysInMonth: 30,
      onTrack: 4,
      near: 2,
      over: 2,
    },
  ],
  empty: {
    currency: CUR,
    totalLimitMinor: 0,
    totalSpentMinor: 0,
    dayOfMonth: 1,
    daysInMonth: 30,
    onTrack: 0,
    near: 0,
    over: 0,
  },
  render: (d, k) => {
    const limit = k.num(d.totalLimitMinor);
    if (!limit)
      return k.page(
        k.header('Limits', 'Overview'),
        k.empty(
          'No limits set',
          'Give your categories monthly limits to see an overview.',
          'target',
        ),
      );
    const used = k.num(d.totalSpentMinor) / limit;
    const time = d.dayOfMonth / d.daysInMonth;
    return k.page(
      k.header('Limits', 'This month'),
      k.card(
        '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: used,
            size: 116,
            tone: used > 1 ? 'expense' : used > time ? 'warn' : 'income',
            sub: 'of limits',
          }) +
          '<div class="grow" style="display:grid;gap:10px">' +
          k.meter({
            label: 'Month elapsed',
            value: time,
            max: 1,
            valueText: 'Day ' + d.dayOfMonth,
            maxText: String(d.daysInMonth),
            tone: 'neutral',
          }) +
          k.kv([
            ['Spent', k.esc(k.money(d.totalSpentMinor, d.currency))],
            ['Limits', k.esc(k.money(limit, d.currency))],
          ]) +
          '</div></div>',
      ),
      k.card(
        k.segments({
          items: [
            { label: 'On track', value: d.onTrack, tone: 'income' },
            { label: 'Near limit', value: d.near, tone: 'warn' },
            { label: 'Over', value: d.over, tone: 'expense' },
          ],
          format: 'number',
          title: 'Categories by status',
        }),
      ),
    );
  },
});

type Unlimited = {
  currency: string;
  items: Array<{ name: string; icon?: string; spentMinor: Minor; averageMinor: Minor }>;
};

export const unlimited = defineWidget<Unlimited>({
  domain: 'categories',
  name: 'withoutLimits',
  title: 'Categories without limits',
  description:
    'Where you spend without a limit, ranked, with the 3-month average as a starting point.',
  examples: [
    {
      currency: CUR,
      items: [
        { name: 'Health', icon: '💊', spentMinor: 210_000, averageMinor: 260_000 },
        { name: 'Education', icon: '📚', spentMinor: 120_000, averageMinor: 180_000 },
        { name: 'Pets', icon: '🐶', spentMinor: 86_000, averageMinor: 92_000 },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Limits', 'Without limits'),
        k.empty('Every category has a limit', undefined, 'check'),
      );
    return k.page(
      k.header('Limits', 'Categories without limits'),
      k.card(
        k.barList({
          items: items.map((c) => ({
            label: c.name,
            value: k.num(c.spentMinor),
            lead: k.glyph(c.name, c.icon, 'neutral'),
            sub: '3-month avg ' + k.money(c.averageMinor, d.currency),
            tone: 'neutral',
          })),
          currency: d.currency,
          title: 'Spending without limits',
        }),
      ),
      k.actions(
        k.ask('Suggest limits', 'Suggest monthly limits for my categories that do not have one.'),
      ),
    );
  },
});

type Rollover = {
  currency: string;
  items: Array<{
    name: string;
    icon?: string;
    limitMinor: Minor;
    carriedMinor: Minor;
    spentMinor: Minor;
  }>;
};

export const rollover = defineWidget<Rollover>({
  domain: 'categories',
  name: 'rollover',
  title: 'Limit rollover',
  description:
    'Unspent (or overspent) amounts carried into this month for each category with rollover on.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          name: 'Travel',
          icon: '✈️',
          limitMinor: 1_000_000,
          carriedMinor: 2_400_000,
          spentMinor: 140_000,
        },
        {
          name: 'Gifts',
          icon: '🎁',
          limitMinor: 200_000,
          carriedMinor: 350_000,
          spentMinor: 95_000,
        },
        {
          name: 'Shopping',
          icon: '🛍️',
          limitMinor: 1_200_000,
          carriedMinor: -220_000,
          spentMinor: 1_420_000,
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Limits', 'Rollover'),
        k.empty(
          'No rollover categories',
          'Turn on rollover to carry unspent limit into next month.',
          'repeat',
        ),
      );
    return k.page(
      k.header('Limits', 'Rollover'),
      k.table(
        [
          { label: 'Category' },
          { label: 'Limit', align: 'right' },
          { label: 'Carried', align: 'right' },
          { label: 'Available', align: 'right' },
          { label: 'Spent', align: 'right' },
        ],
        items.map((c) => {
          const avail = k.num(c.limitMinor) + k.num(c.carriedMinor);
          return [
            k.esc((c.icon ? c.icon + ' ' : '') + c.name),
            k.esc(k.money(c.limitMinor, d.currency)),
            k.text(
              k.money(c.carriedMinor, d.currency, { sign: true }),
              k.toneOf(k.num(c.carriedMinor)),
            ),
            k.esc(k.money(avail, d.currency)),
            k.text(
              k.money(c.spentMinor, d.currency),
              k.num(c.spentMinor) > avail ? 'expense' : null,
            ),
          ];
        }),
        'Rollover by category',
      ),
    );
  },
});

type Suggest = {
  currency: string;
  items: Array<{
    name: string;
    icon?: string;
    currentMinor?: Minor;
    suggestedMinor: Minor;
    averageMinor: Minor;
    reason: string;
  }>;
};

export const suggestions = defineWidget<Suggest>({
  domain: 'categories',
  name: 'suggestedLimits',
  title: 'Suggested limits',
  description:
    'Limit suggestions per category based on your recent average, with the reasoning and the change from today.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          name: 'Food & dining',
          icon: '🍜',
          currentMinor: 1_200_000,
          suggestedMinor: 1_050_000,
          averageMinor: 980_000,
          reason: 'You stayed under for 4 months',
        },
        {
          name: 'Shopping',
          icon: '🛍️',
          currentMinor: 1_200_000,
          suggestedMinor: 1_400_000,
          averageMinor: 1_380_000,
          reason: 'Over 3 months running — a realistic limit',
        },
        {
          name: 'Health',
          icon: '💊',
          suggestedMinor: 300_000,
          averageMinor: 260_000,
          reason: 'No limit yet',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Limits', 'Suggestions'),
        k.empty('No suggestions right now', 'Your limits match your spending well.', 'check'),
      );
    return k.page(
      k.header('Limits', 'Suggested limits'),
      k.list(
        items.map((c) =>
          k.row({
            lead: k.glyph(c.name, c.icon),
            title: c.name,
            sub: c.reason + ' · avg ' + k.money(c.averageMinor, d.currency),
            value: k.money(c.suggestedMinor, d.currency),
            valueSub:
              c.currentMinor !== undefined ? 'now ' + k.money(c.currentMinor, d.currency) : 'new',
            valueTone: 'accent',
          }),
        ),
      ),
      k.actions(k.ask('Apply these limits', 'Apply the suggested category limits.')),
    );
  },
});

type IncomeCats = {
  currency: string;
  items: Array<{ name: string; icon?: string; receivedMinor: Minor; expectedMinor?: Minor }>;
};

export const incomeCategories = defineWidget<IncomeCats>({
  domain: 'categories',
  name: 'income',
  title: 'Income categories',
  description: 'Money received this month per income category against what you expected.',
  examples: [
    {
      currency: CUR,
      items: [
        { name: 'Salary', icon: '💼', receivedMinor: 9_500_000, expectedMinor: 9_500_000 },
        { name: 'Freelance', icon: '🎨', receivedMinor: 1_250_000, expectedMinor: 2_000_000 },
        { name: 'Rent', icon: '🏠', receivedMinor: 0, expectedMinor: 1_500_000 },
        { name: 'Cashback', icon: '💳', receivedMinor: 420_000 },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Categories', 'Income'),
        k.empty('No income categories', undefined, 'cash'),
      );
    return k.page(
      k.header('Categories', 'Income this month'),
      k.card(
        items
          .map((c) =>
            c.expectedMinor !== undefined
              ? k.meter({
                  lead: k.glyph(c.name, c.icon, 'income'),
                  label: c.name,
                  value: k.num(c.receivedMinor),
                  max: k.num(c.expectedMinor),
                  valueText: k.money(c.receivedMinor, d.currency),
                  maxText: k.money(c.expectedMinor, d.currency),
                  tone: 'income',
                  sub:
                    k.num(c.receivedMinor) >= k.num(c.expectedMinor)
                      ? 'Received'
                      : 'Waiting for ' +
                        k.money(k.num(c.expectedMinor) - k.num(c.receivedMinor), d.currency),
                })
              : k.row({
                  lead: k.glyph(c.name, c.icon, 'income'),
                  title: c.name,
                  value: '+' + k.money(c.receivedMinor, d.currency),
                  valueTone: 'income',
                }),
          )
          .join(''),
      ),
    );
  },
});

export const categoryWidgets = [
  limitsList,
  limitDetail,
  overLimit,
  categoryGrid,
  limitHistory,
  limitsSummary,
  unlimited,
  rollover,
  suggestions,
  incomeCategories,
];
