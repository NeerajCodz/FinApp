import { CUR, daysAgo, daysAhead, monthLabels } from '../sample';
import { defineWidget, type Minor } from '../types';

/** Shape of `finapp.finance.recurring.list` items (amount/type/category are optional extras). */
type Rule = {
  id: string;
  name: string;
  frequency: string;
  interval?: number;
  nextOccurrence?: number | null;
  endDate?: number | null;
  enabled?: boolean;
  autoCreate?: boolean;
  amountMinor?: Minor;
  currency?: string;
  type?: string;
  icon?: string;
};

const RULES: Rule[] = [
  {
    id: 'r1',
    name: 'Rent',
    frequency: 'monthly',
    interval: 1,
    nextOccurrence: daysAhead(5),
    enabled: true,
    autoCreate: true,
    amountMinor: 2_800_000,
    currency: CUR,
    type: 'expense',
    icon: '🏠',
  },
  {
    id: 'r2',
    name: 'Salary',
    frequency: 'monthly',
    interval: 1,
    nextOccurrence: daysAhead(4),
    enabled: true,
    autoCreate: true,
    amountMinor: 9_500_000,
    currency: CUR,
    type: 'income',
    icon: '💼',
  },
  {
    id: 'r3',
    name: 'Netflix',
    frequency: 'monthly',
    interval: 1,
    nextOccurrence: daysAhead(9),
    enabled: true,
    autoCreate: false,
    amountMinor: 64_900,
    currency: CUR,
    type: 'expense',
    icon: '🎬',
  },
  {
    id: 'r4',
    name: 'SIP — index fund',
    frequency: 'monthly',
    interval: 1,
    nextOccurrence: daysAhead(16),
    enabled: true,
    autoCreate: true,
    amountMinor: 1_000_000,
    currency: CUR,
    type: 'expense',
    icon: '📈',
  },
  {
    id: 'r5',
    name: 'Car insurance',
    frequency: 'yearly',
    interval: 1,
    nextOccurrence: daysAhead(64),
    enabled: true,
    autoCreate: false,
    amountMinor: 1_850_000,
    currency: CUR,
    type: 'expense',
    icon: '🚗',
  },
  {
    id: 'r6',
    name: 'Gym',
    frequency: 'monthly',
    interval: 1,
    nextOccurrence: null,
    enabled: false,
    autoCreate: false,
    amountMinor: 250_000,
    currency: CUR,
    type: 'expense',
    icon: '🏋️',
  },
];

/** Linked to `finapp.finance.recurring.list`. */
export const rules = defineWidget<{ items?: Rule[]; isDone?: boolean }>({
  domain: 'recurring',
  name: 'rules',
  title: 'Recurring',
  description:
    'Recurring bills, subscriptions and income with frequency, next date and whether they auto-post.',
  invoking: 'Loading recurring rules…',
  examples: [{ items: RULES, isDone: true }],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k
      .arr(d.items)
      .slice()
      .sort(
        (a, b) =>
          (a.enabled === false ? 1 : 0) - (b.enabled === false ? 1 : 0) ||
          k.num(a.nextOccurrence) - k.num(b.nextOccurrence),
      );
    if (!items.length)
      return k.page(
        k.header('Recurring', 'Bills & subscriptions'),
        k.empty(
          'Nothing recurring yet',
          'Add rent, subscriptions or salary as recurring to see what is coming.',
          'repeat',
        ),
      );
    const every = (r: Rule) =>
      r.interval && r.interval > 1
        ? 'Every ' +
          r.interval +
          ' ' +
          String(r.frequency).replace(/ly$/, '').replace('dai', 'day') +
          's'
        : String(r.frequency).charAt(0).toUpperCase() + String(r.frequency).slice(1);
    return k.page(
      k.header(
        'Recurring',
        k.plural(items.filter((r) => r.enabled !== false).length, 'active rule'),
      ),
      k.list(
        items.map((r) =>
          k.row({
            lead: k.glyph(r.name, r.icon, r.type === 'income' ? 'income' : 'accent'),
            title: r.name,
            badge: r.enabled === false ? k.pill('Paused') : r.autoCreate ? k.pill('Auto') : '',
            sub: [
              every(r),
              r.nextOccurrence ? 'Next ' + k.date(r.nextOccurrence, 'day') : '',
              r.endDate ? 'Ends ' + k.date(r.endDate, 'month') : '',
            ]
              .filter(Boolean)
              .join(' · '),
            value:
              r.amountMinor !== undefined
                ? (r.type === 'income' ? '+' : '') + k.money(r.amountMinor, r.currency)
                : '',
            valueTone: r.type === 'income' ? 'income' : null,
            muted: r.enabled === false,
          }),
        ),
      ),
    );
  },
});

type Calendar = {
  currency: string;
  year: number;
  month: number;
  today?: number;
  items: Array<{ day: number; name: string; amountMinor: Minor; type?: string }>;
};

export const billsCalendar = defineWidget<Calendar>({
  domain: 'recurring',
  name: 'calendar',
  title: 'Bills calendar',
  description:
    'A month calendar of upcoming bills and paydays, with totals for the rest of the month.',
  examples: [
    {
      currency: CUR,
      year: 2026,
      month: 11,
      today: 0,
      items: [
        { day: 1, name: 'Rent', amountMinor: 2_800_000 },
        { day: 1, name: 'Salary', amountMinor: 9_500_000, type: 'income' },
        { day: 5, name: 'Card bill', amountMinor: 1_240_000 },
        { day: 5, name: 'Netflix', amountMinor: 64_900 },
        { day: 12, name: 'SIP', amountMinor: 1_000_000 },
        { day: 18, name: 'Airtel', amountMinor: 99_900 },
        { day: 22, name: 'Spotify', amountMinor: 11_900 },
        { day: 28, name: 'Electricity', amountMinor: 240_000 },
      ],
    },
  ],
  empty: { currency: CUR, year: 2026, month: 11, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    const title = k.date(Date.UTC(d.year, d.month, 15), 'month');
    if (!items.length)
      return k.page(
        k.header('Bills', title),
        k.empty('No bills scheduled', 'Recurring bills will appear on the calendar.', 'calendar'),
      );
    const marks: Record<string, Array<{ label: string; tone: 'income' | 'expense' }>> = {};
    items.forEach(
      (i) =>
        (marks[String(i.day)] = (marks[String(i.day)] || []).concat([
          {
            label: i.name + ' ' + k.money(i.amountMinor, d.currency),
            tone: i.type === 'income' ? 'income' : 'expense',
          },
        ])),
    );
    const out = k.sum(items.filter((i) => i.type !== 'income').map((i) => i.amountMinor));
    const inc = k.sum(items.filter((i) => i.type === 'income').map((i) => i.amountMinor));
    return k.page(
      k.header('Bills', title),
      k.stats([
        { label: 'Bills', value: k.money(out, d.currency), tone: 'expense' },
        { label: 'Income', value: k.money(inc, d.currency), tone: 'income' },
      ]),
      k.card(k.calendar({ year: d.year, month: d.month, marks, today: d.today })),
      k.legend([
        { label: 'Bill', tone: 'expense' },
        { label: 'Income', tone: 'income' },
      ]),
    );
  },
});

type Upcoming = {
  currency: string;
  items: Array<{
    name: string;
    dueAt: number;
    amountMinor: Minor;
    account?: string;
    autopay?: boolean;
    icon?: string;
  }>;
};

export const upcoming = defineWidget<Upcoming>({
  domain: 'recurring',
  name: 'upcoming',
  title: 'Upcoming bills',
  description: 'Bills due soon in date order with days left, autopay status and the total due.',
  examples: [
    {
      currency: CUR,
      items: RULES.filter((r) => r.type === 'expense' && r.nextOccurrence).map((r) => ({
        name: r.name,
        dueAt: r.nextOccurrence!,
        amountMinor: r.amountMinor!,
        account: 'HDFC Savings',
        autopay: r.autoCreate,
        icon: r.icon,
      })),
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k
      .arr(d.items)
      .slice()
      .sort((a, b) => a.dueAt - b.dueAt);
    if (!items.length)
      return k.page(
        k.header('Bills', 'Upcoming'),
        k.empty('No upcoming bills', undefined, 'check'),
      );
    return k.page(
      k.header(
        'Bills',
        'Upcoming',
        k.pill(k.money(k.sum(items.map((i) => i.amountMinor)), d.currency)),
      ),
      k.list(
        items.map((b) => {
          const days = k.daysUntil(b.dueAt);
          return k.row({
            lead: k.glyph(b.name, b.icon, days <= 3 ? 'warn' : 'accent'),
            title: b.name,
            badge: b.autopay ? k.pill('Autopay') : '',
            sub: k.date(b.dueAt, 'weekday') + (b.account ? ' · ' + b.account : ''),
            value: k.money(b.amountMinor, d.currency),
            valueSub: days <= 0 ? 'today' : 'in ' + k.plural(days, 'day'),
            valueTone: days <= 3 ? 'warn' : null,
          });
        }),
      ),
    );
  },
});

type Subs = {
  currency: string;
  items: Array<{
    name: string;
    amountMinor: Minor;
    cycle: 'monthly' | 'yearly' | 'weekly';
    nextAt?: number;
    category?: string;
    lastUsedAt?: number;
  }>;
};
const SUBS: Subs['items'] = [
  {
    name: 'Netflix',
    amountMinor: 64_900,
    cycle: 'monthly',
    nextAt: daysAhead(9),
    category: 'Streaming',
    lastUsedAt: daysAgo(1),
  },
  {
    name: 'Spotify',
    amountMinor: 11_900,
    cycle: 'monthly',
    nextAt: daysAhead(22),
    category: 'Music',
    lastUsedAt: daysAgo(0),
  },
  {
    name: 'YouTube Premium',
    amountMinor: 14_900,
    cycle: 'monthly',
    nextAt: daysAhead(14),
    category: 'Streaming',
    lastUsedAt: daysAgo(3),
  },
  {
    name: 'iCloud 200GB',
    amountMinor: 21_900,
    cycle: 'monthly',
    nextAt: daysAhead(2),
    category: 'Storage',
    lastUsedAt: daysAgo(0),
  },
  {
    name: 'Amazon Prime',
    amountMinor: 149_900,
    cycle: 'yearly',
    nextAt: daysAhead(120),
    category: 'Shopping',
    lastUsedAt: daysAgo(4),
  },
  {
    name: 'Cult.fit',
    amountMinor: 250_000,
    cycle: 'monthly',
    nextAt: daysAhead(6),
    category: 'Fitness',
    lastUsedAt: daysAgo(47),
  },
  {
    name: 'Notion Plus',
    amountMinor: 82_000,
    cycle: 'monthly',
    nextAt: daysAhead(17),
    category: 'Productivity',
    lastUsedAt: daysAgo(9),
  },
];

export const subscriptions = defineWidget<Subs>({
  domain: 'recurring',
  name: 'subscriptions',
  title: 'Subscriptions',
  description:
    'Every subscription with its monthly-equivalent cost, next charge, and ones you have not used lately.',
  examples: [{ currency: CUR, items: SUBS }],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Subscriptions', 'Your subscriptions'),
        k.empty(
          'No subscriptions found',
          'Mark recurring expenses as subscriptions to track them.',
          'repeat',
        ),
      );
    const monthly = (s: (typeof items)[number]) =>
      s.cycle === 'yearly'
        ? k.num(s.amountMinor) / 12
        : s.cycle === 'weekly'
          ? (k.num(s.amountMinor) * 52) / 12
          : k.num(s.amountMinor);
    const total = k.sum(items.map(monthly));
    const idle = items.filter((s) => s.lastUsedAt && k.daysUntil(s.lastUsedAt) < -30);
    return k.page(
      k.header('Subscriptions', k.plural(items.length, 'subscription')),
      k.stats([
        { label: 'Per month', value: k.money(total, d.currency) },
        { label: 'Per year', value: k.money(total * 12, d.currency) },
        idle.length ? { label: 'Unused 30+ days', value: String(idle.length), tone: 'warn' } : null,
      ]),
      k.list(
        items
          .slice()
          .sort((a, b) => monthly(b) - monthly(a))
          .map((s) =>
            k.row({
              lead: k.glyph(s.name),
              title: s.name,
              badge:
                s.lastUsedAt && k.daysUntil(s.lastUsedAt) < -30 ? k.pill('Unused', 'warn') : '',
              sub: [s.category, s.nextAt ? 'Next ' + k.date(s.nextAt, 'day') : '']
                .filter(Boolean)
                .join(' · '),
              value: k.money(s.amountMinor, d.currency),
              valueSub: s.cycle,
            }),
          ),
      ),
    );
  },
});

export const subscriptionCost = defineWidget<Subs>({
  domain: 'recurring',
  name: 'subscriptionCost',
  title: 'Subscription costs',
  description:
    'Monthly-equivalent subscription spend by category as a donut, and annual cost ranked.',
  examples: [{ currency: CUR, items: SUBS }],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Subscriptions', 'Costs'),
        k.empty('No subscriptions', undefined, 'repeat'),
      );
    const monthly = (s: (typeof items)[number]) =>
      s.cycle === 'yearly'
        ? k.num(s.amountMinor) / 12
        : s.cycle === 'weekly'
          ? (k.num(s.amountMinor) * 52) / 12
          : k.num(s.amountMinor);
    const byCat: Record<string, number> = {};
    items.forEach(
      (s) => (byCat[s.category || 'Other'] = (byCat[s.category || 'Other'] || 0) + monthly(s)),
    );
    return k.page(
      k.header('Subscriptions', 'Where the money goes'),
      k.card(
        k.donut({
          items: Object.keys(byCat).map((c) => ({ label: c, value: byCat[c]! })),
          currency: d.currency,
          centerLabel: 'Per month',
          title: 'Subscriptions by category',
        }),
      ),
      k.section(
        'Per year',
        k.card(
          k.barList({
            items: items.map((s) => ({ label: s.name, value: monthly(s) * 12 })),
            currency: d.currency,
            title: 'Annual cost by subscription',
          }),
        ),
      ),
    );
  },
});

type Changes = {
  currency: string;
  items: Array<{ name: string; oldMinor: Minor; newMinor: Minor; changedAt: number }>;
};

export const priceChanges = defineWidget<Changes>({
  domain: 'recurring',
  name: 'priceChanges',
  title: 'Price changes',
  description:
    'Recurring charges whose amount changed, with old and new price and the yearly impact.',
  examples: [
    {
      currency: CUR,
      items: [
        { name: 'Netflix', oldMinor: 49_900, newMinor: 64_900, changedAt: daysAgo(40) },
        { name: 'Airtel postpaid', oldMinor: 79_900, newMinor: 99_900, changedAt: daysAgo(18) },
        { name: 'Cult.fit', oldMinor: 300_000, newMinor: 250_000, changedAt: daysAgo(70) },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Recurring', 'Price changes'),
        k.empty('No price changes', 'Your recurring charges have stayed the same.', 'check'),
      );
    const yearly = k.sum(items.map((i) => (k.num(i.newMinor) - k.num(i.oldMinor)) * 12));
    return k.page(
      k.header(
        'Recurring',
        'Price changes',
        k.pill(
          k.money(yearly, d.currency, { sign: true }) + '/yr',
          yearly > 0 ? 'expense' : 'income',
        ),
      ),
      k.list(
        items.map((i) => {
          const diff = k.num(i.newMinor) - k.num(i.oldMinor);
          return k.row({
            lead: k.tile(k.icon(diff > 0 ? 'up' : 'down', 16), diff > 0 ? 'expense' : 'income'),
            title: i.name,
            sub:
              k.money(i.oldMinor, d.currency) +
              ' → ' +
              k.money(i.newMinor, d.currency) +
              ' · ' +
              k.date(i.changedAt, 'day'),
            value: k.money(diff, d.currency, { sign: true }),
            valueSub: k.percent(k.num(i.oldMinor) ? diff / k.num(i.oldMinor) : 0),
            valueTone: diff > 0 ? 'expense' : 'income',
          });
        }),
      ),
    );
  },
});

type Week = {
  currency: string;
  days: Array<{ label: string; bills: Array<{ name: string; amountMinor: Minor }> }>;
  balanceMinor?: Minor;
};

export const billsThisWeek = defineWidget<Week>({
  domain: 'recurring',
  name: 'dueThisWeek',
  title: 'Due this week',
  description:
    'The next seven days of bills as columns per day, against the balance available to pay them.',
  examples: [
    {
      currency: CUR,
      balanceMinor: 4_210_000,
      days: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((label, i) => ({
        label,
        bills:
          i === 0
            ? [{ name: 'iCloud', amountMinor: 21_900 }]
            : i === 5
              ? [
                  { name: 'Rent', amountMinor: 2_800_000 },
                  { name: 'Cult.fit', amountMinor: 250_000 },
                ]
              : i === 3
                ? [{ name: 'Electricity', amountMinor: 240_000 }]
                : [],
      })),
    },
  ],
  empty: { currency: CUR, days: [] },
  render: (d, k) => {
    const days = k.arr(d.days);
    const total = k.sum(days.map((x) => k.sum(k.arr(x.bills).map((b) => b.amountMinor))));
    if (!total)
      return k.page(
        k.header('Bills', 'This week'),
        k.empty('Nothing due this week', undefined, 'check'),
      );
    return k.page(
      k.header(
        'Bills',
        'Due this week',
        k.pill(
          k.money(total, d.currency),
          d.balanceMinor !== undefined && total > k.num(d.balanceMinor) ? 'expense' : null,
        ),
      ),
      k.card(
        k.columns({
          labels: days.map((x) => x.label),
          series: [
            {
              name: 'Due',
              values: days.map((x) => k.sum(k.arr(x.bills).map((b) => b.amountMinor))),
              tone: 'warn',
            },
          ],
          currency: d.currency,
          height: 150,
          title: 'Bills due by day',
        }),
      ),
      k.list(
        days.flatMap((x) =>
          k
            .arr(x.bills)
            .map((b) =>
              k.row({ title: b.name, sub: x.label, value: k.money(b.amountMinor, d.currency) }),
            ),
        ),
      ),
      d.balanceMinor !== undefined
        ? k.note('Available to pay: ' + k.money(d.balanceMinor, d.currency) + '.')
        : '',
    );
  },
});

type Missed = {
  currency: string;
  items: Array<{ name: string; expectedAt: number; amountMinor: Minor; reason: string }>;
};

export const missed = defineWidget<Missed>({
  domain: 'recurring',
  name: 'missed',
  title: 'Missed or late',
  description: 'Recurring items that did not happen on schedule, so you can record or skip them.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          name: 'Electricity (BESCOM)',
          expectedAt: daysAgo(3),
          amountMinor: 240_000,
          reason: 'No matching payment found',
        },
        {
          name: 'Rent from flat 2A',
          expectedAt: daysAgo(6),
          amountMinor: 1_500_000,
          reason: 'Income not received yet',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Recurring', 'Missed'),
        k.empty('Nothing missed', 'Every recurring item happened on time.', 'check'),
      );
    return k.page(
      k.header('Recurring', 'Missed or late', k.pill(String(items.length), 'warn')),
      k.list(
        items.map((i) =>
          k.row({
            lead: k.tile(k.icon('alert', 16), 'warn'),
            title: i.name,
            sub:
              i.reason +
              ' · due ' +
              k.date(i.expectedAt, 'day') +
              ' (' +
              Math.abs(k.daysUntil(i.expectedAt)) +
              'd ago)',
            value: k.money(i.amountMinor, d.currency),
            valueTone: 'warn',
          }),
        ),
      ),
    );
  },
});

type Committed = {
  currency: string;
  months: Array<{
    label: string;
    billsMinor: Minor;
    subscriptionsMinor: Minor;
    savingsMinor: Minor;
  }>;
};

export const committed = defineWidget<Committed>({
  domain: 'recurring',
  name: 'committed',
  title: 'Committed spending',
  description:
    'How much of each month is already spoken for by bills, subscriptions and automatic savings.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(6).map((label, i) => ({
        label,
        billsMinor: 3_380_000 + (i === 4 ? 1_850_000 : 0),
        subscriptionsMinor: 445_500 + i * 4_000,
        savingsMinor: 1_000_000,
      })),
    },
  ],
  empty: { currency: CUR, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Recurring', 'Committed'),
        k.empty('No recurring commitments', undefined, 'repeat'),
      );
    return k.page(
      k.header('Recurring', 'Committed each month'),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: [
            { name: 'Bills', values: months.map((m) => k.num(m.billsMinor)) },
            { name: 'Subscriptions', values: months.map((m) => k.num(m.subscriptionsMinor)) },
            { name: 'Auto-savings', values: months.map((m) => k.num(m.savingsMinor)) },
          ],
          mode: 'stacked',
          currency: d.currency,
          title: 'Committed spending by month',
        }),
      ),
    );
  },
});

export const recurringWidgets = [
  rules,
  billsCalendar,
  upcoming,
  subscriptions,
  subscriptionCost,
  priceChanges,
  billsThisWeek,
  missed,
  committed,
];
