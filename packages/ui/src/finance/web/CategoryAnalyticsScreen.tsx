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
import { Input, Select, Typography, useTheme } from '@finapp/ui/web';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import { FinanceEmptyState } from './FinanceEmptyState';
import styles from './CategoryAnalyticsScreen.module.css';
import { chartPalette } from '../../tokens';
import {
  ColumnChart,
  DonutChart,
  Meter,
  RankedBars,
  compactMoney,
  fullMoney,
} from '../../charts/web';
import { toMajor } from '../../analytics/chart-utils';

export type AnalyticsCategory = {
  id: string;
  name: string;
  icon?: string;
  kind: 'expense' | 'income';
  currency: string;
  monthlyLimitMinor?: bigint;
  /** Alert level for the limit, in percent (default 80). */
  limitAlertPercent?: number;
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
export type CategoryAnalyticsScreenProps = {
  categories: readonly AnalyticsCategory[];
  accounts: readonly AnalyticsAccount[];
  transactions: readonly AnalyticsTransaction[];
  defaultCurrency: string;
  loading?: boolean;
  error?: string;
  onOpenCategory: (id: string) => void;
};

type Period = 'week' | 'month' | 'year';
type Scope = 'all' | 'expense' | 'income' | 'with-limit';
const palette = [
  chartPalette.pink,
  chartPalette.orange,
  chartPalette.blue,
  chartPalette.violet,
  chartPalette.yellow,
  chartPalette.volt,
  chartPalette.cyan,
];
function categoryColor(index: number, primary: string) {
  const colorIndex = index % (palette.length + 1);
  return colorIndex === palette.length ? primary : palette[colorIndex]!;
}
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
  defaultCurrency,
  loading = false,
  error,
  onOpenCategory,
}: CategoryAnalyticsScreenProps) {
  const { tokens } = useTheme();
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
  // A category's monthly limit is its budget.
  const limitFor = (category: AnalyticsCategory) => category.monthlyLimitMinor;
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
      asPercent(item.monthSpent, item.limitMinor) >= (item.limitAlertPercent ?? 80),
  ).length;
  const expenseCategoryCount = categoryRows.filter((item) => item.kind === 'expense').length;
  const average = expenseCategoryCount > 0 ? current.spent / BigInt(expenseCategoryCount) : 0n;
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
      .filter((item) => item.value > 0n);
    return {
      key: monthStart,
      label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(monthStart),
      totals,
      sum: totals.reduce((total, item) => total + item.value, 0n),
    };
  });
  const monthlyCategories = scopedCategories
    .map((category) => ({
      category,
      total: monthlyBuckets.reduce(
        (sum, bucket) =>
          sum + (bucket.totals.find((item) => item.category.id === category.id)?.value ?? 0n),
        0n,
      ),
    }))
    .filter((item) => item.total > 0n)
    .sort((a, b) =>
      a.total === b.total
        ? a.category.name.localeCompare(b.category.name)
        : a.total > b.total
          ? -1
          : 1,
    )
    .slice(0, 6)
    .map((item) => item.category);
  const monthlyOtherValues = monthlyBuckets.map((bucket) =>
    bucket.totals.reduce(
      (sum, item) =>
        sum +
        (monthlyCategories.some((category) => category.id === item.category.id)
          ? 0n
          : item.value),
      0n,
    ),
  );
  const colorOf = (id: string) =>
    categoryColor(
      scopedCategories.findIndex((item) => item.id === id),
      tokens.primary,
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
          <Select
            label="Period"
            className={styles.selectLabel}
            value={period}
            onChange={(value) => setPeriod(value as Period)}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
              { value: 'year', label: 'This year' },
            ]}
          />
          <Select
            label="Account"
            className={styles.selectLabel}
            value={accountId}
            onChange={setAccountId}
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <Select
            label="Category"
            className={styles.selectLabel}
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: 'all', label: 'All categories' },
              ...categories.map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          <Select
            label="Currency"
            className={styles.selectLabel}
            value={currency}
            onChange={setCurrency}
            options={currencyOptions}
          />
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
              note="Categories at or past their alert level"
              tone="warning"
            />
          </section>
          <section className={styles.chartGrid}>
            <article className={`${styles.panel} ${styles.donutPanel}`}>
              <PanelHeading title="Expense distribution" note={`By category · ${periodName}`} />
              {expenseRows.length === 0 ? (
                <FinanceEmptyState
                  kind="analytics"
                  compact
                  title="No posted expenses in this range"
                  description="Expense distribution will appear when matching activity is recorded."
                />
              ) : (
                <DonutChart
                  caption={`Expense distribution totaling ${formatMinor(donutTotal, currency)}`}
                  centerValue={formatMinor(donutTotal, currency)}
                  centerLabel="Total expenses"
                  size={180}
                  items={[
                    ...donutLegendRows.map((item, index) => ({
                      id: item.id,
                      label: item.name,
                      value: toMajor(item.spent, currency),
                      display: formatMinor(item.spent, currency),
                      color: categoryColor(index, tokens.primary),
                    })),
                    ...(donutOther > 0n
                      ? [
                          {
                            id: '__other__',
                            label: 'Other categories',
                            value: toMajor(donutOther, currency),
                            display: formatMinor(donutOther, currency),
                            color: tokens.foregroundSubtle,
                          },
                        ]
                      : []),
                  ]}
                  onSelect={(item) => item.id !== '__other__' && onOpenCategory(item.id)}
                />
              )}
            </article>
            <article className={styles.panel}>
              <PanelHeading title="Top categories by spend" note="Highest posted expenses" />
              <RankedBars
                caption="Top categories by spend"
                items={expenseRows.slice(0, 6).map((item, index) => ({
                  id: item.id,
                  label: item.name,
                  value: toMajor(item.spent, currency),
                  display: formatMinor(item.spent, currency),
                  color: categoryColor(index, tokens.primary),
                  icon: <CategoryIcon label={item.name} icon={item.icon} />,
                }))}
                onSelect={(item) => onOpenCategory(item.id)}
              />
              {expenseRows.length === 0 && (
                <FinanceEmptyState
                  kind="analytics"
                  compact
                  title="No posted expenses in this range"
                  description="Category spending will appear when matching activity is recorded."
                />
              )}
            </article>
            <article className={`${styles.panel} ${styles.monthlyPanel}`}>
              <PanelHeading title="Monthly category spending" note="Last six calendar months" />
              <ColumnChart
                caption={`Posted monthly expenses by category for the last six months in ${currency}`}
                mode="stacked"
                height={220}
                labels={monthlyBuckets.map((bucket) => bucket.label)}
                titles={monthlyBuckets.map((bucket) => bucket.label)}
                series={[
                  ...monthlyCategories.map((category) => ({
                    id: category.id,
                    label: category.name,
                    color: colorOf(category.id),
                    values: monthlyBuckets.map((bucket) =>
                      toMajor(
                        bucket.totals.find((total) => total.category.id === category.id)?.value ??
                          0n,
                        currency,
                      ),
                    ),
                  })),
                  ...(monthlyOtherValues.some((value) => value > 0n)
                    ? [
                        {
                          id: 'other',
                          label: 'Other',
                          color: 'var(--finapp-foreground-muted)',
                          values: monthlyOtherValues.map((value) => toMajor(value, currency)),
                        },
                      ]
                    : []),
                ]}
                format={(value) => fullMoney(value, currency)}
                axisFormat={(value) => compactMoney(value, currency)}
                showLegend
              />
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
                        <Meter
                          value={Number(item.monthSpent)}
                          max={Number(item.limitMinor ?? 0n)}
                          warnAt={(item.limitAlertPercent ?? 80) / 100}
                          label={`${value}% of ${formatMinor(item.limitMinor!, item.currency)}`}
                          detail={
                            item.monthSpent > item.limitMinor!
                              ? `${formatMinor(item.monthSpent - item.limitMinor!, item.currency)} over`
                              : `${formatMinor(item.limitMinor! - item.monthSpent, item.currency)} left`
                          }
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <FinanceEmptyState
                kind="category"
                compact
                title="No category limits set"
                description="Set a monthly limit to track category spending against a target."
              />
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
                                <Meter
                                  value={Number(item.monthSpent)}
                                  max={Number(item.limitMinor ?? 0n)}
                                  warnAt={(item.limitAlertPercent ?? 80) / 100}
                                  label={`${usage}% of ${formatMinor(item.limitMinor ?? 0n, item.currency)}`}
                                  thin
                                />
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
              <FinanceEmptyState
                kind="search"
                compact
                title="No matching categories"
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
