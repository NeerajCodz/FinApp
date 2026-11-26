import { CUR, daysAgo, monthLabels, series } from '../sample';
import { defineWidget, type Minor } from '../types';

/** Shape of `finapp.finance.goals.list` items (savedMinor/icon are optional extras). */
type Goal = {
  id: string;
  name: string;
  targetAmountMinor: Minor;
  savedMinor?: Minor;
  currency: string;
  targetDate?: number | null;
  monthlyContributionMinor?: Minor | null;
  completedAt?: number | null;
  icon?: string;
};

const GOALS: Goal[] = [
  {
    id: 'g1',
    name: 'Emergency fund',
    icon: '🛟',
    targetAmountMinor: 30_000_000,
    savedMinor: 21_400_000,
    currency: CUR,
    targetDate: Date.UTC(2027, 2, 31),
    monthlyContributionMinor: 1_500_000,
  },
  {
    id: 'g2',
    name: 'Japan trip',
    icon: '🗾',
    targetAmountMinor: 25_000_000,
    savedMinor: 9_800_000,
    currency: CUR,
    targetDate: Date.UTC(2027, 3, 15),
    monthlyContributionMinor: 2_000_000,
  },
  {
    id: 'g3',
    name: 'New laptop',
    icon: '💻',
    targetAmountMinor: 18_000_000,
    savedMinor: 18_000_000,
    currency: CUR,
    completedAt: daysAgo(12),
  },
  {
    id: 'g4',
    name: 'Home down payment',
    icon: '🏡',
    targetAmountMinor: 300_000_000,
    savedMinor: 46_000_000,
    currency: CUR,
    targetDate: Date.UTC(2029, 11, 31),
    monthlyContributionMinor: 3_500_000,
  },
];

/** Linked to `finapp.finance.goals.list`. */
export const goalList = defineWidget<{ items?: Goal[]; isDone?: boolean }>({
  domain: 'goals',
  name: 'list',
  title: 'Goals',
  description: 'Your savings goals with progress, target dates and monthly contributions.',
  invoking: 'Loading your goals…',
  examples: [{ items: GOALS, isDone: true }],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Goals', 'Savings goals'),
        k.empty(
          'No goals yet',
          'Set a goal — an emergency fund, a trip, a gadget — and track it here.',
          'target',
        ),
      );
    const active = items.filter((g) => !g.completedAt);
    return k.page(
      k.header(
        'Goals',
        k.plural(active.length, 'active goal'),
        items.length > active.length
          ? k.pill(items.length - active.length + ' done', 'income')
          : '',
      ),
      k.list(
        items.map((g) => {
          const target = k.num(g.targetAmountMinor);
          const saved = g.completedAt ? target : k.num(g.savedMinor);
          const hasSaved = g.savedMinor !== undefined || !!g.completedAt;
          return k.row({
            lead: k.glyph(g.name, g.icon, g.completedAt ? 'income' : 'accent'),
            title: g.name,
            badge: g.completedAt ? k.pill('Done', 'income') : '',
            sub: [
              g.targetDate ? 'By ' + k.date(g.targetDate, 'month') : '',
              g.monthlyContributionMinor
                ? k.money(g.monthlyContributionMinor, g.currency) + '/mo'
                : '',
            ]
              .filter(Boolean)
              .join(' · '),
            html: hasSaved
              ? '<div style="margin-top:6px">' +
                k.progress(target ? saved / target : 0, g.completedAt ? 'income' : 'accent') +
                '</div>'
              : '',
            value: hasSaved ? k.percent(target ? saved / target : 0) : k.money(target, g.currency),
            valueSub: hasSaved
              ? k.money(saved, g.currency, { compact: true }) +
                ' of ' +
                k.money(target, g.currency, { compact: true })
              : 'target',
          });
        }),
      ),
    );
  },
});

export const goalRing = defineWidget<Goal | null>({
  domain: 'goals',
  name: 'progress',
  title: 'Goal progress',
  description:
    'One goal as a large progress ring with saved, remaining, monthly need and expected finish.',
  examples: [GOALS[1]!],
  empty: null,
  render: (d, k) => {
    if (!d || !d.name)
      return k.page(k.empty('Goal not found', 'It may have been archived.', 'target'));
    const target = k.num(d.targetAmountMinor);
    const saved = d.completedAt ? target : k.num(d.savedMinor);
    const left = Math.max(0, target - saved);
    const months = d.targetDate
      ? Math.max(1, Math.ceil((d.targetDate - Date.now()) / (30.4 * 86400000)))
      : 0;
    const need = months ? left / months : 0;
    const monthly = k.num(d.monthlyContributionMinor);
    const onTrack = !months || monthly >= need;
    return k.page(
      k.header(
        'Goal',
        (d.icon ? d.icon + ' ' : '') + d.name,
        d.completedAt
          ? k.pill('Completed', 'income')
          : onTrack
            ? k.pill('On track', 'income')
            : k.pill('Behind', 'warn'),
      ),
      k.card(
        '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: target ? saved / target : 0,
            size: 132,
            tone: d.completedAt ? 'income' : 'accent',
            sub: k.money(saved, d.currency, { compact: true }),
          }) +
          '<div class="grow">' +
          k.kv([
            ['Target', k.esc(k.money(target, d.currency))],
            ['Left', k.esc(k.money(left, d.currency))],
            d.targetDate ? ['Target date', k.esc(k.date(d.targetDate))] : null,
            need
              ? ['Needed per month', k.text(k.money(need, d.currency), onTrack ? null : 'warn')]
              : null,
            monthly ? ['Contributing', k.esc(k.money(monthly, d.currency) + '/mo')] : null,
          ]) +
          '</div></div>',
      ),
    );
  },
});

type Timeline = {
  currency: string;
  goal: string;
  targetMinor: Minor;
  months: string[];
  savedMinor: Array<number | null>;
  projectedMinor: Array<number | null>;
  targetDateLabel?: string;
};
const saved8 = [2_000_000, 3_400_000, 4_100_000, 5_900_000, 7_200_000, 8_100_000, 9_800_000];

export const goalTimeline = defineWidget<Timeline>({
  domain: 'goals',
  name: 'timeline',
  title: 'Goal timeline',
  description: 'Saved so far and the projected path to the target, with the finish month.',
  examples: [
    {
      currency: CUR,
      goal: 'Japan trip',
      targetMinor: 25_000_000,
      months: [
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
      ],
      savedMinor: [...saved8, null, null, null, null, null, null, null],
      projectedMinor: [
        null,
        null,
        null,
        null,
        null,
        null,
        9_800_000,
        11_800_000,
        13_800_000,
        15_800_000,
        17_800_000,
        19_800_000,
        21_800_000,
        23_800_000,
      ],
      targetDateLabel: 'Apr 2027',
    },
  ],
  empty: {
    currency: CUR,
    goal: 'Goal',
    targetMinor: 0,
    months: [],
    savedMinor: [],
    projectedMinor: [],
  },
  render: (d, k) => {
    if (!k.arr(d.months).length)
      return k.page(
        k.header('Goal', d.goal),
        k.empty('No contributions yet', 'Contribute to this goal to see its timeline.', 'target'),
      );
    const proj = k.arr(d.projectedMinor);
    const hitIndex = proj.findIndex((v) => v !== null && v >= k.num(d.targetMinor));
    return k.page(
      k.header(
        'Goal timeline',
        d.goal,
        hitIndex >= 0
          ? k.pill('Reached in ' + d.months[hitIndex], 'income')
          : k.pill('Beyond ' + d.months[d.months.length - 1], 'warn'),
      ),
      k.card(
        k.lineChart({
          labels: d.months,
          series: [
            { name: 'Saved', values: d.savedMinor, tone: 'accent' },
            { name: 'Projected', values: proj, tone: 'accent', dashed: true },
          ],
          currency: d.currency,
          area: false,
          ref: {
            value: k.num(d.targetMinor),
            label: 'Target' + (d.targetDateLabel ? ' · ' + d.targetDateLabel : ''),
          },
          title: 'Goal savings over time',
        }),
      ),
    );
  },
});

/** Shape of `finapp.finance.goal_contributions.list` (goalName is optional). */
type Contributions = {
  items?: Array<{
    id: string;
    goalId: string;
    goalName?: string;
    amountMinor: Minor;
    currency: string;
    accountId?: string;
    accountName?: string;
    occurredAt: number;
  }>;
  isDone?: boolean;
};

export const contributions = defineWidget<Contributions>({
  domain: 'goals',
  name: 'contributions',
  title: 'Goal contributions',
  description: 'Money added to goals, newest first, with the total for the page.',
  examples: [
    {
      items: [0, 1, 2, 3, 4, 5].map((i) => ({
        id: 'gc' + i,
        goalId: GOALS[i % 2]!.id,
        goalName: GOALS[i % 2]!.name,
        amountMinor: i % 2 ? 2_000_000 : 1_500_000,
        currency: CUR,
        accountName: 'HDFC Savings',
        occurredAt: daysAgo(i * 15 + 2),
      })),
      isDone: true,
    },
  ],
  empty: { items: [], isDone: true },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Goals', 'Contributions'),
        k.empty(
          'No contributions yet',
          'Money you set aside for goals will be listed here.',
          'target',
        ),
      );
    const cur = items[0]!.currency;
    return k.page(
      k.header(
        'Goals',
        'Contributions',
        k.pill(k.money(k.sum(items.map((c) => c.amountMinor)), cur), 'income'),
      ),
      k.list(
        items.map((c) =>
          k.row({
            lead: k.tile(k.icon('plus', 16), 'income'),
            title: c.goalName || 'Goal contribution',
            sub: [k.date(c.occurredAt, 'day'), c.accountName].filter(Boolean).join(' · '),
            value: '+' + k.money(c.amountMinor, c.currency),
            valueTone: 'income',
          }),
        ),
      ),
      d.isDone === false ? k.note('More contributions available — ask for the next page.') : '',
    );
  },
});

type ContribChart = {
  currency: string;
  months: Array<{ label: string; goals: Array<{ name: string; amountMinor: Minor }> }>;
};

export const contributionChart = defineWidget<ContribChart>({
  domain: 'goals',
  name: 'contributionChart',
  title: 'Monthly contributions',
  description: 'How much you put toward each goal every month, as stacked columns.',
  examples: [
    {
      currency: CUR,
      months: monthLabels(6).map((label, i) => ({
        label,
        goals: [
          { name: 'Emergency fund', amountMinor: 1_500_000 },
          { name: 'Japan trip', amountMinor: i === 2 ? 0 : 2_000_000 },
          { name: 'Home', amountMinor: series(6, 3_000_000, 0.4, 501)[i]! },
        ],
      })),
    },
  ],
  empty: { currency: CUR, months: [] },
  render: (d, k) => {
    const months = k.arr(d.months);
    if (!months.length)
      return k.page(
        k.header('Goals', 'Contributions by month'),
        k.empty('No contributions yet', undefined, 'target'),
      );
    const names: string[] = [];
    months.forEach((m) =>
      k.arr(m.goals).forEach((g) => names.indexOf(g.name) < 0 && names.push(g.name)),
    );
    return k.page(
      k.header('Goals', 'Contributions by month'),
      k.card(
        k.columns({
          labels: months.map((m) => m.label),
          series: names.slice(0, 8).map((n) => ({
            name: n,
            values: months.map((m) =>
              k.num(
                (k.arr(m.goals).filter((g) => g.name === n)[0] || { amountMinor: 0 }).amountMinor,
              ),
            ),
          })),
          mode: 'stacked',
          currency: d.currency,
          title: 'Goal contributions by month',
        }),
      ),
    );
  },
});

type Summary = {
  currency: string;
  totalSavedMinor: Minor;
  totalTargetMinor: Minor;
  active: number;
  completed: number;
  monthlyMinor: Minor;
  goals: Array<{ name: string; savedMinor: Minor; targetMinor: Minor }>;
};

export const goalsSummary = defineWidget<Summary>({
  domain: 'goals',
  name: 'summary',
  title: 'Goals overview',
  description:
    'All goals together: total saved of total targets, monthly commitment and each goal’s share.',
  examples: [
    {
      currency: CUR,
      totalSavedMinor: 95_200_000,
      totalTargetMinor: 373_000_000,
      active: 3,
      completed: 1,
      monthlyMinor: 7_000_000,
      goals: GOALS.map((g) => ({
        name: g.name,
        savedMinor: g.savedMinor!,
        targetMinor: g.targetAmountMinor,
      })),
    },
  ],
  empty: {
    currency: CUR,
    totalSavedMinor: 0,
    totalTargetMinor: 0,
    active: 0,
    completed: 0,
    monthlyMinor: 0,
    goals: [],
  },
  render: (d, k) => {
    if (!d.active && !d.completed)
      return k.page(k.header('Goals', 'Overview'), k.empty('No goals yet', undefined, 'target'));
    return k.page(
      k.header('Goals', 'Overview'),
      k.hero({
        label: 'Saved toward goals',
        value: k.money(d.totalSavedMinor, d.currency),
        sub:
          'of ' +
          k.money(d.totalTargetMinor, d.currency) +
          ' · ' +
          k.money(d.monthlyMinor, d.currency) +
          '/month',
        aside: k.ring({
          value: k.num(d.totalTargetMinor)
            ? k.num(d.totalSavedMinor) / k.num(d.totalTargetMinor)
            : 0,
          size: 76,
        }),
      }),
      k.stats([
        { label: 'Active', value: String(d.active) },
        { label: 'Completed', value: String(d.completed), tone: 'income' },
      ]),
      k.arr(d.goals).length
        ? k.card(
            k.donut({
              items: d.goals.map((g) => ({ label: g.name, value: k.num(g.savedMinor) })),
              currency: d.currency,
              centerLabel: 'Saved',
              title: 'Saved by goal',
            }),
          )
        : '',
    );
  },
});

type Status = {
  currency: string;
  goals: Array<{
    name: string;
    icon?: string;
    status: 'ahead' | 'on_track' | 'behind' | 'at_risk';
    neededMinor: Minor;
    contributingMinor: Minor;
  }>;
};

export const onTrack = defineWidget<Status>({
  domain: 'goals',
  name: 'onTrack',
  title: 'Are my goals on track?',
  description:
    'Each goal’s status with the monthly amount needed versus what you are contributing.',
  examples: [
    {
      currency: CUR,
      goals: [
        {
          name: 'Emergency fund',
          icon: '🛟',
          status: 'ahead',
          neededMinor: 1_200_000,
          contributingMinor: 1_500_000,
        },
        {
          name: 'Japan trip',
          icon: '🗾',
          status: 'behind',
          neededMinor: 3_040_000,
          contributingMinor: 2_000_000,
        },
        {
          name: 'Home down payment',
          icon: '🏡',
          status: 'on_track',
          neededMinor: 6_930_000,
          contributingMinor: 7_000_000,
        },
      ],
    },
  ],
  empty: { currency: CUR, goals: [] },
  render: (d, k) => {
    const goals = k.arr(d.goals);
    if (!goals.length)
      return k.page(
        k.header('Goals', 'Status'),
        k.empty('No dated goals', 'Give a goal a target date to check its pace.', 'target'),
      );
    const label: Record<string, string> = {
      ahead: 'Ahead',
      on_track: 'On track',
      behind: 'Behind',
      at_risk: 'At risk',
    };
    const tone: Record<string, 'income' | 'warn' | 'expense'> = {
      ahead: 'income',
      on_track: 'income',
      behind: 'warn',
      at_risk: 'expense',
    };
    return k.page(
      k.header('Goals', 'Status'),
      k.card(
        goals
          .map((g) =>
            k.meter({
              lead: k.glyph(g.name, g.icon),
              label: g.name,
              value: k.num(g.contributingMinor),
              max: k.num(g.neededMinor),
              valueText: k.money(g.contributingMinor, d.currency) + '/mo',
              maxText: k.money(g.neededMinor, d.currency) + ' needed',
              tone: tone[g.status],
              sub: label[g.status],
            }),
          )
          .join(''),
      ),
    );
  },
});

type Done = {
  currency: string;
  goal: string;
  icon?: string;
  targetMinor: Minor;
  startedAt: number;
  completedAt: number;
  contributions: number;
};

export const goalCompleted = defineWidget<Done | null>({
  domain: 'goals',
  name: 'completed',
  title: 'Goal reached',
  description:
    'A celebration card for a completed goal: amount, how long it took and how many contributions.',
  examples: [
    {
      currency: CUR,
      goal: 'New laptop',
      icon: '💻',
      targetMinor: 18_000_000,
      startedAt: Date.UTC(2026, 1, 1),
      completedAt: daysAgo(12),
      contributions: 9,
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.goal)
      return k.page(
        k.empty(
          'No completed goals yet',
          'Keep going — your first finished goal will be celebrated here.',
          'star',
        ),
      );
    const months = Math.max(1, Math.round((d.completedAt - d.startedAt) / (30.4 * 86400000)));
    return k.page(
      k.card(
        '<div style="display:grid;justify-items:center;gap:8px;text-align:center;padding:8px 0">' +
          k.ring({ value: 1, size: 120, tone: 'income', center: d.icon || '✓' }) +
          '<p class="eyebrow">Goal reached</p><h2>' +
          k.esc(d.goal) +
          '</h2><div class="big pos">' +
          k.esc(k.money(d.targetMinor, d.currency)) +
          '</div><p class="sub">' +
          k.esc(
            'Saved in ' +
              k.plural(months, 'month') +
              ' with ' +
              k.plural(d.contributions, 'contribution') +
              ' · ' +
              k.date(d.completedAt),
          ) +
          '</p></div>',
      ),
    );
  },
});

type Compare = { currency: string; goals: Goal[] };

export const goalCompare = defineWidget<Compare>({
  domain: 'goals',
  name: 'compare',
  title: 'Goals compared',
  description: 'Goals ranked by percent complete, as bars with amounts left.',
  examples: [{ currency: CUR, goals: GOALS }],
  empty: { currency: CUR, goals: [] },
  render: (d, k) => {
    const goals = k.arr(d.goals);
    if (!goals.length)
      return k.page(k.header('Goals', 'Compared'), k.empty('No goals yet', undefined, 'target'));
    return k.page(
      k.header('Goals', 'Progress compared'),
      k.card(
        k.barList({
          items: goals.map((g) => {
            const t = k.num(g.targetAmountMinor);
            const s = g.completedAt ? t : k.num(g.savedMinor);
            return {
              label: (g.icon ? g.icon + ' ' : '') + g.name,
              value: t ? s / t : 0,
              valueText: k.percent(t ? s / t : 0),
              sub: k.money(Math.max(0, t - s), g.currency) + ' left',
              tone: g.completedAt ? ('income' as const) : ('accent' as const),
            };
          }),
          format: 'percent',
          title: 'Goal progress',
        }),
      ),
    );
  },
});

type Milestones = {
  currency: string;
  goal: string;
  targetMinor: Minor;
  savedMinor: Minor;
  milestones: Array<{ pct: number; reachedAt?: number }>;
};

export const milestones = defineWidget<Milestones>({
  domain: 'goals',
  name: 'milestones',
  title: 'Goal milestones',
  description: 'Quarter-way milestones for a goal and when each was reached.',
  examples: [
    {
      currency: CUR,
      goal: 'Emergency fund',
      targetMinor: 30_000_000,
      savedMinor: 21_400_000,
      milestones: [
        { pct: 0.25, reachedAt: Date.UTC(2026, 1, 10) },
        { pct: 0.5, reachedAt: Date.UTC(2026, 5, 2) },
        { pct: 0.75 },
        { pct: 1 },
      ],
    },
  ],
  empty: { currency: CUR, goal: 'Goal', targetMinor: 0, savedMinor: 0, milestones: [] },
  render: (d, k) => {
    if (!k.num(d.targetMinor))
      return k.page(k.header('Goal', 'Milestones'), k.empty('No milestones', undefined, 'target'));
    return k.page(
      k.header('Milestones', d.goal, k.pill(k.percent(k.num(d.savedMinor) / k.num(d.targetMinor)))),
      k.card(
        k.progress(k.num(d.savedMinor) / k.num(d.targetMinor)) +
          '<div style="margin-top:12px">' +
          k.steps(
            k.arr(d.milestones).map((m) => ({
              label: k.percent(m.pct) + ' · ' + k.money(k.num(d.targetMinor) * m.pct, d.currency),
              done: !!m.reachedAt,
              sub: m.reachedAt
                ? 'Reached ' + k.date(m.reachedAt)
                : k.money(
                    Math.max(0, k.num(d.targetMinor) * m.pct - k.num(d.savedMinor)),
                    d.currency,
                  ) + ' to go',
            })),
          ) +
          '</div>',
      ),
    );
  },
});

export const goalWidgets = [
  goalList,
  goalRing,
  goalTimeline,
  contributions,
  contributionChart,
  goalsSummary,
  onTrack,
  goalCompleted,
  goalCompare,
  milestones,
];
