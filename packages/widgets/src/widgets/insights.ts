/** Insights, FinAI summaries, settings and security. */
import { CUR, daysAgo, monthLabels, series, walk } from '../sample';
import { defineWidget, type Minor } from '../types';

type Insight = {
  kind: 'saving' | 'warning' | 'trend' | 'win' | 'tip';
  title: string;
  body: string;
  amountMinor?: Minor;
  prompt?: string;
};
type Feed = { currency: string; items: Insight[] };

export const feed = defineWidget<Feed>({
  domain: 'insights',
  name: 'feed',
  title: 'Insights',
  description:
    'A feed of personalised insights — wins, warnings, trends and tips — each with a follow-up question.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          kind: 'warning',
          title: 'Shopping is 18% over its limit',
          body: 'Two Amazon orders this week pushed you past ₹12,000.',
          amountMinor: 220_000,
          prompt: 'Show my shopping this month',
        },
        {
          kind: 'win',
          title: 'Food spending down 25%',
          body: 'Your lowest food month since March.',
          prompt: 'How did my food spending change?',
        },
        {
          kind: 'saving',
          title: 'Cult.fit unused for 47 days',
          body: 'Cancelling saves ₹30,000 a year.',
          amountMinor: 3_000_000,
          prompt: 'List my unused subscriptions',
        },
        {
          kind: 'trend',
          title: 'Weekends cost 2.7× weekdays',
          body: 'Mostly dining out and cabs on Saturdays.',
          prompt: 'Break down my weekend spending',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Insights', 'For you'),
        k.empty(
          'No insights yet',
          'A few weeks of activity will surface patterns worth knowing.',
          'spark',
        ),
      );
    const icon: Record<string, string> = {
      saving: 'cash',
      warning: 'alert',
      trend: 'trend',
      win: 'star',
      tip: 'info',
    };
    const tone: Record<string, 'income' | 'warn' | 'accent' | 'info'> = {
      saving: 'income',
      warning: 'warn',
      trend: 'info',
      win: 'income',
      tip: 'accent',
    };
    return k.page(
      k.header('Insights', 'For you'),
      items
        .map((i) =>
          k.card(
            '<div style="display:flex;gap:10px;align-items:flex-start">' +
              k.tile(k.icon(icon[i.kind] || 'spark', 16), tone[i.kind]) +
              '<div class="grow" style="display:grid;gap:4px"><strong>' +
              k.esc(i.title) +
              '</strong><span class="sub">' +
              k.esc(i.body) +
              '</span>' +
              (i.prompt
                ? '<div class="actions" style="margin-top:4px">' +
                  k.ask(i.prompt, i.prompt) +
                  '</div>'
                : '') +
              '</div>' +
              (i.amountMinor !== undefined
                ? '<span class="amount ' +
                  k.toneClass(tone[i.kind] === 'warn' ? 'warn' : 'income') +
                  '">' +
                  k.esc(k.money(i.amountMinor, d.currency, { compact: true })) +
                  '</span>'
                : '') +
              '</div>',
            { tone: tone[i.kind] },
          ),
        )
        .join(''),
    );
  },
});

type Score = {
  score: number;
  previous?: number;
  factors: Array<{ label: string; score: number; note: string }>;
};

export const healthScore = defineWidget<Score>({
  domain: 'insights',
  name: 'healthScore',
  title: 'Money health score',
  description:
    'A 0–100 score from savings rate, limits, emergency fund, debt and bills on time, with each factor shown.',
  examples: [
    {
      score: 74,
      previous: 69,
      factors: [
        { label: 'Savings rate', score: 0.92, note: '56% of income kept' },
        { label: 'Category limits', score: 0.62, note: '2 of 8 over' },
        { label: 'Emergency fund', score: 0.71, note: '4.3 of 6 months' },
        { label: 'Debt', score: 0.8, note: 'Card at 21% utilization' },
        { label: 'Bills on time', score: 1, note: 'No late payments' },
      ],
    },
  ],
  empty: { score: 0, factors: [] },
  render: (d, k) => {
    if (!k.arr(d.factors).length)
      return k.page(
        k.header('Insights', 'Health score'),
        k.empty('Not enough data', 'Your score appears after a month of activity.', 'shield'),
      );
    const tone = d.score >= 75 ? 'income' : d.score >= 50 ? 'warn' : 'expense';
    return k.page(
      k.header(
        'Insights',
        'Money health',
        d.previous !== undefined ? k.delta((d.score - d.previous) / Math.max(1, d.previous)) : '',
      ),
      k.card(
        '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: d.score / 100,
            size: 124,
            tone,
            center: String(Math.round(d.score)),
            sub: 'of 100',
          }) +
          '<div class="grow" style="min-width:220px">' +
          d.factors
            .map((f) =>
              k.meter({
                label: f.label,
                value: f.score,
                max: 1,
                valueText: f.note,
                tone: f.score >= 0.75 ? 'income' : f.score >= 0.5 ? 'warn' : 'expense',
              }),
            )
            .join('') +
          '</div></div>',
      ),
    );
  },
});

type Monthly = {
  currency: string;
  month: string;
  incomeMinor: Minor;
  spentMinor: Minor;
  savedMinor: Minor;
  topCategories: Array<{ name: string; amountMinor: Minor }>;
  biggest?: { title: string; amountMinor: Minor };
  noSpendDays?: number;
  vsLastMonthPct?: number;
};

export const monthlyReport = defineWidget<Monthly>({
  domain: 'insights',
  name: 'monthlyReport',
  title: 'Monthly report',
  description:
    'The month in review: income, spending, savings, top categories, biggest purchase and no-spend days.',
  examples: [
    {
      currency: CUR,
      month: 'October 2026',
      incomeMinor: 10_200_000,
      spentMinor: 3_904_000,
      savedMinor: 6_296_000,
      topCategories: [
        { name: 'Food & dining', amountMinor: 1_120_000 },
        { name: 'Shopping', amountMinor: 980_000 },
        { name: 'Groceries', amountMinor: 820_000 },
      ],
      biggest: { title: 'IndiGo — BLR → GOI', amountMinor: 812_000 },
      noSpendDays: 5,
      vsLastMonthPct: -0.07,
    },
  ],
  empty: {
    currency: CUR,
    month: 'This month',
    incomeMinor: 0,
    spentMinor: 0,
    savedMinor: 0,
    topCategories: [],
  },
  render: (d, k) => {
    if (!k.num(d.incomeMinor) && !k.num(d.spentMinor))
      return k.page(
        k.header('Report', d.month),
        k.empty('No activity this month', undefined, 'calendar'),
      );
    return k.page(
      k.header('Monthly report', d.month),
      k.stats([
        { label: 'Income', value: k.money(d.incomeMinor, d.currency), tone: 'income' },
        {
          label: 'Spent',
          value: k.money(d.spentMinor, d.currency),
          tone: 'expense',
          delta: d.vsLastMonthPct,
          goodWhen: 'down',
        },
        { label: 'Saved', value: k.money(d.savedMinor, d.currency), tone: 'accent' },
      ]),
      k.arr(d.topCategories).length
        ? k.section(
            'Top categories',
            k.card(
              k.barList({
                items: d.topCategories.map((c) => ({ label: c.name, value: k.num(c.amountMinor) })),
                currency: d.currency,
                title: 'Top categories',
              }),
            ),
          )
        : '',
      k.card(
        k.kv([
          d.biggest
            ? [
                'Biggest purchase',
                k.esc(d.biggest.title + ' · ' + k.money(d.biggest.amountMinor, d.currency)),
              ]
            : null,
          d.noSpendDays !== undefined ? ['No-spend days', k.esc(String(d.noSpendDays))] : null,
          [
            'Savings rate',
            k.esc(k.percent(k.num(d.incomeMinor) ? k.num(d.savedMinor) / k.num(d.incomeMinor) : 0)),
          ],
        ]),
      ),
    );
  },
});

type Peers = {
  currency: string;
  items: Array<{ category: string; youMinor: Minor; typicalMinor: Minor }>;
};

export const vsTypical = defineWidget<Peers>({
  domain: 'insights',
  name: 'vsTypical',
  title: 'You vs your usual',
  description: 'This month per category against your own 6-month typical, as grouped columns.',
  examples: [
    {
      currency: CUR,
      items: [
        { category: 'Food', youMinor: 845_000, typicalMinor: 1_050_000 },
        { category: 'Groceries', youMinor: 910_000, typicalMinor: 820_000 },
        { category: 'Transport', youMinor: 436_500, typicalMinor: 390_000 },
        { category: 'Shopping', youMinor: 1_420_000, typicalMinor: 960_000 },
        { category: 'Bills', youMinor: 620_000, typicalMinor: 610_000 },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Insights', 'You vs usual'),
        k.empty('Not enough history', undefined, 'trend'),
      );
    const biggest = items
      .slice()
      .sort(
        (a, b) =>
          k.num(b.youMinor) - k.num(b.typicalMinor) - (k.num(a.youMinor) - k.num(a.typicalMinor)),
      )[0]!;
    return k.page(
      k.header('Insights', 'This month vs your usual'),
      k.card(
        k.columns({
          labels: items.map((i) => i.category),
          series: [
            { name: 'Usual', values: items.map((i) => k.num(i.typicalMinor)), tone: 'neutral' },
            { name: 'This month', values: items.map((i) => k.num(i.youMinor)), tone: 0 },
          ],
          currency: d.currency,
          title: 'This month vs usual by category',
        }),
      ),
      k.note(
        'Biggest jump: ' +
          biggest.category +
          ' (' +
          k.money(k.num(biggest.youMinor) - k.num(biggest.typicalMinor), d.currency, {
            sign: true,
          }) +
          ').',
      ),
    );
  },
});

type Streaks = {
  items: Array<{ label: string; days: number; best: number; icon: string; active: boolean }>;
};

export const streaks = defineWidget<Streaks>({
  domain: 'insights',
  name: 'streaks',
  title: 'Streaks',
  description:
    'Good-habit streaks — no-spend days, staying under limits, logging daily — with personal bests.',
  examples: [
    {
      items: [
        { label: 'Logging every day', days: 23, best: 41, icon: 'flame', active: true },
        { label: 'Under food limit (weeks)', days: 4, best: 6, icon: 'target', active: true },
        { label: 'No-spend days in a row', days: 0, best: 3, icon: 'sun', active: false },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Insights', 'Streaks'),
        k.empty('No streaks yet', 'Log daily or stay under a limit to start one.', 'flame'),
      );
    return k.page(
      k.header('Insights', 'Streaks'),
      k.grid(
        items.map((s) =>
          k.card(
            '<div style="display:grid;gap:6px">' +
              k.tile(k.icon(s.icon, 18), s.active ? 'warn' : 'neutral') +
              '<div class="big" style="font-size:26px">' +
              s.days +
              '</div><div class="title" style="font-weight:600">' +
              k.esc(s.label) +
              '</div><div class="sub">Best ' +
              s.best +
              '</div>' +
              k.progress(s.best ? s.days / s.best : 0, s.active ? 'warn' : 'neutral') +
              '</div>',
          ),
        ),
        160,
      ),
    );
  },
});

type Opps = {
  currency: string;
  items: Array<{
    title: string;
    detail: string;
    yearlyMinor: Minor;
    effort: 'easy' | 'medium' | 'hard';
  }>;
};

export const savingsOpportunities = defineWidget<Opps>({
  domain: 'insights',
  name: 'savingsOpportunities',
  title: 'Ways to save',
  description: 'Concrete savings opportunities ranked by yearly impact, with effort level.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          title: 'Cancel Cult.fit',
          detail: 'Unused for 47 days',
          yearlyMinor: 3_000_000,
          effort: 'easy',
        },
        {
          title: 'Cook two more dinners a week',
          detail: 'Swiggy averages ₹398 an order',
          yearlyMinor: 4_100_000,
          effort: 'medium',
        },
        {
          title: 'Switch to a yearly Spotify plan',
          detail: 'Save two months',
          yearlyMinor: 23_800,
          effort: 'easy',
        },
        {
          title: 'Move savings to a sweep FD',
          detail: '₹1.5L idle in savings at 3%',
          yearlyMinor: 450_000,
          effort: 'easy',
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Insights', 'Ways to save'),
        k.empty('Nothing obvious to cut', 'Your spending is already lean.', 'check'),
      );
    return k.page(
      k.header(
        'Insights',
        'Ways to save',
        k.pill(
          k.money(k.sum(items.map((i) => i.yearlyMinor)), d.currency, { compact: true }) + '/yr',
          'income',
        ),
      ),
      k.card(
        k.barList({
          items: items.map((i) => ({
            label: i.title,
            value: k.num(i.yearlyMinor),
            sub: i.detail + ' · ' + i.effort,
            tone: 'income',
          })),
          currency: d.currency,
          title: 'Yearly savings by opportunity',
        }),
      ),
    );
  },
});

type Achieve = {
  items: Array<{ title: string; earnedAt?: number; icon: string; progress?: number }>;
};

export const achievements = defineWidget<Achieve>({
  domain: 'insights',
  name: 'achievements',
  title: 'Milestones reached',
  description: 'Money milestones earned and the next ones in progress.',
  examples: [
    {
      items: [
        { title: 'First ₹1L saved', earnedAt: Date.UTC(2026, 3, 2), icon: 'star' },
        { title: '3 months under all limits', earnedAt: Date.UTC(2026, 8, 30), icon: 'target' },
        { title: 'Emergency fund: 6 months', icon: 'shield', progress: 0.71 },
        { title: '100 days of logging', icon: 'flame', progress: 0.41 },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Insights', 'Milestones'),
        k.empty('Your first milestone is close', undefined, 'star'),
      );
    return k.page(
      k.header('Insights', 'Milestones'),
      k.list(
        items.map((a) =>
          k.row({
            lead: k.tile(k.icon(a.icon, 16), a.earnedAt ? 'warn' : 'neutral'),
            title: a.title,
            sub: a.earnedAt ? 'Earned ' + k.date(a.earnedAt) : 'In progress',
            html: a.earnedAt
              ? ''
              : '<div style="margin-top:6px">' + k.progress(a.progress || 0) + '</div>',
            value: a.earnedAt ? '✓' : k.percent(a.progress || 0),
            valueTone: a.earnedAt ? 'income' : 'muted',
          }),
        ),
      ),
    );
  },
});

type Checkup = { items: Array<{ label: string; done: boolean; sub?: string }> };

export const checkup = defineWidget<Checkup>({
  domain: 'insights',
  name: 'checkup',
  title: 'Monthly checkup',
  description: 'A checklist of money housekeeping for the month and what is left.',
  examples: [
    {
      items: [
        { label: 'Categorize all transactions', done: true },
        { label: 'Reconcile HDFC Savings', done: true, sub: 'Balanced on Nov 25' },
        { label: 'Settle up Goa trip', done: false, sub: '₹3,450 still owed to you' },
        { label: 'Review subscriptions', done: false, sub: '1 unused' },
        { label: 'Top up emergency fund', done: true },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Checkup', 'This month'),
        k.empty('Nothing to check', undefined, 'check'),
      );
    const done = items.filter((i) => i.done).length;
    return k.page(
      k.header(
        'Checkup',
        'This month',
        k.pill(done + '/' + items.length, done === items.length ? 'income' : null),
      ),
      k.card(
        k.progress(done / items.length, 'income') +
          '<div style="margin-top:12px">' +
          k.steps(items) +
          '</div>',
      ),
    );
  },
});

// ---------- FinAI ----------

type Answer = {
  question: string;
  answer: string;
  figures?: Array<{ label: string; valueMinor: Minor; tone?: 'income' | 'expense' }>;
  chart?: { labels: string[]; valuesMinor: number[]; label: string };
  currency: string;
  followUps?: string[];
  sources?: string[];
};

export const answer = defineWidget<Answer>({
  domain: 'finai',
  name: 'answer',
  title: 'FinAI answer',
  description:
    'A FinAI answer card: the question, a plain-language answer, key figures, an optional chart and follow-ups.',
  examples: [
    {
      question: 'How much did I spend on food this year?',
      answer:
        'You spent ₹1.12L on food & dining in 2026 — 14% less than 2025, mostly from fewer delivery orders since August.',
      currency: CUR,
      figures: [
        { label: '2026', valueMinor: 11_200_000, tone: 'expense' },
        { label: '2025', valueMinor: 13_020_000 },
        { label: 'Monthly avg', valueMinor: 1_018_000 },
      ],
      chart: {
        labels: monthLabels(11),
        valuesMinor: series(11, 1_018_000, 0.25, 701),
        label: 'Food spending',
      },
      followUps: ['Which restaurants did I order from most?', 'Set a food limit of ₹9,000'],
      sources: ['412 transactions', 'Food & dining, Groceries excluded'],
    },
  ],
  empty: { question: '', answer: '', currency: CUR },
  render: (d, k) => {
    if (!d.answer)
      return k.page(
        k.empty(
          'Ask FinAI anything',
          'Questions about your money get answered here with numbers and charts.',
          'spark',
        ),
      );
    return k.page(
      '<header class="hd"><div class="hd-t" style="display:flex;gap:10px;align-items:center">' +
        k.tile(k.icon('spark', 16), 'accent') +
        '<div><p class="eyebrow">FinAI</p><h2>' +
        k.esc(d.question) +
        '</h2></div></div></header>',
      k.card('<p style="margin:0;font-size:15px;line-height:1.5">' + k.esc(d.answer) + '</p>'),
      k.arr(d.figures).length
        ? k.stats(
            d.figures!.map((f) => ({
              label: f.label,
              value: k.money(f.valueMinor, d.currency),
              tone: f.tone,
            })),
          )
        : '',
      d.chart
        ? k.card(
            k.columns({
              labels: d.chart.labels,
              series: [{ name: d.chart.label, values: d.chart.valuesMinor, tone: 0 }],
              currency: d.currency,
              height: 160,
              title: d.chart.label,
            }),
          )
        : '',
      k.arr(d.sources).length ? k.note('Based on ' + d.sources!.join(' · ')) : '',
      k.arr(d.followUps).length
        ? '<div class="actions">' + d.followUps!.map((q) => k.ask(q, q)).join('') + '</div>'
        : '',
    );
  },
});

type Plan = {
  currency: string;
  title: string;
  incomeMinor: Minor;
  rows: Array<{ category: string; currentMinor: Minor; suggestedMinor: Minor }>;
  note?: string;
};

export const plan = defineWidget<Plan>({
  domain: 'finai',
  name: 'plan',
  title: 'FinAI spending plan',
  description:
    'A suggested monthly plan per category against current spending, with what it frees up.',
  examples: [
    {
      currency: CUR,
      title: 'Plan to save ₹15,000 more a month',
      incomeMinor: 9_500_000,
      rows: [
        { category: 'Food & dining', currentMinor: 1_120_000, suggestedMinor: 800_000 },
        { category: 'Shopping', currentMinor: 1_420_000, suggestedMinor: 900_000 },
        { category: 'Transport', currentMinor: 436_500, suggestedMinor: 380_000 },
        { category: 'Entertainment', currentMinor: 380_000, suggestedMinor: 250_000 },
        { category: 'Subscriptions', currentMinor: 445_500, suggestedMinor: 195_500 },
      ],
      note: 'Keeps groceries, bills and rent unchanged.',
    },
  ],
  empty: { currency: CUR, title: 'Plan', incomeMinor: 0, rows: [] },
  render: (d, k) => {
    const rows = k.arr(d.rows);
    if (!rows.length)
      return k.page(
        k.header('FinAI', 'Plan'),
        k.empty('No plan yet', 'Ask FinAI to build a spending plan.', 'spark'),
      );
    const freed = k.sum(rows.map((r) => k.num(r.currentMinor) - k.num(r.suggestedMinor)));
    return k.page(
      k.header(
        'FinAI plan',
        d.title,
        k.pill('Frees ' + k.money(freed, d.currency, { compact: true }) + '/mo', 'income'),
      ),
      k.table(
        [
          { label: 'Category' },
          { label: 'Now', align: 'right' },
          { label: 'Plan', align: 'right' },
          { label: 'Change', align: 'right' },
        ],
        rows.map((r) => {
          const diff = k.num(r.suggestedMinor) - k.num(r.currentMinor);
          return [
            k.esc(r.category),
            k.esc(k.money(r.currentMinor, d.currency)),
            '<strong>' + k.esc(k.money(r.suggestedMinor, d.currency)) + '</strong>',
            k.text(
              k.money(diff, d.currency, { sign: true }),
              diff < 0 ? 'income' : diff > 0 ? 'expense' : null,
            ),
          ];
        }),
        'Spending plan',
      ),
      d.note ? k.note(d.note) : '',
      k.actions(k.ask('Apply as category limits', 'Apply this plan as my category limits.')),
    );
  },
});

type WhatIf = {
  currency: string;
  scenario: string;
  months: string[];
  baselineMinor: number[];
  scenarioMinor: number[];
  deltaMinor: Minor;
};

export const whatIf = defineWidget<WhatIf>({
  domain: 'finai',
  name: 'whatIf',
  title: 'What if…',
  description:
    'A scenario projection: your savings on the current path versus with a change, over the next year.',
  examples: [
    {
      currency: CUR,
      scenario: 'If I invest ₹10,000 more a month at 10%',
      months: monthLabels(12),
      baselineMinor: walk(12, 25_000_000, 5_000_000, 0, 1),
      scenarioMinor: walk(12, 25_000_000, 5_000_000, 0, 1).map(
        (v, i) => v + Math.round(1_000_000 * (i + 1) * (1 + 0.004 * i)),
      ),
      deltaMinor: 12_640_000,
    },
  ],
  empty: {
    currency: CUR,
    scenario: '',
    months: [],
    baselineMinor: [],
    scenarioMinor: [],
    deltaMinor: 0,
  },
  render: (d, k) => {
    if (!k.arr(d.months).length)
      return k.page(
        k.empty('Try a what-if', 'Ask “what if I saved ₹5,000 more a month?”', 'spark'),
      );
    return k.page(
      k.header('FinAI · What if', d.scenario),
      k.hero({
        label: 'Difference after ' + d.months.length + ' months',
        value: k.money(d.deltaMinor, d.currency, { sign: true }),
        tone: k.toneOf(k.num(d.deltaMinor)),
      }),
      k.card(
        k.lineChart({
          labels: d.months,
          series: [
            { name: 'Current path', values: d.baselineMinor, tone: 'neutral' },
            { name: 'With change', values: d.scenarioMinor, tone: 'accent' },
          ],
          currency: d.currency,
          area: false,
          zero: false,
          title: 'Projected savings',
        }),
      ),
    );
  },
});

type Actions = { items: Array<{ title: string; detail?: string; prompt: string; done?: boolean }> };

export const actionItems = defineWidget<Actions>({
  domain: 'finai',
  name: 'actions',
  title: 'Suggested actions',
  description: 'Next steps FinAI suggests, each one a tap away from asking the assistant to do it.',
  examples: [
    {
      items: [
        {
          title: 'Remind Kabir about ₹1,200',
          detail: 'Goa trip · 9 days',
          prompt: 'Remind Kabir about what he owes in Goa trip',
        },
        {
          title: 'Pause Cult.fit',
          detail: 'Unused 47 days',
          prompt: 'Pause my Cult.fit recurring payment',
        },
        {
          title: 'Move ₹20,000 to Japan trip',
          detail: 'You are ₹10,400 behind',
          prompt: 'Contribute ₹20,000 to my Japan trip goal',
        },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items).filter((i) => !i.done);
    if (!items.length)
      return k.page(
        k.header('FinAI', 'Suggested actions'),
        k.empty('Nothing needs doing', 'You are on top of things.', 'check'),
      );
    return k.page(
      k.header('FinAI', 'Suggested actions'),
      k.list(
        items.map((a) =>
          k.row({
            lead: k.tile(k.icon('spark', 16), 'accent'),
            title: a.title,
            sub: a.detail,
            html:
              '<div class="actions" style="margin-top:6px">' + k.ask('Do it', a.prompt) + '</div>',
          }),
        ),
      ),
    );
  },
});

type Quick = {
  currency: string;
  greeting: string;
  tiles: Array<{ label: string; valueMinor: Minor; tone?: 'income' | 'expense' }>;
  line: string;
};

export const briefing = defineWidget<Quick>({
  domain: 'finai',
  name: 'briefing',
  title: 'Daily briefing',
  description:
    'A short morning briefing: yesterday’s spend, what is due, balance and one line of advice.',
  examples: [
    {
      currency: CUR,
      greeting: 'Good morning',
      line: 'Rent is due Monday — HDFC Savings has plenty to cover it. You have ₹3,970 left in Food for the week.',
      tiles: [
        { label: 'Spent yesterday', valueMinor: 186_000, tone: 'expense' },
        { label: 'Due this week', valueMinor: 3_311_900 },
        { label: 'Balance', valueMinor: 18_742_300 },
      ],
    },
  ],
  empty: { currency: CUR, greeting: 'Hello', tiles: [], line: '' },
  render: (d, k) => {
    if (!k.arr(d.tiles).length && !d.line)
      return k.page(k.empty('Your briefing will appear here', undefined, 'sun'));
    return k.page(
      k.header('FinAI', d.greeting, k.icon('sun', 18)),
      k.stats(
        d.tiles.map((t) => ({
          label: t.label,
          value: k.money(t.valueMinor, d.currency),
          tone: t.tone,
        })),
      ),
      d.line
        ? k.card('<p style="margin:0;line-height:1.5">' + k.esc(d.line) + '</p>', {
            tone: 'accent',
          })
        : '',
    );
  },
});

// ---------- Settings ----------

/** Linked to `finapp.personal.profile.get`. */
type ProfileData = {
  id?: string;
  displayName?: string;
  username?: string;
  defaultCurrency?: string;
  timezone?: string;
  defaultAccountId?: string | null;
  defaultAccountName?: string;
  defaultExpenseCategoryId?: string | null;
  defaultExpenseCategoryName?: string;
  defaultIncomeCategoryId?: string | null;
  defaultIncomeCategoryName?: string;
  accent?: string;
} | null;

export const profileSettings = defineWidget<ProfileData>({
  domain: 'settings',
  name: 'profile',
  title: 'Your profile',
  description:
    'Your name, username, default currency, timezone and the defaults used when adding transactions.',
  examples: [
    {
      id: 'me',
      displayName: 'Neha Kapoor',
      username: 'neha',
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      defaultAccountId: 'a1',
      defaultAccountName: 'HDFC Savings',
      defaultExpenseCategoryId: 'c1',
      defaultExpenseCategoryName: 'Food & dining',
      defaultIncomeCategoryId: null,
      accent: 'volt',
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.displayName)
      return k.page(k.empty('Profile unavailable', 'Sign in again to load your profile.', 'user'));
    return k.page(
      k.card(
        '<div style="display:flex;gap:14px;align-items:center">' +
          k.avatar(d.displayName, 56) +
          '<div><h2>' +
          k.esc(d.displayName) +
          '</h2><div class="sub">' +
          k.esc(d.username ? '@' + d.username : 'No username yet') +
          '</div></div></div>',
      ),
      k.section(
        'Preferences',
        k.card(
          k.kv([
            ['Currency', k.esc(d.defaultCurrency || '—')],
            ['Timezone', k.esc(d.timezone || '—')],
            d.accent ? ['Accent', k.esc(d.accent)] : null,
          ]),
        ),
      ),
      k.section(
        'Defaults for new transactions',
        k.card(
          k.kv([
            ['Account', k.esc(d.defaultAccountName || (d.defaultAccountId ? 'Set' : 'Not set'))],
            [
              'Expense category',
              k.esc(
                d.defaultExpenseCategoryName || (d.defaultExpenseCategoryId ? 'Set' : 'Not set'),
              ),
            ],
            [
              'Income category',
              k.esc(d.defaultIncomeCategoryName || (d.defaultIncomeCategoryId ? 'Set' : 'Not set')),
            ],
          ]),
        ),
      ),
    );
  },
});

type Privacy = {
  showOnline?: boolean;
  showLastSeen?: boolean;
  discoverable?: boolean;
  readReceipts?: boolean;
  allowFriendRequests?: boolean;
  shareActivity?: boolean;
};

export const privacy = defineWidget<Privacy>({
  domain: 'settings',
  name: 'privacy',
  title: 'Privacy',
  description:
    'Who can find you and see your status: discoverability, online status, last seen and read receipts.',
  examples: [
    {
      discoverable: true,
      showOnline: true,
      showLastSeen: false,
      readReceipts: true,
      allowFriendRequests: true,
      shareActivity: false,
    },
  ],
  empty: {},
  render: (d, k) => {
    const rows: Array<[string, boolean | undefined, string]> = [
      ['Discoverable by username', d.discoverable, 'People can find you in search'],
      ['Friend requests', d.allowFriendRequests, 'Anyone can send you a request'],
      ['Online status', d.showOnline, 'Friends see when you are active'],
      ['Last seen', d.showLastSeen, 'Friends see when you were last active'],
      ['Read receipts', d.readReceipts, 'Others see when you read messages'],
      ['Share activity with groups', d.shareActivity, 'Group members see your recent activity'],
    ];
    const known = rows.filter((r) => r[1] !== undefined);
    if (!known.length)
      return k.page(
        k.header('Settings', 'Privacy'),
        k.empty('Default privacy', 'You have not changed any privacy settings.', 'eye'),
      );
    return k.page(
      k.header('Settings', 'Privacy'),
      k.list(known.map((r) => k.toggle(!!r[1], r[0], r[2]))),
    );
  },
});

type Connected = {
  items: Array<{
    client: string;
    scopes: string[];
    connectedAt: number;
    lastUsedAt?: number;
    calls?: number;
  }>;
};

export const connectedApps = defineWidget<Connected>({
  domain: 'settings',
  name: 'connectedApps',
  title: 'Connected AI apps',
  description: 'AI clients connected to FinApp over MCP, with permissions and recent use.',
  examples: [
    {
      items: [
        {
          client: 'Claude',
          scopes: ['read', 'write:finance', 'write:groups'],
          connectedAt: daysAgo(40),
          lastUsedAt: daysAgo(0),
          calls: 214,
        },
        {
          client: 'ChatGPT',
          scopes: ['read'],
          connectedAt: daysAgo(12),
          lastUsedAt: daysAgo(3),
          calls: 31,
        },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Settings', 'Connected apps'),
        k.empty(
          'No AI apps connected',
          'Connect Claude or ChatGPT to FinApp from Settings → AI.',
          'link',
        ),
      );
    return k.page(
      k.header('Settings', 'Connected AI apps'),
      k.list(
        items.map((a) =>
          k.row({
            lead: k.tile(k.icon('spark', 16), 'accent'),
            title: a.client,
            sub:
              'Connected ' +
              k.date(a.connectedAt, 'day') +
              (a.lastUsedAt ? ' · used ' + k.ago(a.lastUsedAt) : ''),
            html:
              '<div class="chips" style="margin-top:6px">' +
              a.scopes.map((s) => k.pill(s, s === 'read' ? null : 'warn')).join('') +
              '</div>',
            value: a.calls !== undefined ? String(a.calls) : '',
            valueSub: a.calls !== undefined ? 'calls' : '',
          }),
        ),
      ),
    );
  },
});

type Export = {
  lastExportAt?: number;
  format?: string;
  rows?: number;
  sizeKb?: number;
  includes: string[];
};

export const dataExport = defineWidget<Export>({
  domain: 'settings',
  name: 'dataExport',
  title: 'Data export',
  description: 'What a FinApp export contains and when you last downloaded one.',
  examples: [
    {
      lastExportAt: daysAgo(21),
      format: 'ZIP (CSV + JSON)',
      rows: 4182,
      sizeKb: 812,
      includes: [
        'Transactions',
        'Accounts',
        'Categories & limits',
        'Goals',
        'Recurring rules',
        'Groups & settlements',
      ],
    },
  ],
  empty: { includes: [] },
  render: (d, k) => {
    if (!k.arr(d.includes).length)
      return k.page(
        k.header('Settings', 'Export'),
        k.empty('No exports yet', 'Export everything from Settings → Data.', 'download'),
      );
    return k.page(
      k.header('Settings', 'Data export'),
      k.card(
        k.kv([
          ['Last export', k.esc(d.lastExportAt ? k.date(d.lastExportAt) : 'Never')],
          d.format ? ['Format', k.esc(d.format)] : null,
          d.rows ? ['Rows', k.esc(k.number(d.rows))] : null,
          d.sizeKb ? ['Size', k.esc(d.sizeKb + ' KB')] : null,
        ]),
      ),
      k.section(
        'Includes',
        '<div class="chips">' + d.includes.map((i) => k.pill(i)).join('') + '</div>',
      ),
    );
  },
});

type Appearance = {
  theme: 'system' | 'light' | 'dark';
  accent: string;
  currencyFormat: string;
  weekStartsOn: string;
  language: string;
  haptics?: boolean;
  sounds?: boolean;
};

export const appearance = defineWidget<Appearance>({
  domain: 'settings',
  name: 'appearance',
  title: 'App preferences',
  description: 'Theme, accent, number format, week start, language, haptics and sounds.',
  examples: [
    {
      theme: 'dark',
      accent: 'Volt',
      currencyFormat: '₹1,23,456.00',
      weekStartsOn: 'Monday',
      language: 'English',
      haptics: true,
      sounds: false,
    },
  ],
  empty: {
    theme: 'system',
    accent: '',
    currencyFormat: '',
    weekStartsOn: 'Monday',
    language: 'English',
  },
  render: (d, k) =>
    !d.accent
      ? k.page(
          k.header('Settings', 'App preferences'),
          k.empty(
            'Default preferences',
            'Theme follows your device; nothing customised yet.',
            'gear',
          ),
        )
      : k.page(
          k.header('Settings', 'App preferences'),
          k.card(
            k.kv([
              ['Theme', k.esc(d.theme)],
              [
                'Accent',
                '<span style="display:inline-flex;gap:6px;align-items:center"><i style="width:12px;height:12px;border-radius:50%;background:var(--volt);display:inline-block"></i>' +
                  k.esc(d.accent) +
                  '</span>',
              ],
              d.currencyFormat ? ['Numbers', k.esc(d.currencyFormat)] : null,
              ['Week starts', k.esc(d.weekStartsOn)],
              ['Language', k.esc(d.language)],
            ]),
          ),
          d.haptics !== undefined || d.sounds !== undefined
            ? k.list(
                [
                  d.haptics !== undefined ? k.toggle(d.haptics, 'Haptics') : '',
                  d.sounds !== undefined ? k.toggle(d.sounds, 'Sounds') : '',
                ].filter(Boolean),
              )
            : '',
        ),
});

type Defaults = { currency: string; items: Array<{ label: string; value: string; hint?: string }> };

export const defaults = defineWidget<Defaults>({
  domain: 'settings',
  name: 'defaults',
  title: 'Defaults',
  description:
    'Defaults applied when you add things: account, categories, split method, reminders and Trash retention.',
  examples: [
    {
      currency: CUR,
      items: [
        { label: 'Default account', value: 'HDFC Savings' },
        { label: 'Expense category', value: 'Food & dining' },
        { label: 'Split method', value: 'Equally', hint: 'For new group expenses' },
        { label: 'Payment reminders', value: 'After 7 days' },
        { label: 'Trash retention', value: '30 days' },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Settings', 'Defaults'),
        k.empty('Using FinApp defaults', undefined, 'gear'),
      );
    return k.page(
      k.header('Settings', 'Defaults'),
      k.list(items.map((i) => k.row({ title: i.label, sub: i.hint, value: i.value }))),
    );
  },
});

// ---------- Security ----------

type SecurityOverview = {
  score: number;
  checks: Array<{ label: string; done: boolean; sub?: string }>;
  lastSignInAt?: number;
  lastSignInPlace?: string;
};

export const securityOverview = defineWidget<SecurityOverview>({
  domain: 'security',
  name: 'overview',
  title: 'Security',
  description:
    'Account security at a glance: score, two-factor, app lock, recovery and last sign-in.',
  examples: [
    {
      score: 0.8,
      lastSignInAt: daysAgo(0, 8),
      lastSignInPlace: 'Bengaluru · Chrome on Windows',
      checks: [
        { label: 'Two-factor authentication', done: true, sub: 'Authenticator app' },
        { label: 'App lock', done: true, sub: 'Locks after 5 minutes away' },
        { label: 'Recovery codes saved', done: true },
        { label: 'Passkey', done: false, sub: 'Sign in without a password' },
        { label: 'Review connected apps', done: true },
      ],
    },
  ],
  empty: { score: 0, checks: [] },
  render: (d, k) => {
    const checks = k.arr(d.checks);
    if (!checks.length)
      return k.page(
        k.header('Security', 'Overview'),
        k.empty('Security status unavailable', undefined, 'shield'),
      );
    return k.page(
      k.header('Security', 'Overview'),
      k.card(
        '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
          k.ring({
            value: d.score,
            size: 104,
            tone: d.score >= 0.8 ? 'income' : 'warn',
            center: checks.filter((c) => c.done).length + '/' + checks.length,
            sub: 'done',
          }) +
          '<div class="grow">' +
          k.steps(checks) +
          '</div></div>',
      ),
      d.lastSignInAt
        ? k.note(
            'Last sign-in ' +
              k.ago(d.lastSignInAt) +
              (d.lastSignInPlace ? ' · ' + d.lastSignInPlace : ''),
          )
        : '',
    );
  },
});

type Devices = {
  items: Array<{
    name: string;
    kind: 'phone' | 'laptop' | 'tablet' | 'browser';
    place?: string;
    lastActiveAt: number;
    current?: boolean;
  }>;
};

export const devices = defineWidget<Devices>({
  domain: 'security',
  name: 'devices',
  title: 'Signed-in devices',
  description:
    'Devices and browsers signed in to your account, with where and when they were last active.',
  examples: [
    {
      items: [
        {
          name: 'Chrome on Windows',
          kind: 'browser',
          place: 'Bengaluru',
          lastActiveAt: daysAgo(0, 10),
          current: true,
        },
        { name: 'Pixel 9', kind: 'phone', place: 'Bengaluru', lastActiveAt: daysAgo(0, 9) },
        { name: 'iPad Air', kind: 'tablet', place: 'Mysuru', lastActiveAt: daysAgo(18) },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(k.header('Security', 'Devices'), k.empty('No devices', undefined, 'device'));
    return k.page(
      k.header('Security', k.plural(items.length, 'device')),
      k.list(
        items.map((x) =>
          k.row({
            lead: k.tile(
              k.icon(
                x.kind === 'phone' || x.kind === 'tablet'
                  ? 'device'
                  : x.kind === 'laptop'
                    ? 'laptop'
                    : 'globe',
                16,
              ),
              x.current ? 'income' : 'neutral',
            ),
            title: x.name,
            badge: x.current ? k.pill('This device', 'income') : '',
            sub: [x.place, 'active ' + k.ago(x.lastActiveAt)].filter(Boolean).join(' · '),
            muted: k.daysUntil(x.lastActiveAt) < -14,
          }),
        ),
      ),
    );
  },
});

type Logins = {
  matrix: number[][];
  events: Array<{ at: number; place: string; method: string; ok: boolean }>;
};
const loginRows = [0, 1, 2, 3, 4, 5, 6].map((r) =>
  Array.from({ length: 24 }, (_, h) =>
    h >= 8 && h <= 23 ? ((r * 7 + h * 3) % 5 === 0 ? 2 : (r + h) % 4 === 0 ? 1 : 0) : 0,
  ),
);

export const loginActivity = defineWidget<Logins>({
  domain: 'security',
  name: 'loginActivity',
  title: 'Sign-in activity',
  description:
    'When you sign in (weekday × hour heatmap) and the latest sign-in attempts, including failures.',
  examples: [
    {
      matrix: loginRows,
      events: [
        { at: daysAgo(0, 8), place: 'Bengaluru', method: 'Passkey', ok: true },
        { at: daysAgo(2, 3), place: 'Unknown (VPN)', method: 'Password', ok: false },
        { at: daysAgo(3, 21), place: 'Bengaluru', method: 'Password + 2FA', ok: true },
      ],
    },
  ],
  empty: { matrix: [], events: [] },
  render: (d, k) => {
    if (!k.arr(d.events).length && !k.arr(d.matrix).length)
      return k.page(
        k.header('Security', 'Sign-ins'),
        k.empty('No sign-in history', undefined, 'lock'),
      );
    const failed = k.arr(d.events).filter((e) => !e.ok).length;
    return k.page(
      k.header(
        'Security',
        'Sign-in activity',
        failed ? k.pill(k.plural(failed, 'failed attempt'), 'expense') : '',
      ),
      k.arr(d.matrix).length
        ? k.card(
            k.heatmap({
              rows: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              cols: Array.from({ length: 24 }, (_, h) => String(h)),
              values: d.matrix,
              format: 'number',
              colStride: 3,
              tone: 6,
              title: 'Sign-ins by weekday and hour',
            }),
          )
        : '',
      k.list(
        k.arr(d.events).map((e) =>
          k.row({
            lead: k.tile(k.icon(e.ok ? 'check' : 'alert', 16), e.ok ? 'income' : 'expense'),
            title: e.ok ? 'Signed in' : 'Failed sign-in',
            sub: e.place + ' · ' + e.method + ' · ' + k.date(e.at, 'datetime'),
          }),
        ),
      ),
    );
  },
});

/** Shape close to `finapp.personal.security.get` (securityPreferences). */
type Lock = {
  appLockEnabled?: boolean;
  lockAfterMinutes?: number;
  biometrics?: boolean;
  mfaEnabled?: boolean;
  mfaMethod?: string;
  hideBalances?: boolean;
};

export const lockSettings = defineWidget<Lock>({
  domain: 'security',
  name: 'lock',
  title: 'App lock & 2FA',
  description: 'App lock timing, biometrics, two-factor method and balance hiding.',
  examples: [
    {
      appLockEnabled: true,
      lockAfterMinutes: 5,
      biometrics: true,
      mfaEnabled: true,
      mfaMethod: 'Authenticator app',
      hideBalances: false,
    },
  ],
  empty: {},
  render: (d, k) => {
    if (d.appLockEnabled === undefined && d.mfaEnabled === undefined)
      return k.page(
        k.header('Security', 'Lock'),
        k.empty('Security settings unavailable', undefined, 'lock'),
      );
    return k.page(
      k.header('Security', 'App lock & 2FA'),
      k.list(
        [
          k.toggle(
            !!d.appLockEnabled,
            'App lock',
            d.appLockEnabled && d.lockAfterMinutes !== undefined
              ? 'After ' + k.plural(d.lockAfterMinutes, 'minute') + ' away'
              : undefined,
          ),
          d.biometrics !== undefined ? k.toggle(d.biometrics, 'Biometric unlock') : '',
          k.toggle(!!d.mfaEnabled, 'Two-factor authentication', d.mfaMethod),
          d.hideBalances !== undefined ? k.toggle(d.hideBalances, 'Hide balances on open') : '',
        ].filter(Boolean),
      ),
    );
  },
});

type Recovery = {
  codesLeft: number;
  codesTotal: number;
  generatedAt?: number;
  recoveryEmail?: string;
};

export const recovery = defineWidget<Recovery>({
  domain: 'security',
  name: 'recovery',
  title: 'Account recovery',
  description: 'Recovery codes remaining and the recovery email on file.',
  examples: [
    {
      codesLeft: 7,
      codesTotal: 10,
      generatedAt: Date.UTC(2026, 1, 12),
      recoveryEmail: 'n•••@gmail.com',
    },
  ],
  empty: { codesLeft: 0, codesTotal: 0 },
  render: (d, k) => {
    if (!d.codesTotal)
      return k.page(
        k.header('Security', 'Recovery'),
        k.empty(
          'No recovery codes',
          'Generate recovery codes so you can always get back in.',
          'shield',
        ),
      );
    return k.page(
      k.header('Security', 'Recovery'),
      k.card(
        k.meter({
          label: 'Recovery codes left',
          value: d.codesLeft,
          max: d.codesTotal,
          valueText: String(d.codesLeft),
          maxText: String(d.codesTotal),
          tone: d.codesLeft <= 2 ? 'expense' : d.codesLeft <= 4 ? 'warn' : 'income',
        }) +
          k.kv([
            d.generatedAt ? ['Generated', k.esc(k.date(d.generatedAt))] : null,
            d.recoveryEmail ? ['Recovery email', k.esc(d.recoveryEmail)] : null,
          ]),
      ),
    );
  },
});

type Alerts = {
  items: Array<{
    title: string;
    at: number;
    severity: 'info' | 'warn' | 'critical';
    detail?: string;
  }>;
};

export const securityAlerts = defineWidget<Alerts>({
  domain: 'security',
  name: 'alerts',
  title: 'Security alerts',
  description:
    'Recent security events: new devices, password changes, failed sign-ins and new app connections.',
  examples: [
    {
      items: [
        {
          title: 'Failed sign-in from a new location',
          at: daysAgo(2, 3),
          severity: 'critical',
          detail: 'Unknown (VPN) · blocked by 2FA',
        },
        { title: 'ChatGPT connected with read access', at: daysAgo(12), severity: 'info' },
        { title: 'New device: Pixel 9', at: daysAgo(30), severity: 'warn', detail: 'Bengaluru' },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Security', 'Alerts'),
        k.empty('No security alerts', 'Nothing unusual on your account.', 'shield'),
      );
    const tone: Record<string, 'info' | 'warn' | 'expense'> = {
      info: 'info',
      warn: 'warn',
      critical: 'expense',
    };
    return k.page(
      k.header('Security', 'Alerts'),
      k.card(
        k.timeline(
          items.map((a) => ({
            title: a.title,
            sub: [a.detail, k.ago(a.at)].filter(Boolean).join(' · '),
            tone: tone[a.severity],
            icon: a.severity === 'info' ? 'info' : 'alert',
          })),
        ),
      ),
    );
  },
});

export const insightWidgets = [
  feed,
  healthScore,
  monthlyReport,
  vsTypical,
  streaks,
  savingsOpportunities,
  achievements,
  checkup,
];
export const finaiWidgets = [answer, plan, whatIf, actionItems, briefing];
export const settingsWidgets = [
  profileSettings,
  privacy,
  connectedApps,
  dataExport,
  appearance,
  defaults,
];
export const securityWidgets = [
  securityOverview,
  devices,
  loginActivity,
  lockSettings,
  recovery,
  securityAlerts,
];
