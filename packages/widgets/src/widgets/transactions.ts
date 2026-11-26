import { CATEGORIES, CUR, MERCHANTS, daysAgo, rng, series } from '../sample';
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
  categoryName?: string;
  categoryIcon?: string;
  accountName?: string;
  status?: string;
  note?: string;
  tags?: string[];
  items?: Array<{ title: string; amountMinor: Minor; quantity?: number }>;
};

const amounts = series(24, 90_000, 0.9, 61);
const SAMPLE_TX: Tx[] = Array.from({ length: 24 }, (_, i) => {
  const c = CATEGORIES[i % 8]!;
  return {
    id: 'tx' + i,
    title: MERCHANTS[i % MERCHANTS.length]!,
    type: i === 5 || i === 17 ? 'income' : 'expense',
    amountMinor: i === 5 || i === 17 ? 1_250_000 : amounts[i]!,
    currency: CUR,
    merchant: MERCHANTS[i % MERCHANTS.length]!,
    occurredAt: daysAgo(Math.floor(i / 2), 9 + (i % 12)),
    categoryName: i === 5 || i === 17 ? 'Freelance' : c.name,
    categoryIcon: i === 5 || i === 17 ? '💼' : c.icon,
    accountName: i % 3 ? 'HDFC Savings' : 'HDFC Regalia',
  };
});

type Search = {
  query?: string;
  filters?: string[];
  items?: Tx[];
  totalCount?: number;
  sumMinor?: Minor;
  currency?: string;
  isDone?: boolean;
};

export const search = defineWidget<Search>({
  domain: 'transactions',
  name: 'search',
  title: 'Transaction search',
  description:
    'Search results with the query and filters as chips, match count and total, and the matching rows.',
  examples: [
    {
      query: 'swiggy',
      filters: ['Last 90 days', 'Food & dining'],
      items: SAMPLE_TX.filter((t) => t.title === 'Swiggy' || t.title === 'Zomato'),
      totalCount: 14,
      sumMinor: 682_400,
      currency: CUR,
      isDone: false,
    },
  ],
  empty: {
    query: 'netflix',
    filters: ['This month'],
    items: [],
    totalCount: 0,
    currency: CUR,
    isDone: true,
  },
  render: (d, k) => {
    const items = k.arr(d.items);
    const chips =
      (d.query ? k.pill('“' + d.query + '”', 'accent') : '') +
      k
        .arr(d.filters)
        .map((f) => k.pill(f))
        .join('');
    return k.page(
      k.header(
        'Search',
        k.plural(d.totalCount !== undefined ? d.totalCount : items.length, 'match', 'matches'),
        d.sumMinor !== undefined && items.length ? k.pill(k.money(d.sumMinor, d.currency)) : '',
      ),
      chips ? '<div class="chips">' + chips + '</div>' : '',
      k.txList(
        items,
        'No matches',
        'Nothing matches ' +
          (d.query ? '“' + d.query + '”' : 'these filters') +
          '. Try a different word or a wider date range.',
      ),
      d.isDone === false
        ? k.note('Showing the first ' + items.length + '. Ask for more to continue.')
        : '',
    );
  },
});

type Detail = Tx | null;

export const detail = defineWidget<Detail>({
  domain: 'transactions',
  name: 'detail',
  title: 'Transaction',
  description: 'One personal transaction with category, account, note, tags and line items.',
  examples: [
    {
      ...SAMPLE_TX[1]!,
      note: 'Weekly groceries',
      tags: ['home', 'monthly'],
      items: [
        { title: 'Basmati rice 5kg', amountMinor: 64_000 },
        { title: 'Olive oil', amountMinor: 89_000 },
        { title: 'Eggs (30)', amountMinor: 21_000, quantity: 1 },
      ],
    },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.title)
      return k.page(
        k.empty(
          'Transaction not found',
          'It may have been deleted. Deleted items stay in Trash for a while.',
          'receipt',
        ),
      );
    const sign = k.txSign(d.type);
    return k.page(
      k.header(
        d.type === 'income' ? 'Income' : d.type === 'transfer' ? 'Transfer' : 'Expense',
        d.title,
        d.status && d.status !== 'posted' ? k.pill(d.status, 'warn') : '',
      ),
      k.hero({
        label: k.date(d.occurredAt, 'long'),
        value: k.txAmount(d),
        tone: sign.tone,
        aside: k.glyph(d.title, d.categoryIcon),
      }),
      k.card(
        k.kv([
          d.merchant ? ['Merchant', k.esc(d.merchant)] : null,
          d.categoryName
            ? [
                'Category',
                k.esc(k.join([d.categoryIcon ? d.categoryIcon + ' ' : '', d.categoryName])),
              ]
            : null,
          d.accountName ? ['Account', k.esc(d.accountName)] : null,
          ['Time', k.esc(k.date(d.occurredAt, 'time'))],
          k.arr(d.tags).length
            ? [
                'Tags',
                k
                  .arr(d.tags)
                  .map((t) => k.pill('#' + t))
                  .join(' '),
              ]
            : null,
        ]),
      ),
      d.note ? k.section('Note', k.card(k.esc(d.note))) : '',
      k.arr(d.items).length ? k.section('Line items', k.lineItems(d.items, d.currency)) : '',
    );
  },
});

type Receipt = {
  merchant: string;
  address?: string;
  occurredAt: number;
  currency: string;
  items: Array<{ title: string; quantity?: number; amountMinor: Minor }>;
  taxMinor?: Minor;
  tipMinor?: Minor;
  discountMinor?: Minor;
  paymentMethod?: string;
};

export const receipt = defineWidget<Receipt>({
  domain: 'transactions',
  name: 'receipt',
  title: 'Receipt',
  description: 'A scanned or itemized receipt: line items, subtotal, tax, tip, discount and total.',
  examples: [
    {
      merchant: 'Blue Tokai Coffee',
      address: 'Indiranagar, Bengaluru',
      occurredAt: daysAgo(0, 9),
      currency: CUR,
      items: [
        { title: 'Flat white', quantity: 2, amountMinor: 52_000 },
        { title: 'Almond croissant', amountMinor: 24_000 },
        { title: 'Cold brew bottle', amountMinor: 32_000 },
      ],
      taxMinor: 5_400,
      tipMinor: 5_000,
      discountMinor: 10_000,
      paymentMethod: 'HDFC Regalia •••• 0094',
    },
  ],
  empty: { merchant: '', occurredAt: 0, currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.empty(
          'No receipt attached',
          'Scan or attach a receipt to see its line items.',
          'receipt',
        ),
      );
    const subtotal = k.sum(items.map((i) => i.amountMinor));
    const total = subtotal + k.num(d.taxMinor) + k.num(d.tipMinor) - k.num(d.discountMinor);
    const totals = [{ label: 'Subtotal', amount: k.money(subtotal, d.currency) }];
    if (d.discountMinor)
      totals.push({ label: 'Discount', amount: '−' + k.money(d.discountMinor, d.currency) });
    if (d.taxMinor) totals.push({ label: 'Tax', amount: k.money(d.taxMinor, d.currency) });
    if (d.tipMinor) totals.push({ label: 'Tip', amount: k.money(d.tipMinor, d.currency) });
    return k.page(
      k.receipt({
        merchant: d.merchant || 'Receipt',
        sub: [d.address, k.date(d.occurredAt, 'datetime')].filter(Boolean).join(' · '),
        lines: items.map((i) => ({
          title: i.title,
          qty: i.quantity,
          amount: k.money(i.amountMinor, d.currency),
        })),
        totals: totals.concat([
          { label: 'Total', amount: k.money(total, d.currency), strong: true } as never,
        ]),
        footer: d.paymentMethod ? 'Paid with ' + d.paymentMethod : undefined,
      }),
    );
  },
});

type Items = {
  title: string;
  currency: string;
  items: Array<{
    title: string;
    quantity?: number;
    unitMinor?: Minor;
    amountMinor: Minor;
    categoryName?: string;
  }>;
};

export const lineItemTable = defineWidget<Items>({
  domain: 'transactions',
  name: 'lineItems',
  title: 'Line items',
  description:
    'The items inside one purchase as a table with quantity, unit price and total, plus the priciest item.',
  examples: [
    {
      title: 'BigBasket order',
      currency: CUR,
      items: [
        {
          title: 'Coffee beans 250g',
          quantity: 2,
          unitMinor: 48_000,
          amountMinor: 96_000,
          categoryName: 'Groceries',
        },
        {
          title: 'Oat milk 1L',
          quantity: 3,
          unitMinor: 18_000,
          amountMinor: 54_000,
          categoryName: 'Groceries',
        },
        {
          title: 'Bananas',
          quantity: 1,
          unitMinor: 6_000,
          amountMinor: 6_000,
          categoryName: 'Groceries',
        },
        {
          title: 'Dish soap',
          quantity: 1,
          unitMinor: 21_000,
          amountMinor: 21_000,
          categoryName: 'Household',
        },
      ],
    },
  ],
  empty: { title: 'Purchase', currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Line items', d.title),
        k.empty('No line items', 'This transaction was recorded as a single amount.', 'receipt'),
      );
    const top = items.slice().sort((a, b) => k.num(b.amountMinor) - k.num(a.amountMinor))[0]!;
    return k.page(
      k.header('Line items', d.title, k.pill(k.plural(items.length, 'item'))),
      k.table(
        [
          { label: 'Item' },
          { label: 'Qty', align: 'right' },
          { label: 'Unit', align: 'right' },
          { label: 'Total', align: 'right' },
        ],
        items
          .map((i) => [
            k.esc(i.title) +
              (i.categoryName ? '<div class="sub">' + k.esc(i.categoryName) + '</div>' : ''),
            String(i.quantity || 1),
            k.esc(i.unitMinor !== undefined ? k.money(i.unitMinor, d.currency) : ''),
            '<span class="amount">' + k.esc(k.money(i.amountMinor, d.currency)) + '</span>',
          ])
          .concat([
            [
              '<strong>Total</strong>',
              '',
              '',
              '<span class="amount">' +
                k.esc(k.money(k.sum(items.map((i) => i.amountMinor)), d.currency)) +
                '</span>',
            ],
          ]),
        'Line items',
      ),
      k.note('Priciest item: ' + top.title + ' (' + k.money(top.amountMinor, d.currency) + ').'),
    );
  },
});

type Ranked = { currency: string; period: string; items: Tx[] };

export const largest = defineWidget<Ranked>({
  domain: 'transactions',
  name: 'largest',
  title: 'Largest transactions',
  description: 'The biggest expenses in a period as ranked bars with merchant and date.',
  examples: [
    {
      currency: CUR,
      period: 'November',
      items: SAMPLE_TX.filter((t) => t.type === 'expense').slice(0, 10),
    },
  ],
  empty: { currency: CUR, period: 'This month', items: [] },
  render: (d, k) => {
    const items = k
      .arr(d.items)
      .slice()
      .sort((a, b) => k.num(b.amountMinor) - k.num(a.amountMinor))
      .slice(0, 8);
    if (!items.length)
      return k.page(
        k.header('Largest', d.period),
        k.empty('No expenses', 'Nothing spent in this period yet.', 'receipt'),
      );
    return k.page(
      k.header('Largest transactions', d.period),
      k.card(
        k.barList({
          items: items.map((t) => ({
            label: t.title,
            value: k.num(t.amountMinor),
            sub: [t.categoryName, k.date(t.occurredAt, 'day')].filter(Boolean).join(' · '),
            tone: 'expense',
          })),
          currency: d.currency,
          limit: 8,
          title: 'Largest transactions',
        }),
      ),
    );
  },
});

export const recent = defineWidget<{ items?: Tx[] }>({
  domain: 'transactions',
  name: 'recent',
  title: 'Recent activity',
  description: 'The latest transactions in a compact list.',
  examples: [{ items: SAMPLE_TX.slice(0, 6) }],
  empty: { items: [] },
  render: (d, k) =>
    k.page(
      k.header('Recent', 'Latest activity'),
      k.txList(
        k.arr(d.items).slice(0, 8),
        'No recent activity',
        'New transactions will show up here.',
      ),
    ),
});

export const byDay = defineWidget<{ currency: string; items?: Tx[] }>({
  domain: 'transactions',
  name: 'byDay',
  title: 'Transactions by day',
  description: 'Transactions grouped under day headings with each day’s spending total.',
  examples: [{ currency: CUR, items: SAMPLE_TX.slice(0, 12) }],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Activity', 'By day'),
        k.empty('No transactions', undefined, 'calendar'),
      );
    const days: Array<{ label: string; items: typeof items }> = [];
    items.forEach((t) => {
      const label = k.date(t.occurredAt, 'weekday');
      const last = days[days.length - 1];
      if (last && last.label === label) last.items.push(t);
      else days.push({ label, items: [t] });
    });
    return k.page(
      k.header('Activity', 'By day'),
      days
        .map((day) =>
          k.section(
            day.label,
            k.txList(day.items),
            k.esc(
              'Spent ' +
                k.money(
                  k.sum(day.items.filter((t) => t.type === 'expense').map((t) => t.amountMinor)),
                  d.currency,
                ),
            ),
          ),
        )
        .join(''),
    );
  },
});

type Cal = {
  currency: string;
  year: number;
  month: number;
  days: Record<string, number>;
  today?: number;
};
const calNext = rng(71);
const calDays: Record<string, number> = {};
for (let day = 1; day <= 26; day++)
  if (calNext() > 0.15) calDays[String(day)] = Math.round(calNext() * 400_000);

export const spendCalendar = defineWidget<Cal>({
  domain: 'transactions',
  name: 'calendar',
  title: 'Spending calendar',
  description:
    'A month calendar shaded by how much you spent each day, with the busiest day called out.',
  examples: [{ currency: CUR, year: 2026, month: 10, days: calDays, today: 26 }],
  empty: { currency: CUR, year: 2026, month: 10, days: {} },
  render: (d, k) => {
    const keys = Object.keys(d.days || {});
    const title = k.date(Date.UTC(d.year, d.month, 15), 'month');
    if (!keys.length)
      return k.page(
        k.header('Calendar', title),
        k.empty(
          'No spending this month',
          'Days you spend money on will be shaded here.',
          'calendar',
        ),
      );
    const top = keys.slice().sort((a, b) => d.days[b]! - d.days[a]!)[0]!;
    const total = k.sum(keys.map((key) => d.days[key]));
    return k.page(
      k.header('Calendar', title, k.pill(k.money(total, d.currency))),
      k.card(
        k.calendar({
          year: d.year,
          month: d.month,
          values: d.days,
          currency: d.currency,
          today: d.today,
        }),
      ),
      k.note(
        'Busiest day: ' +
          top +
          ' ' +
          k.date(Date.UTC(d.year, d.month, 15), 'month').split(' ')[0] +
          ' (' +
          k.money(d.days[top], d.currency) +
          '). ' +
          Object.keys(d.days).length +
          ' days with spending.',
      ),
    );
  },
});

export const uncategorized = defineWidget<{ items?: Tx[]; suggestions?: Record<string, string> }>({
  domain: 'transactions',
  name: 'uncategorized',
  title: 'Needs a category',
  description: 'Transactions without a category, with a suggested category for each.',
  examples: [
    {
      items: SAMPLE_TX.slice(6, 10).map((t) => ({
        ...t,
        categoryName: undefined,
        categoryIcon: undefined,
      })),
      suggestions: { tx6: 'Food & dining', tx7: 'Groceries', tx8: 'Transport', tx9: 'Shopping' },
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Review', 'Needs a category'),
        k.empty(
          'All categorized',
          'Every transaction has a category. Analytics are complete.',
          'check',
        ),
      );
    const s = d.suggestions || {};
    return k.page(
      k.header('Review', 'Needs a category', k.pill(String(items.length), 'warn')),
      k.list(
        items.map((t) =>
          k.row({
            lead: k.glyph(t.title, '?', 'warn'),
            title: t.title,
            sub: k.date(t.occurredAt, 'day') + (s[t.id] ? ' · Suggested: ' + s[t.id] : ''),
            value: k.txAmount(t),
            valueTone: k.txSign(t.type).tone,
          }),
        ),
      ),
      k.actions(
        k.ask(
          'Categorize these',
          'Categorize my uncategorized transactions using the suggestions.',
        ),
      ),
    );
  },
});

type Dupes = { currency: string; pairs: Array<{ a: Tx; b: Tx; reason: string }> };

export const duplicates = defineWidget<Dupes>({
  domain: 'transactions',
  name: 'duplicates',
  title: 'Possible duplicates',
  description:
    'Pairs of transactions that look like the same purchase recorded twice, with why they match.',
  examples: [
    {
      currency: CUR,
      pairs: [
        {
          a: SAMPLE_TX[2]!,
          b: {
            ...SAMPLE_TX[2]!,
            id: 'dup1',
            occurredAt: SAMPLE_TX[2]!.occurredAt + 120_000,
            accountName: 'HDFC Savings',
          },
          reason: 'Same amount and merchant, 2 minutes apart',
        },
        {
          a: SAMPLE_TX[9]!,
          b: { ...SAMPLE_TX[9]!, id: 'dup2', occurredAt: SAMPLE_TX[9]!.occurredAt + 86_400_000 },
          reason: 'Same amount and merchant, next day',
        },
      ],
    },
  ],
  empty: { currency: CUR, pairs: [] },
  render: (d, k) => {
    const pairs = k.arr(d.pairs);
    if (!pairs.length)
      return k.page(
        k.header('Review', 'Possible duplicates'),
        k.empty('No duplicates found', 'Nothing looks like it was recorded twice.', 'check'),
      );
    return k.page(
      k.header('Review', 'Possible duplicates', k.pill(k.plural(pairs.length, 'pair'), 'warn')),
      pairs
        .map((p) =>
          k.card(
            '<p class="sub" style="margin:0 0 4px">' +
              k.icon('alert', 13) +
              ' ' +
              k.esc(p.reason) +
              '</p>' +
              k.txRow(p.a, { showAccount: true }) +
              k.txRow(p.b, { showAccount: true }),
            { tone: 'warn' },
          ),
        )
        .join(''),
    );
  },
});

export const refunds = defineWidget<{
  currency: string;
  items: Array<Tx & { originalTitle?: string; expectedAt?: number; received?: boolean }>;
}>({
  domain: 'transactions',
  name: 'refunds',
  title: 'Refunds',
  description: 'Refunds received and still expected, with the purchase each one belongs to.',
  examples: [
    {
      currency: CUR,
      items: [
        {
          id: 'r1',
          title: 'Amazon refund',
          type: 'refund',
          amountMinor: 549_900,
          currency: CUR,
          occurredAt: daysAgo(4),
          originalTitle: 'Sony headphones',
          received: true,
        },
        {
          id: 'r2',
          title: 'IndiGo cancellation',
          type: 'refund',
          amountMinor: 812_000,
          currency: CUR,
          occurredAt: daysAgo(10),
          originalTitle: 'BLR → GOI flight',
          expectedAt: daysAgo(-5),
          received: false,
        },
        {
          id: 'r3',
          title: 'Decathlon return',
          type: 'refund',
          amountMinor: 179_900,
          currency: CUR,
          occurredAt: daysAgo(18),
          originalTitle: 'Running shoes',
          received: true,
        },
      ],
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Refunds', 'Money coming back'),
        k.empty('No refunds', 'Refunds you record or expect will be tracked here.', 'restore'),
      );
    const pending = items.filter((r) => r.received === false);
    return k.page(
      k.header('Refunds', 'Money coming back'),
      k.stats([
        {
          label: 'Received',
          value: k.money(
            k.sum(items.filter((r) => r.received !== false).map((r) => r.amountMinor)),
            d.currency,
          ),
          tone: 'income',
        },
        {
          label: 'Still expected',
          value: k.money(k.sum(pending.map((r) => r.amountMinor)), d.currency),
          tone: pending.length ? 'warn' : null,
        },
      ]),
      k.list(
        items.map((r) =>
          k.row({
            lead: k.tile(k.icon('restore', 16), r.received === false ? 'warn' : 'income'),
            title: r.title,
            sub: [
              r.originalTitle ? 'For ' + r.originalTitle : '',
              r.received === false
                ? r.expectedAt
                  ? 'Expected ' + k.date(r.expectedAt, 'day')
                  : 'Pending'
                : 'Received ' + k.date(r.occurredAt, 'day'),
            ]
              .filter(Boolean)
              .join(' · '),
            value: '+' + k.money(r.amountMinor, d.currency),
            valueTone: r.received === false ? 'muted' : 'income',
            badge: r.received === false ? k.pill('Pending', 'warn') : '',
          }),
        ),
      ),
    );
  },
});

export const pending = defineWidget<{ currency: string; items?: Tx[] }>({
  domain: 'transactions',
  name: 'pending',
  title: 'Pending transactions',
  description:
    'Transactions not yet posted (scheduled, awaiting confirmation or syncing) and their total.',
  examples: [
    {
      currency: CUR,
      items: SAMPLE_TX.slice(0, 3).map((t, i) => ({
        ...t,
        status: i === 0 ? 'scheduled' : i === 1 ? 'pending' : 'syncing',
        occurredAt: daysAgo(-i - 1),
      })),
    },
  ],
  empty: { currency: CUR, items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Pending', 'Not yet posted'),
        k.empty('Nothing pending', 'Everything has posted.', 'check'),
      );
    return k.page(
      k.header(
        'Pending',
        'Not yet posted',
        k.pill(
          k.money(
            k.sum(items.filter((t) => t.type === 'expense').map((t) => t.amountMinor)),
            d.currency,
          ),
          'warn',
        ),
      ),
      k.list(
        items.map((t) =>
          k.row({
            lead: k.tile(k.icon('clock', 16), 'warn'),
            title: t.title,
            sub: [t.status, k.date(t.occurredAt, 'day'), t.accountName].filter(Boolean).join(' · '),
            value: k.txAmount(t),
            valueTone: 'muted',
          }),
        ),
      ),
    );
  },
});

type Saved = {
  action: 'created' | 'updated' | 'deleted';
  transaction: Tx;
  balanceAfterMinor?: Minor;
  restoreUntil?: number;
};

export const saved = defineWidget<Saved | null>({
  domain: 'transactions',
  name: 'saved',
  title: 'Transaction saved',
  description:
    'Confirmation after adding, editing or deleting a transaction, with the account balance after it.',
  examples: [
    { action: 'created', transaction: SAMPLE_TX[0]!, balanceAfterMinor: 15_342_000 },
    { action: 'deleted', transaction: SAMPLE_TX[3]!, restoreUntil: daysAgo(-30) },
  ],
  empty: null,
  render: (d, k) => {
    if (!d || !d.transaction)
      return k.page(k.empty('Nothing was saved', 'No transaction was changed.', 'receipt'));
    const t = d.transaction;
    const verb =
      d.action === 'created' ? 'Added' : d.action === 'updated' ? 'Updated' : 'Moved to Trash';
    return k.page(
      k.notice(
        verb + ': ' + t.title + ' · ' + k.txAmount(t),
        d.action === 'deleted' ? 'warn' : 'income',
        d.action === 'deleted' ? 'trash' : 'check',
      ),
      k.list([k.txRow(t, { showAccount: true })]),
      d.balanceAfterMinor !== undefined
        ? k.note(
            (t.accountName || 'Account') +
              ' balance is now ' +
              k.money(d.balanceAfterMinor, t.currency) +
              '.',
          )
        : '',
      d.restoreUntil
        ? k.note('You can restore it from Trash until ' + k.date(d.restoreUntil) + '.')
        : '',
    );
  },
});

type Tags = { currency: string; tags: Array<{ tag: string; count: number; amountMinor: Minor }> };

export const tags = defineWidget<Tags>({
  domain: 'transactions',
  name: 'tags',
  title: 'Spending by tag',
  description: 'Totals and counts for each tag you use on transactions, ranked.',
  examples: [
    {
      currency: CUR,
      tags: [
        { tag: 'goa-trip', count: 18, amountMinor: 3_820_000 },
        { tag: 'work', count: 12, amountMinor: 1_460_000 },
        { tag: 'home', count: 22, amountMinor: 1_210_000 },
        { tag: 'gifts', count: 5, amountMinor: 640_000 },
        { tag: 'reimbursable', count: 7, amountMinor: 520_000 },
      ],
    },
  ],
  empty: { currency: CUR, tags: [] },
  render: (d, k) => {
    const list = k.arr(d.tags);
    if (!list.length)
      return k.page(
        k.header('Tags', 'Spending by tag'),
        k.empty('No tags yet', 'Add #tags to transactions to group them across categories.', 'tag'),
      );
    return k.page(
      k.header('Tags', 'Spending by tag'),
      k.card(
        k.barList({
          items: list.map((t) => ({
            label: '#' + t.tag,
            value: k.num(t.amountMinor),
            sub: k.plural(t.count, 'transaction'),
          })),
          currency: d.currency,
          title: 'Spending by tag',
        }),
      ),
    );
  },
});

type Compare = {
  currency: string;
  a: {
    label: string;
    totalMinor: Minor;
    count: number;
    categories: Array<{ name: string; amountMinor: Minor }>;
  };
  b: {
    label: string;
    totalMinor: Minor;
    count: number;
    categories: Array<{ name: string; amountMinor: Minor }>;
  };
};

export const comparePeriods = defineWidget<Compare>({
  domain: 'transactions',
  name: 'compare',
  title: 'Compare two periods',
  description: 'Spending in two periods side by side, overall and per category, with the change.',
  examples: [
    {
      currency: CUR,
      a: {
        label: 'October',
        totalMinor: 3_904_000,
        count: 96,
        categories: [
          { name: 'Food & dining', amountMinor: 1_120_000 },
          { name: 'Groceries', amountMinor: 820_000 },
          { name: 'Transport', amountMinor: 410_000 },
          { name: 'Shopping', amountMinor: 980_000 },
        ],
      },
      b: {
        label: 'November',
        totalMinor: 4_218_050,
        count: 104,
        categories: [
          { name: 'Food & dining', amountMinor: 845_000 },
          { name: 'Groceries', amountMinor: 910_000 },
          { name: 'Transport', amountMinor: 436_500 },
          { name: 'Shopping', amountMinor: 1_420_000 },
        ],
      },
    },
  ],
  empty: {
    currency: CUR,
    a: { label: 'Last month', totalMinor: 0, count: 0, categories: [] },
    b: { label: 'This month', totalMinor: 0, count: 0, categories: [] },
  },
  render: (d, k) => {
    if (!k.num(d.a.totalMinor) && !k.num(d.b.totalMinor))
      return k.page(
        k.header('Compare', d.a.label + ' vs ' + d.b.label),
        k.empty('Nothing to compare', 'Neither period has spending yet.', 'swap'),
      );
    const names = k.arr(d.b.categories).map((c) => c.name);
    k.arr(d.a.categories).forEach((c) => names.indexOf(c.name) < 0 && names.push(c.name));
    const val = (list: Array<{ name: string; amountMinor: Minor }>, name: string) =>
      k.num((k.arr(list).filter((c) => c.name === name)[0] || { amountMinor: 0 }).amountMinor);
    const change = k.num(d.a.totalMinor)
      ? (k.num(d.b.totalMinor) - k.num(d.a.totalMinor)) / k.num(d.a.totalMinor)
      : null;
    return k.page(
      k.header('Compare', d.a.label + ' vs ' + d.b.label, k.delta(change, 'down')),
      k.stats([
        {
          label: d.a.label,
          value: k.money(d.a.totalMinor, d.currency),
          sub: k.plural(d.a.count, 'transaction'),
        },
        {
          label: d.b.label,
          value: k.money(d.b.totalMinor, d.currency),
          sub: k.plural(d.b.count, 'transaction'),
          delta: change,
          goodWhen: 'down',
        },
      ]),
      names.length
        ? k.card(
            k.columns({
              labels: names,
              series: [
                {
                  name: d.a.label,
                  values: names.map((n) => val(d.a.categories, n)),
                  tone: 'neutral',
                },
                { name: d.b.label, values: names.map((n) => val(d.b.categories, n)), tone: 0 },
              ],
              currency: d.currency,
              title: 'Spending by category',
            }),
          )
        : '',
    );
  },
});

type Attachments = {
  items: Array<{
    title: string;
    kind: 'receipt' | 'invoice' | 'warranty' | 'photo';
    occurredAt: number;
    transactionTitle: string;
    sizeKb?: number;
  }>;
};

export const attachments = defineWidget<Attachments>({
  domain: 'transactions',
  name: 'attachments',
  title: 'Receipts and attachments',
  description: 'Files attached to transactions — receipts, invoices, warranties — newest first.',
  examples: [
    {
      items: [
        {
          title: 'blue-tokai.jpg',
          kind: 'receipt',
          occurredAt: daysAgo(0),
          transactionTitle: 'Blue Tokai',
          sizeKb: 412,
        },
        {
          title: 'Sony WH-1000XM6 invoice.pdf',
          kind: 'invoice',
          occurredAt: daysAgo(12),
          transactionTitle: 'Amazon',
          sizeKb: 188,
        },
        {
          title: 'Warranty card.pdf',
          kind: 'warranty',
          occurredAt: daysAgo(12),
          transactionTitle: 'Amazon',
          sizeKb: 96,
        },
      ],
    },
  ],
  empty: { items: [] },
  render: (d, k) => {
    const items = k.arr(d.items);
    if (!items.length)
      return k.page(
        k.header('Attachments', 'Receipts & files'),
        k.empty(
          'No attachments',
          'Attach a receipt or invoice to a transaction to keep it here.',
          'receipt',
        ),
      );
    return k.page(
      k.header('Attachments', 'Receipts & files', k.pill(String(items.length))),
      k.list(
        items.map((a) =>
          k.row({
            lead: k.tile(
              k.icon(a.kind === 'photo' ? 'eye' : 'receipt', 16),
              a.kind === 'warranty' ? 2 : 'accent',
            ),
            title: a.title,
            sub: [a.transactionTitle, k.date(a.occurredAt, 'day'), a.sizeKb ? a.sizeKb + ' KB' : '']
              .filter(Boolean)
              .join(' · '),
            badge: k.pill(a.kind),
          }),
        ),
      ),
    );
  },
});

export const transactionWidgets = [
  search,
  detail,
  receipt,
  lineItemTable,
  largest,
  recent,
  byDay,
  spendCalendar,
  uncategorized,
  duplicates,
  refunds,
  pending,
  saved,
  tags,
  comparePeriods,
  attachments,
];
