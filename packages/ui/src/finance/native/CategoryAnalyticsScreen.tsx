import React, { useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View, StyleSheet } from 'react-native';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartLineUp as BarChart3,
  MagnifyingGlass as Search,
  ReceiptText as Tag,
  Wallet,
} from '@finapp/ui/icons/native';
import { Input, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from './FinanceEmptyState';
import { formatMinor } from '../money';
import { CategoryIcon } from './CategoryIcon';
import { chartPalette } from '../../tokens';
import {
  ColumnChart,
  DonutChart,
  Meter,
  RankedBars,
  compactMoney,
  fullMoney,
} from '../../charts/native';
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
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let startAt: number;
  let endAt: number;
  let previousStartAt: number;
  let previousEndAt: number;
  if (period === 'week') {
    endAt = Date.UTC(y, m, now.getUTCDate() + 1);
    startAt = endAt - day * 7;
    previousEndAt = startAt;
    previousStartAt = previousEndAt - day * 7;
  } else if (period === 'month') {
    startAt = Date.UTC(y, m, 1);
    endAt = Date.UTC(y, m + 1, 1);
    previousStartAt = Date.UTC(y, m - 1, 1);
    previousEndAt = startAt;
  } else {
    startAt = Date.UTC(y, 0, 1);
    endAt = Date.UTC(y, m, now.getUTCDate() + 1);
    previousStartAt = Date.UTC(y - 1, 0, 1);
    previousEndAt = startAt;
  }
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
  const categoryById = new Map(scopedCategories.map((item) => [item.id, item]));
  const matchesAccount = (item: AnalyticsTransaction) =>
    accountId === 'all' || item.accountId === accountId;
  const isValid = (item: AnalyticsTransaction, from: number, until: number) =>
    item.status === 'posted' &&
    item.deletedAt === undefined &&
    (item.type === 'expense' || item.type === 'income') &&
    item.occurredAt >= from &&
    item.occurredAt < until &&
    item.currency === currency &&
    categoryById.has(item.categoryId ?? '') &&
    matchesAccount(item);
  const currentTx = transactions.filter((item) => isValid(item, startAt, endAt));
  const previousTx = transactions.filter((item) => isValid(item, previousStartAt, previousEndAt));
  const monthStart = Date.UTC(y, m, 1);
  const monthEnd = Date.UTC(y, m + 1, 1);
  const monthSpentByCategory = new Map<string, bigint>();
  for (const transaction of transactions) {
    const category = categoryById.get(transaction.categoryId ?? '');
    if (
      !category ||
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      transaction.type !== 'expense' ||
      transaction.occurredAt < monthStart ||
      transaction.occurredAt >= monthEnd ||
      transaction.currency !== category.currency ||
      !matchesAccount(transaction)
    )
      continue;
    monthSpentByCategory.set(
      category.id,
      (monthSpentByCategory.get(category.id) ?? 0n) + transaction.amountMinor,
    );
  }
  const summarize = (rows: readonly AnalyticsTransaction[]) => {
    const perCategory = new Map<string, { spent: bigint; received: bigint; count: number }>();
    let spent = 0n;
    let received = 0n;
    for (const row of rows) {
      const key = row.categoryId ?? '';
      const value = perCategory.get(key) ?? { spent: 0n, received: 0n, count: 0 };
      value.count += 1;
      if (row.type === 'expense') {
        value.spent += row.amountMinor;
        spent += row.amountMinor;
      } else {
        value.received += row.amountMinor;
        received += row.amountMinor;
      }
      perCategory.set(key, value);
    }
    return { spent, received, perCategory };
  };
  const current = summarize(currentTx);
  const previous = summarize(previousTx);
  const rows = scopedCategories.map((category) => {
    const total = current.perCategory.get(category.id) ?? { spent: 0n, received: 0n, count: 0 };
    const prior = previous.perCategory.get(category.id)?.spent ?? 0n;
    const change = prior > 0n ? Number(((total.spent - prior) * 100n) / prior) : null;
    return {
      ...category,
      ...total,
      change,
      monthSpent: monthSpentByCategory.get(category.id) ?? 0n,
      limitMinor: limitFor(category),
    };
  });
  const expenseRows = rows
    .filter((item) => item.spent > 0n)
    .sort((a, b) =>
      a.spent === b.spent ? a.name.localeCompare(b.name) : a.spent > b.spent ? -1 : 1,
    );
  const incomeRows = rows
    .filter((item) => item.received > 0n)
    .sort((a, b) => (a.received > b.received ? -1 : 1));
  const limitsAtRisk = rows.filter(
    (item) =>
      item.limitMinor !== undefined &&
      item.limitMinor > 0n &&
      Number((item.monthSpent * 100n) / item.limitMinor) >= (item.limitAlertPercent ?? 80),
  ).length;
  const expenseCount = rows.filter((item) => item.kind === 'expense').length;
  const average = expenseCount > 0 ? current.spent / BigInt(expenseCount) : 0n;
  const donutTotal = expenseRows.reduce((sum, item) => sum + item.spent, 0n);
  const donutOther = expenseRows.slice(8).reduce((sum, item) => sum + item.spent, 0n);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const from = Date.UTC(y, m - 5 + index, 1);
    const until = Date.UTC(y, m - 4 + index, 1);
    const values = scopedCategories
      .map((category) => ({
        category,
        amount: transactions
          .filter(
            (item) =>
              item.status === 'posted' &&
              item.deletedAt === undefined &&
              item.type === 'expense' &&
              item.categoryId === category.id &&
              item.currency === currency &&
              matchesAccount(item) &&
              item.occurredAt >= from &&
              item.occurredAt < until,
          )
          .reduce((sum, item) => sum + item.amountMinor, 0n),
      }))
      .filter((item) => item.amount > 0n);
    return {
      start: from,
      label: new Intl.DateTimeFormat(undefined, { month: 'short' }).format(from),
      values,
      total: values.reduce((sum, item) => sum + item.amount, 0n),
    };
  });
  const monthlyCategories = scopedCategories
    .map((category) => ({
      category,
      total: monthly.reduce(
        (sum, bucket) =>
          sum + (bucket.values.find((item) => item.category.id === category.id)?.amount ?? 0n),
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
  const monthlyOtherValues = monthly.map((bucket) =>
    bucket.values.reduce(
      (sum, item) =>
        sum +
        (monthlyCategories.some((category) => category.id === item.category.id) ? 0n : item.amount),
      0n,
    ),
  );
  const growing = [...rows]
    .filter((item) => item.change !== null && item.change > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  const mostActive = [...rows]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)[0];
  const inactive = rows.find((item) => item.count === 0);
  const highestIncome = incomeRows[0];
  const periodLabel =
    period === 'week' ? 'this week' : period === 'year' ? 'this year' : 'this month';
  const usageRows = rows
    .filter((item) => item.limitMinor !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  const performanceRows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const tone = {
    expense: tokens.expense,
    income: tokens.income,
    accent: tokens.primary,
    violet: tokens.chart.violet,
    warning: tokens.warning,
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heading}>
        <Typography variant="title">Category analytics</Typography>
        <Typography variant="small" style={{ color: tokens.foregroundMuted }}>
          See where money goes across your categories.
        </Typography>
      </View>
      <View
        style={[
          styles.search,
          { borderColor: tokens.border, backgroundColor: tokens.surfaceSubtle },
        ]}
      >
        <Search size={16} color={tokens.foregroundMuted} />
        <Input
          accessibilityLabel="Search categories"
          placeholder="Search categories"
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>
      <FilterRail
        label="Period"
        values={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        value={period}
        onChange={(value) => setPeriod(value as Period)}
      />
      <FilterRail
        label="Type"
        values={[
          { value: 'all', label: 'All' },
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
          { value: 'with-limit', label: 'With limit' },
        ]}
        value={scope}
        onChange={(value) => setScope(value as Scope)}
      />
      <FilterRail
        label="Account"
        values={[
          { value: 'all', label: 'All accounts' },
          ...accounts.map((item) => ({ value: item.id, label: item.name })),
        ]}
        value={accountId}
        onChange={setAccountId}
      />
      <FilterRail
        label="Category"
        values={[
          { value: 'all', label: 'All categories' },
          ...categories.map((item) => ({ value: item.id, label: item.name })),
        ]}
        value={categoryId}
        onChange={setCategoryId}
      />
      {currencyOptions.length > 1 && (
        <FilterRail
          label="Currency"
          values={currencyOptions.map((value) => ({ value, label: value }))}
          value={currency}
          onChange={setCurrency}
        />
      )}
      {error ? (
        <Typography accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Typography>
      ) : null}
      {loading ? (
        <Typography
          variant="small"
          accessibilityLiveRegion="polite"
          style={{ color: tokens.foregroundMuted, paddingVertical: 28 }}
        >
          Loading category analytics…
        </Typography>
      ) : (
        <>
          <View style={styles.metrics}>
            <Metric
              label="Spent"
              value={formatMinor(current.spent, currency)}
              note={periodLabel}
              tone={tone.expense}
            />
            <Metric
              label="Received"
              value={formatMinor(current.received, currency)}
              note={`${incomeRows.length} income categories`}
              tone={tone.income}
            />
            <Metric
              label="Average category spend"
              value={formatMinor(average, currency)}
              note={`${expenseCount} expense categories`}
              tone={tone.violet}
            />
            <Metric
              label="Limits at risk"
              value={String(limitsAtRisk)}
              note="At or past their alert level"
              tone={tone.warning}
            />
          </View>
          <View
            style={[
              styles.card,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Section title="Expense distribution" note={periodLabel} />
            {expenseRows.length ? (
              <DonutChart
                caption={`Expense distribution totaling ${formatMinor(donutTotal, currency)}`}
                centerValue={formatMinor(donutTotal, currency)}
                centerLabel="Total spend"
                size={160}
                items={[
                  ...expenseRows.slice(0, 8).map((item, index) => ({
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
            ) : (
              <FinanceEmptyState
                kind="analytics"
                title="No spending in this period."
                description="Posted expenses will appear here when you have activity in the selected range."
                compact
              />
            )}
          </View>
          <View
            style={[
              styles.card,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Section title="Top categories by spend" note="Highest posted expenses" />
            <RankedBars
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
                title="No posted expenses in this range."
                description="Choose another period to review category spending."
                compact
              />
            )}
          </View>
          <View
            style={[
              styles.card,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Section title="Monthly category spending" note="Last six months" />
            <ColumnChart
              caption={`Posted monthly expenses by category for the last six months in ${currency}`}
              mode="stacked"
              height={200}
              labels={monthly.map((bucket) => bucket.label)}
              titles={monthly.map((bucket) => bucket.label)}
              series={[
                ...monthlyCategories.map((category) => ({
                  id: category.id,
                  label: category.name,
                  color: categoryColor(
                    scopedCategories.findIndex((item) => item.id === category.id),
                    tokens.primary,
                  ),
                  values: monthly.map((bucket) =>
                    toMajor(
                      bucket.values.find((value) => value.category.id === category.id)?.amount ??
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
                        color: tokens.foregroundMuted,
                        values: monthlyOtherValues.map((value) => toMajor(value, currency)),
                      },
                    ]
                  : []),
              ]}
              format={(value) => fullMoney(value, currency)}
              axisFormat={(value) => compactMoney(value, currency)}
              showLegend
            />
          </View>
          <View
            style={[
              styles.card,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Section title="Category limit utilization" note="Current active category limits" />
            {usageRows.length ? (
              usageRows.map((item) => {
                const used =
                  item.limitMinor && item.limitMinor > 0n
                    ? Number((item.monthSpent * 100n) / item.limitMinor)
                    : 0;
                return (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => onOpenCategory(item.id)}
                    style={styles.usageRow}
                  >
                    <CategoryIcon label={item.name} icon={item.icon} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.usageLabel}>
                        <Typography variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                          {used}% of {formatMinor(item.limitMinor!, item.currency)}
                        </Typography>
                      </View>
                      <Meter
                        value={Number(item.monthSpent)}
                        max={Number(item.limitMinor ?? 0n)}
                        warnAt={(item.limitAlertPercent ?? 80) / 100}
                        thin
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                No active category limits are set.
              </Typography>
            )}
          </View>
          <View
            style={[
              styles.card,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Section title="Key insights" note="From selected filters and period" />
            <Insight
              icon={<ArrowDownRight size={18} color={tokens.expense} />}
              label="Fastest growing"
              value={growing?.name ?? 'No increase to report'}
              note={
                growing
                  ? `${growing.change}% above the prior period`
                  : 'Not enough comparable activity'
              }
            />
            <Insight
              icon={<ArrowUpRight size={18} color={tokens.income} />}
              label="Highest income"
              value={highestIncome?.name ?? 'No income this period'}
              note={
                highestIncome
                  ? `${formatMinor(highestIncome.received, highestIncome.currency)} received`
                  : 'No posted income in this range'
              }
            />
            <Insight
              icon={<Wallet size={18} color={tokens.primary} />}
              label="Most active"
              value={mostActive?.name ?? 'No activity yet'}
              note={
                mostActive
                  ? `${mostActive.count} posted transactions`
                  : 'No category activity in this range'
              }
            />
            <Insight
              icon={<Tag size={18} color={tokens.foregroundMuted} />}
              label="No activity"
              value={inactive?.name ?? 'All active'}
              note={
                inactive
                  ? `No posted transactions ${periodLabel}`
                  : 'Every active category has activity'
              }
            />
          </View>
          <View
            style={[
              styles.card,
              { borderColor: tokens.borderSubtle, backgroundColor: tokens.card },
            ]}
          >
            <Section title="Category performance" note={periodLabel} />
            {performanceRows.length ? (
              performanceRows.map((item) => {
                const limitUse =
                  item.limitMinor && item.limitMinor > 0n
                    ? Number((item.monthSpent * 100n) / item.limitMinor)
                    : null;
                return (
                  <TouchableOpacity
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => onOpenCategory(item.id)}
                    style={[styles.performanceRow, { borderTopColor: tokens.borderSubtle }]}
                  >
                    <CategoryIcon label={item.name} icon={item.icon} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.performanceTitle}>
                        <Typography
                          variant="bodyLarge"
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: 13 }}
                        >
                          {item.name}
                        </Typography>
                        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                          {item.count} tx
                        </Typography>
                      </View>
                      <View style={styles.performanceAmounts}>
                        <Typography variant="caption" style={{ color: tokens.expense }}>
                          {item.spent ? formatMinor(item.spent, currency) : '—'}
                        </Typography>
                        <Typography variant="caption" style={{ color: tokens.income }}>
                          {item.received ? formatMinor(item.received, currency) : '—'}
                        </Typography>
                        <Typography
                          variant="caption"
                          style={{
                            color: item.change && item.change > 0 ? tokens.expense : tokens.income,
                          }}
                        >
                          {item.change === null
                            ? '—'
                            : `${item.change > 0 ? '↑' : item.change < 0 ? '↓' : '–'} ${Math.abs(item.change)}%`}
                        </Typography>
                      </View>
                      {limitUse !== null && (
                        <Meter
                          value={Number(item.monthSpent)}
                          max={Number(item.limitMinor ?? 0n)}
                          warnAt={(item.limitAlertPercent ?? 80) / 100}
                          detail={`${limitUse}% of ${formatMinor(item.limitMinor!, item.currency)}`}
                          thin
                        />
                      )}
                    </View>
                    <ArrowRight size={16} color={tokens.foregroundSubtle} />
                  </TouchableOpacity>
                );
              })
            ) : (
              <FinanceEmptyState
                kind="search"
                title="No matching categories."
                description="Change the filters to see category performance."
                compact
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function FilterRail({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={styles.filterLine}>
      <Typography variant="caption" style={[styles.filterLabel, { color: tokens.foregroundMuted }]}>
        {label}
      </Typography>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRail}
      >
        {values.map((item) => (
          <TouchableOpacity
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: value === item.value }}
            onPress={() => onChange(item.value)}
            style={[
              styles.filterChip,
              {
                borderColor: value === item.value ? tokens.primary : tokens.borderSubtle,
                backgroundColor: value === item.value ? tokens.primary : tokens.surfaceRaised,
              },
            ]}
          >
            <Typography
              variant="caption"
              numberOfLines={1}
              style={{ color: value === item.value ? tokens.primaryForeground : tokens.foreground }}
            >
              {item.label}
            </Typography>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
function Section({ title, note }: { title: string; note: string }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 3, marginBottom: 10 }}>
      <Typography variant="heading" style={{ fontSize: 15 }}>
        {title}
      </Typography>
      <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
        {note}
      </Typography>
    </View>
  );
}
function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.metric,
        { borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceRaised },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: `${tone}18` }]}>
        <BarChart3 size={15} color={tone} />
      </View>
      <Typography variant="caption" numberOfLines={1} style={{ color: tokens.foregroundMuted }}>
        {label}
      </Typography>
      <Typography
        variant="bodyLarge"
        numberOfLines={1}
        style={{ fontSize: 16, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        numberOfLines={1}
        style={{ color: tokens.foregroundSubtle, fontSize: 10 }}
      >
        {note}
      </Typography>
    </View>
  );
}
function Insight({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.insight,
        { borderColor: tokens.borderSubtle, backgroundColor: tokens.surfaceRaised },
      ]}
    >
      <View style={[styles.insightIcon, { backgroundColor: tokens.surfaceSubtle }]}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
          {label}
        </Typography>
        <Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 13 }}>
          {value}
        </Typography>
        <Typography variant="caption" style={{ color: tokens.foregroundSubtle }}>
          {note}
        </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40, gap: 10 },
  heading: { gap: 2, marginBottom: 2 },
  search: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  filterLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { width: 62 },
  filterRail: { flexDirection: 'row', gap: 6 },
  filterChip: {
    minHeight: 31,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 9,
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: {
    flex: 1,
    minWidth: '46%',
    minHeight: 91,
    padding: 10,
    borderWidth: 1,
    borderRadius: 13,
    gap: 4,
  },
  metricIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  card: {
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    gap: 8,
  },
  usageRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  usageLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderWidth: 1,
    borderRadius: 11,
    marginBottom: 3,
  },
  insightIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  performanceTitle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  performanceAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 5,
  },
});
