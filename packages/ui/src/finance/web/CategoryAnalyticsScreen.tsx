'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Search,
  Tag,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { Empty, Input, Select, Typography } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import styles from './CategoryAnalyticsScreen.module.css';

export type AnalyticsCategory = {
  id: string;
  name: string;
  icon?: string;
  kind: 'expense' | 'income';
  currency: string;
  monthlyLimitMinor?: bigint;
};
export type AnalyticsAccount = { id: string; name: string; currency?: string };
export type AnalyticsTransaction = {
  id: string;
  categoryId?: string;
  accountId?: string;
  amountMinor: bigint;
  currency: string;
  type: string;
  title: string;
  merchant?: string;
  occurredAt: number;
  status: string;
  deletedAt?: number;
};
export type AnalyticsBudget = {
  id: string;
  categoryId?: string;
  amountMinor: bigint;
  currency: string;
  period: string;
  startAt: number;
  endAt: number;
  archivedAt?: number;
};
export type CategoryAnalyticsScreenProps = {
  categories: readonly AnalyticsCategory[];
  accounts: readonly AnalyticsAccount[];
  transactions: readonly AnalyticsTransaction[];
  budgets: readonly AnalyticsBudget[];
  defaultCurrency: string;
  loading?: boolean;
  error?: string;
  onOpenCategory: (id: string) => void;
};

type Period = 'week' | 'month' | 'year';
type Scope = 'all' | 'expense' | 'income' | 'with-limit';
const palette = [
  '#ff697a',
  '#ffa347',
  '#5e9bff',
  '#a785ff',
  '#f4d34e',
  '#48d79b',
  '#57d9d0',
  '#b7ff4a',
];
const day = 86_400_000;

function asPercent(numerator: bigint, denominator: bigint) {
  return denominator > 0n ? Number((numerator * 100n) / denominator) : 0;
}
function range(period: Period, now: Date, previous = false): [number, number] {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (period === 'week') {
    const end = Date.UTC(y, m, now.getUTCDate() + (previous ? -6 : 1));
    return [end - day * 7, end];
  }
  if (period === 'month') {
    const startMonth = m + (previous ? -1 : 0);
    return [Date.UTC(y, startMonth, 1), Date.UTC(y, startMonth + 1, 1)];
  }
  const startYear = y - (previous ? 1 : 0);
  return [
    Date.UTC(startYear, 0, 1),
    previous ? Date.UTC(y, 0, 1) : Date.UTC(y, m, now.getUTCDate() + 1),
  ];
}
function compactDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(value);
}

export function CategoryAnalyticsScreen({
  categories,
  accounts,
  transactions,
  budgets,
  defaultCurrency,
  loading = false,
  error,
  onOpenCategory,
}: CategoryAnalyticsScreenProps) {
  const [period, setPeriod] = useState<Period>('month');
  const [scope, setScope] = useState<Scope>('all');
  const [accountId, setAccountId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [search, setSearch] = useState('');
  const now = new Date();
  const [startAt, endAt] = range(period, now);
  const [previousStartAt, previousEndAt] = range(period, now, true);
  const currencyOptions = useMemo(
    () =>
      [
        ...new Set([
          defaultCurrency,
          ...categories.map((item) => item.currency),
          ...transactions.map((item) => item.currency),
        ]),
      ].filter(Boolean),
    [categories, defaultCurrency, transactions],
  );
  const limitFor = (category: AnalyticsCategory, at = Date.now()) => {
    if (category.monthlyLimitMinor !== undefined) return category.monthlyLimitMinor;
    const budget = budgets.find(
      (item) =>
        item.period === 'category' &&
        item.categoryId === category.id &&
        item.archivedAt === undefined &&
        item.startAt <= at &&
        item.endAt > at &&
        item.currency === category.currency,
    );
    return budget?.amountMinor;
  };
  const scopedCategories = categories.filter(
    (item) =>
      (categoryId === 'all' || item.id === categoryId) &&
      (scope !== 'expense' || item.kind === 'expense') &&
      (scope !== 'income' || item.kind === 'income') &&
      (scope !== 'with-limit' || limitFor(item) !== undefined) &&
      item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const categoryMap = new Map(scopedCategories.map((item) => [item.id, item]));
  const accountAllowed = (transaction: AnalyticsTransaction) =>
    accountId === 'all' || transaction.accountId === accountId;
  const isValid = (transaction: AnalyticsTransaction, from: number, until: number) => {
    const category = categoryMap.get(transaction.categoryId ?? '');
    return (
      transaction.status === 'posted' &&
      transaction.deletedAt === undefined &&
      (transaction.type === 'expense' || transaction.type === 'income') &&
      transaction.occurredAt >= from &&
      transaction.occurredAt < until &&
      transaction.currency === currency &&
      category !== undefined &&
      accountAllowed(transaction)
    );
  };
  const currentTx = transactions.filter((item) => isValid(item, startAt, endAt));
  const previousTx = transactions.filter((item) => isValid(item, previousStartAt, previousEndAt));
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const monthSpentByCategory = new Map<string, bigint>();
  for (const transaction of transactions) {
    const category = categoryMap.get(transaction.categoryId ?? '');
    if (
      !category ||
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      transaction.type !== 'expense' ||
      transaction.occurredAt < monthStart ||
      transaction.occurredAt >= monthEnd ||
      transaction.currency !== category.currency ||
      !accountAllowed(transaction)
    )
      continue;
    monthSpentByCategory.set(
      category.id,
      (monthSpentByCategory.get(category.id) ?? 0n) + transaction.amountMinor,
    );
  }
  const stats = (rows: readonly AnalyticsTransaction[]) => {
    const spent = rows
      .filter((item) => item.type === 'expense')
      .reduce((sum, item) => sum + item.amountMinor, 0n);
    const received = rows
      .filter((item) => item.type === 'income')
      .reduce((sum, item) => sum + item.amountMinor, 0n);
    const perCategory = new Map<string, { spent: bigint; received: bigint; count: number }>();
    for (const item of rows) {
      const key = item.categoryId ?? '';
      const total = perCategory.get(key) ?? { spent: 0n, received: 0n, count: 0 };
      total.count += 1;
      if (item.type === 'expense') total.spent += item.amountMinor;
      else total.received += item.amountMinor;
      perCategory.set(key, total);
    }
    return { spent, received, perCategory };
  };
  const current = stats(currentTx);
  const previous = stats(previousTx);
  const categoryRows = scopedCategories.map((category) => {
    const total = current.perCategory.get(category.id) ?? { spent: 0n, received: 0n, count: 0 };
    const old = previous.perCategory.get(category.id)?.spent ?? 0n;
    const limitMinor = limitFor(category);
    const monthSpent = monthSpentByCategory.get(category.id) ?? 0n;
    return {
      ...category,
      ...total,
      limitMinor,
      monthSpent,
      change: old > 0n ? Number(((total.spent - old) * 100n) / old) : null,
    };
  });
  const expenseRows = categoryRows
    .filter((item) => item.spent > 0n)
    .sort((a, b) =>
      a.spent === b.spent ? a.name.localeCompare(b.name) : a.spent > b.spent ? -1 : 1,
    );
  const incomeRows = categoryRows
    .filter((item) => item.received > 0n)
    .sort((a, b) =>
      a.received === b.received ? a.name.localeCompare(b.name) : a.received > b.received ? -1 : 1,
    );
  const limitsAtRisk = categoryRows.filter(
    (item) =>
      item.limitMinor !== undefined &&
      item.limitMinor > 0n &&
      asPercent(item.monthSpent, item.limitMinor) >= 80,
  ).length;
  const expenseCategoryCount = categoryRows.filter((item) => item.kind === 'expense').length;
  const average = expenseCategoryCount > 0 ? current.spent / BigInt(expenseCategoryCount) : 0n;
  const donutRows = expenseRows;
  const donutTotal = expenseRows.reduce((sum, item) => sum + item.spent, 0n);
  const donutLegendRows = expenseRows.slice(0, 8);
  const donutOther = expenseRows.slice(8).reduce((sum, item) => sum + item.spent, 0n);
  const monthlyBuckets = Array.from({ length: 6 }, (_, index) => {
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1);
    const monthEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 4 + index, 1);
    const totals = scopedCategories
      .map((category) => {
        const value = transactions
          .filter(
            (item) =>
              item.status === 'posted' &&
              item.deletedAt === undefined &&
              item.type === 'expense' &&
              item.categoryId === category.id &&
              item.currency === currency &&
              accountAllowed(item) &&
              item.occurredAt >= monthStart &&
              item.occurredAt < monthEnd,
          )
          .reduce((sum, item) => sum + item.amountMinor, 0n);
        return { category, value };
      })
      .filter((item) => item.value > 0n)
      .sort((a, b) => (a.value > b.value ? -1 : 1))
      .slice(0, 6);
    return {
      key: monthStart,
      label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(monthStart),
      totals,
      sum: totals.reduce((total, item) => total + item.value, 0n),
    };
  });
  const maxMonth = monthlyBuckets.reduce(
    (max, bucket) => (bucket.sum > max ? bucket.sum : max),
    0n,
  );
  const growing = [...categoryRows]
    .filter((item) => item.change !== null && item.change > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const mostActive = [...categoryRows]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)[0];
  const inactive = categoryRows.find((item) => item.count === 0);
  const highestIncome = incomeRows[0];
  const periodName =
    period === 'week' ? 'this week' : period === 'year' ? 'this year' : 'this month';
  const usageRows = categoryRows
    .filter((item) => item.limitMinor !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  const allPerformance = [...categoryRows].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <Typography variant="title">Category analytics</Typography>
          <p>See how spending and income move across your categories.</p>
        </div>
        <div className={styles.tools}>
          <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChangeText={setSearch}
              placeholder="Search categories"
              accessibilityLabel="Search categories"
            />
          </label>
          <Select label="Period" className={styles.selectLabel} value={period} onChange={value => setPeriod(value as Period)} options={[{value:'week',label:'This week'},{value:'month',label:'This month'},{value:'year',label:'This year'}]} />
          <Select label="Account" className={styles.selectLabel} value={accountId} onChange={setAccountId} options={[{value:'all',label:'All accounts'},...accounts.map(item => ({value:item.id,label:item.name}))]} />
          <Select label="Category" className={styles.selectLabel} value={categoryId} onChange={setCategoryId} options={[{value:'all',label:'All categories'},...categories.map(item => ({value:item.id,label:item.name}))]} />
          <Select label="Currency" className={styles.selectLabel} value={currency} onChange={setCurrency} options={currencyOptions} />
        </div>
      </header>
      <div className={styles.toolbar} role="group" aria-label="Category type filter">
        {(
          [
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
            { value: 'with-limit', label: 'With limit' },
          ] as const
        ).map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={scope === item.value}
            className={scope === item.value ? styles.active : undefined}
            onClick={() => setScope(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className={styles.loading} role="status">
          Loading category activity…
        </div>
      ) : (
        <>
          <section className={styles.metrics} aria-label="Category analytics summary">
            <Metric
              icon={<Tag size={17} />}
              label={`Total spent ${periodName}`}
              value={formatMinor(current.spent, currency)}
              note={
                growing
                  ? `${growing.change! > 0 ? '↑' : '↓'} ${Math.abs(growing.change!)}% from previous period`
                  : 'Across selected categories'
              }
              tone="expense"
            />
            <Metric
              icon={<ArrowUpRight size={18} />}
              label={`Total received ${periodName}`}
              value={formatMinor(current.received, currency)}
              note={`${incomeRows.length} income ${incomeRows.length === 1 ? 'category' : 'categories'}`}
              tone="income"
            />
            <Metric
              icon={<BarChart3 size={18} />}
              label="Average category spend"
              value={formatMinor(average, currency)}
              note={`Across ${expenseCategoryCount} expense ${expenseCategoryCount === 1 ? 'category' : 'categories'}`}
              tone="violet"
            />
            <Metric
              icon={<AlertTriangle size={17} />}
              label="Limits at risk"
              value={String(limitsAtRisk)}
              note="Categories at 80% or more"
              tone="warning"
            />
          </section>
          <section className={styles.chartGrid}>
            <article className={`${styles.panel} ${styles.donutPanel}`}>
              <PanelHeading title="Expense distribution" note={`By category · ${periodName}`} />
              {donutRows.length === 0 ? (
                <p className={styles.noData}>No posted expenses in this range.</p>
              ) : (
                <div className={styles.donutLayout}>
                  <div
                    className={styles.donut}
                    role="img"
                    aria-label={`Expense distribution totaling ${formatMinor(donutTotal, currency)}`}
                  >
                    <svg viewBox="0 0 140 140" aria-hidden="true">
                      <circle
                        cx="70"
                        cy="70"
                        r="51"
                        fill="none"
                        stroke="var(--finance-line, #262926)"
                        strokeWidth="15"
                      />
                      {donutRows.map((item, index) => {
                        const circumference = 2 * Math.PI * 51;
                        const length =
                          donutTotal > 0n
                            ? (circumference * Number((item.spent * 10000n) / donutTotal)) / 10000
                            : 0;
                        const offset = donutRows
                          .slice(0, index)
                          .reduce(
                            (sum, row) =>
                              sum +
                              (donutTotal > 0n
                                ? (circumference * Number((row.spent * 10000n) / donutTotal)) /
                                  10000
                                : 0),
                            0,
                          );
                        return (
                          <circle
                            key={item.id}
                            cx="70"
                            cy="70"
                            r="51"
                            fill="none"
                            stroke={palette[index % palette.length]}
                            strokeWidth="15"
                            strokeDasharray={`${length} ${circumference - length}`}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 70 70)"
                          />
                        );
                      })}
                    </svg>
                    <div>
                      <strong>{formatMinor(donutTotal, currency)}</strong>
                      <span>Total expenses</span>
                    </div>
                  </div>
                  <div className={styles.legend}>
                    {donutLegendRows.map((item, index) => (
                      <button type="button" key={item.id} onClick={() => onOpenCategory(item.id)}>
                        <i style={{ background: palette[index % palette.length] }} />
                        <span>{item.name}</span>
                        <small>{asPercent(item.spent, donutTotal)}%</small>
                        <strong>{formatMinor(item.spent, currency)}</strong>
                      </button>
                    ))}
                    {donutOther > 0n && (
                      <button type="button" disabled>
                        <i style={{ background: palette[8 % palette.length] }} />
                        <span>Other categories</span>
                        <small>{asPercent(donutOther, donutTotal)}%</small>
                        <strong>{formatMinor(donutOther, currency)}</strong>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
            <article className={styles.panel}>
              <PanelHeading title="Top categories by spend" note="Highest posted expenses" />
              <div className={styles.ranked}>
                {expenseRows.slice(0, 6).map((item, index) => (
                  <button key={item.id} type="button" onClick={() => onOpenCategory(item.id)}>
                    <CategoryIcon label={item.name} icon={item.icon} />
                    <span>{item.name}</span>
                    <i>
                      <b
                        style={{
                          width: `${Math.max(5, asPercent(item.spent, expenseRows[0]?.spent ?? 0n))}%`,
                          background: palette[index % palette.length],
                        }}
                      />
                    </i>
                    <strong>{formatMinor(item.spent, currency)}</strong>
                  </button>
                ))}
              </div>
              {expenseRows.length === 0 && (
                <p className={styles.noData}>No posted expenses in this range.</p>
              )}
            </article>
            <article className={`${styles.panel} ${styles.monthlyPanel}`}>
              <PanelHeading title="Monthly category spending" note="Last six calendar months" />
              <div
                className={styles.monthBars}
                role="img"
                aria-label="Posted monthly expenses by category for the last six calendar months"
              >
                {monthlyBuckets.map((bucket) => (
                  <div key={bucket.key} className={styles.monthColumn}>
                    <div
                      className={styles.stack}
                      title={`${bucket.label}: ${formatMinor(bucket.sum, currency)}`}
                    >
                      {bucket.totals
                        .slice()
                        .reverse()
                        .map(({ category, value }) => (
                          <span
                            key={category.id}
                            style={{
                              height: `${maxMonth > 0n ? Math.max(2, Number((value * 10000n) / maxMonth) / 100) : 0}%`,
                              background:
                                palette[
                                  scopedCategories.findIndex((item) => item.id === category.id) %
                                    palette.length
                                ],
                            }}
                          />
                        ))}
                    </div>
                    <small>{bucket.label}</small>
                  </div>
                ))}
              </div>
              <div className={styles.monthLegend}>
                {scopedCategories
                  .filter((item) =>
                    monthlyBuckets.some((bucket) =>
                      bucket.totals.some((total) => total.category.id === item.id),
                    ),
                  )
                  .slice(0, 6)
                  .map((item) => (
                    <span key={item.id}>
                      <i
                        style={{
                          background:
                            palette[
                              scopedCategories.findIndex((category) => category.id === item.id) %
                                palette.length
                            ],
                        }}
                      />
                      {item.name}
                    </span>
                  ))}
              </div>
            </article>
          </section>
          <section className={styles.panel}>
            <PanelHeading
              title="Category limit utilization"
              note="Spending against active monthly limits"
            />
            {usageRows.length ? (
              <div className={styles.usageGrid}>
                {usageRows.map((item) => {
                  const value = asPercent(item.monthSpent, item.limitMinor ?? 0n);
                  return (
                    <button type="button" key={item.id} onClick={() => onOpenCategory(item.id)}>
                      <CategoryIcon label={item.name} icon={item.icon} />
                      <strong>{item.name}</strong>
                      <span className={styles.usageTrack}>
                        <small>
                          {value}% of {formatMinor(item.limitMinor!, item.currency)}
                        </small>
                        <i>
                          <b
                            data-risk={value >= 80}
                            style={{ width: `${Math.min(100, value)}%` }}
                          />
                        </i>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.noData}>No active category limits are set.</p>
            )}
          </section>
          <section className={styles.panel}>
            <PanelHeading title="Key insights" note="Based on your selected filters and period" />
            <div className={styles.insights}>
              <Insight
                icon={<ArrowDownRight size={18} />}
                label="Fastest growing category"
                value={growing?.name ?? 'No increase to report'}
                note={
                  growing
                    ? `${growing.change}% more than the previous period`
                    : 'Not enough comparable activity'
                }
                tone="expense"
              />
              <Insight
                icon={<ArrowUpRight size={18} />}
                label="Highest income category"
                value={highestIncome?.name ?? 'No income this period'}
                note={
                  highestIncome
                    ? formatMinor(highestIncome.received, highestIncome.currency) + ' received'
                    : 'No posted income in this range'
                }
                tone="income"
              />
              <Insight
                icon={<Wallet size={18} />}
                label="Most active category"
                value={mostActive?.name ?? 'No activity yet'}
                note={
                  mostActive
                    ? `${mostActive.count} posted transactions`
                    : 'No category transactions in this range'
                }
                tone="blue"
              />
              <Insight
                icon={<span aria-hidden="true">—</span>}
                label="No activity"
                value={inactive?.name ?? 'All active'}
                note={
                  inactive ? `No posted transactions ${periodName}` : 'Every category has activity'
                }
                tone="neutral"
              />
            </div>
          </section>
          <section className={`${styles.panel} ${styles.performancePanel}`}>
            <PanelHeading
              title="Category performance"
              note={`${compactDate(startAt)} – ${compactDate(Math.max(startAt, endAt - 1))}`}
            />
            {allPerformance.length ? (
              <div className={styles.performanceWrap}>
                <table className={styles.performance}>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Transactions</th>
                      <th>Spent</th>
                      <th>Received</th>
                      <th>Limit use</th>
                      <th>Vs previous</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {allPerformance.map((item) => {
                      const usage = item.limitMinor
                        ? asPercent(item.monthSpent, item.limitMinor)
                        : null;
                      return (
                        <tr key={item.id}>
                          <td>
                            <button
                              type="button"
                              className={styles.performanceCategory}
                              onClick={() => onOpenCategory(item.id)}
                            >
                              <CategoryIcon label={item.name} icon={item.icon} />
                              <span>{item.name}</span>
                            </button>
                          </td>
                          <td>{item.count}</td>
                          <td className={styles.expenseText}>
                            {item.spent ? formatMinor(item.spent, currency) : '—'}
                          </td>
                          <td className={styles.incomeText}>
                            {item.received ? formatMinor(item.received, currency) : '—'}
                          </td>
                          <td>
                            {usage === null ? (
                              '—'
                            ) : (
                              <span className={styles.performanceLimit}>
                                {usage}%{' '}
                                <i>
                                  <b
                                    data-risk={usage >= 80}
                                    style={{ width: `${Math.min(100, usage)}%` }}
                                  />
                                </i>
                              </span>
                            )}
                          </td>
                          <td
                            className={
                              item.change === null
                                ? ''
                                : item.change > 0
                                  ? styles.expenseText
                                  : styles.incomeText
                            }
                          >
                            {item.change === null
                              ? '—'
                              : `${item.change > 0 ? '↑' : item.change < 0 ? '↓' : '–'} ${Math.abs(item.change)}%`}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.arrowButton}
                              aria-label={`Open ${item.name}`}
                              onClick={() => onOpenCategory(item.id)}
                            >
                              ›
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="No matching categories."
                description="Try changing the account, currency, category, or search filters."
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className={styles.metric} data-tone={tone}>
      <span className={styles.metricIcon}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </article>
  );
}
function PanelHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className={styles.panelHeading}>
      <div>
        <Typography variant="heading">{title}</Typography>
        <p>{note}</p>
      </div>
    </div>
  );
}
function Insight({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className={styles.insight} data-tone={tone}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <p>{note}</p>
      </div>
    </article>
  );
}
