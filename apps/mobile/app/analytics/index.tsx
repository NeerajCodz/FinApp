import React, { Component, useMemo, useState } from 'react';
import { Alert, Share, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  aggregateAnalytics,
  getAnalyticsRange,
  UNCATEGORIZED_ID,
  type AnalyticsBreakdownItem,
  type AnalyticsPeriod,
} from '@convex/analytics/domain';
import { ArrowLeft, ArrowRight } from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart, BreakdownDonut, CashFlowChart } from '@finapp/ui/analytics';
import { BudgetProgress, Metric, MetricPair, TransactionRow } from '@finapp/ui/finance';
import {
  Button,
  Empty,
  IconButton,
  SectionHeader,
  Tabs,
  Text,
  Typography,
  useTheme,
} from '@finapp/ui/native';
import { formatMinor } from '@/lib/money';
import { exportCsv } from '@/lib/export/csv';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import {
  analyticsEntities,
  displayAccountName,
  ledgerTransaction,
  recordId,
  recordIndex,
  transactionRow,
} from '@/lib/ledger';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type AnalyticsProps = { children: React.ReactNode };
type AnalyticsState = { hasError: boolean };
type BudgetRecord = LocalRecord & {
  name: string;
  amountMinor: bigint;
  currency: string;
  startAt: number;
  endAt: number;
  categoryId?: string;
  accountId?: string;
  archivedAt?: number;
};
type AnalyticsType = 'all' | 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';

type FilterOption = { id: string; label: string };

class AnalyticsErrorBoundary extends Component<AnalyticsProps, AnalyticsState> {
  state: AnalyticsState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <Typography variant="heading">Analytics couldn’t load</Typography>
          <Text>Check your saved data and try again.</Text>
          <Button onPress={() => this.setState({ hasError: false })}>Try again</Button>
        </View>
      );
    return this.props.children;
  }
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        gap: 14,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.surfaceSubtle,
      }}
    >
      <SectionHeader title={title} action={action} />
      {children}
    </View>
  );
}

function FilterRail({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (id: string) => void;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Typography variant="caption">{label}</Typography>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
          {options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={option.id === value ? 'primary' : 'outline'}
              onPress={() => onChange(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RankedBreakdown({
  items,
  totalMinor,
  currency,
  onSelect,
}: {
  items: readonly AnalyticsBreakdownItem[];
  totalMinor: bigint;
  currency: string;
  onSelect: (item: AnalyticsBreakdownItem) => void;
}) {
  const { tokens } = useTheme();
  if (!items.length)
    return <Typography variant="small">No posted expenses match this period and filter.</Typography>;
  return (
    <View style={{ gap: 4 }}>
      {items.map((item, index) => {
        const share = totalMinor > 0n ? Number((item.amountMinor * 1000n) / totalMinor) / 10 : 0;
        return (
          <TouchableOpacity
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${formatMinor(item.amountMinor, currency)}, ${share}% of spending`}
            onPress={() => onSelect(item)}
            activeOpacity={0.65}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}
          >
            <Typography variant="caption" style={{ color: tokens.primary, width: 20 }}>
              {String(index + 1).padStart(2, '0')}
            </Typography>
            <Typography variant="small" numberOfLines={2} style={{ flex: 1, color: tokens.foreground }}>
              {item.label}
            </Typography>
            <View style={{ alignItems: 'flex-end' }}>
              <Typography variant="small" style={{ color: tokens.foreground }}>
                {formatMinor(item.amountMinor, currency)}
              </Typography>
              <Typography variant="caption">{share}%</Typography>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function localRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function chartValues(amounts: readonly bigint[]) {
  const maximum = amounts.reduce((largest, amount) => (amount > largest ? amount : largest), 0n);
  return amounts.map((amount) => (maximum > 0n ? Number((amount * 10000n) / maximum) / 10000 : 0));
}

function AnalyticsContent() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [referenceAt, setReferenceAt] = useState(() => Date.now());
  const [typeFilter, setTypeFilter] = useState<AnalyticsType>('all');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange, isConnected } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const budgetState = useLocalRecords<BudgetRecord>(userId, 'budget');
  const recurringState = useLocalRecords<LocalRecord>(userId, 'recurringRule');
  const groupState = useLocalRecords<LocalRecord>(userId, 'group');
  const settlementState = useLocalRecords<LocalRecord>(userId, 'settlement');
  const profile = profileState.data?.[0];
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  const defaultCurrency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const currency = currencyFilter || defaultCurrency;
  const range = useMemo(
    () => getAnalyticsRange(period, referenceAt, timeZone),
    [period, referenceAt, timeZone],
  );
  const rangeState = useLocalTransactionRange<LocalRecord>(
    userId,
    range.previousStartAt,
    range.endAt,
    fetchTransactionRange,
  );
  const currencyOptions = useMemo<FilterOption[]>(() => {
    const currencies = new Set([defaultCurrency, currency]);
    for (const record of rangeState.data ?? []) {
      const transaction = ledgerTransaction(record);
      if (transaction?.currency) currencies.add(transaction.currency);
    }
    return [...currencies].map((code) => ({ id: code, label: code }));
  }, [defaultCurrency, currency, rangeState.data]);
  const activeBudgets = useMemo(
    () =>
      (budgetState.data ?? []).filter(
        (budget) =>
          budget.archivedAt === undefined &&
          typeof budget.name === 'string' &&
          typeof budget.amountMinor === 'bigint' &&
          typeof budget.currency === 'string' &&
          typeof budget.startAt === 'number' &&
          typeof budget.endAt === 'number' &&
          budget.startAt < budget.endAt,
      ),
    [budgetState.data],
  );
  const relevantBudgets = useMemo(
    () =>
      activeBudgets.filter(
        (budget) => budget.startAt < range.endAt && budget.endAt > range.startAt,
      ),
    [activeBudgets, range.startAt, range.endAt],
  );
  const budgetWindow = useMemo(
    () =>
      relevantBudgets.length
        ? {
            startAt: Math.min(...relevantBudgets.map((budget) => budget.startAt)),
            endAt: Math.max(...relevantBudgets.map((budget) => budget.endAt)),
          }
        : { startAt: range.startAt, endAt: range.endAt },
    [relevantBudgets, range.startAt, range.endAt],
  );
  const budgetRangeState = useLocalTransactionRange<LocalRecord>(
    userId,
    budgetWindow.startAt,
    budgetWindow.endAt,
    fetchTransactionRange,
  );
  const accounts = useMemo(() => recordIndex(accountState.data ?? []), [accountState.data]);
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
  const accountOptions = useMemo<FilterOption[]>(
    () => [
      { id: 'all', label: 'All accounts' },
      ...(accountState.data ?? [])
        .filter((account) => account.archivedAt === undefined)
        .flatMap((account) => {
          const id = recordId(account);
          return id && typeof account.name === 'string'
            ? [{ id, label: displayAccountName(account.name) }]
            : [];
        }),
    ],
    [accountState.data],
  );
  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      { id: 'all', label: 'All categories' },
      ...(categoryState.data ?? []).flatMap((category) => {
        const id = recordId(category);
        return id && typeof category.name === 'string' ? [{ id, label: category.name }] : [];
      }),
    ],
    [categoryState.data],
  );
  const typeOptions: FilterOption[] = [
    { id: 'all', label: 'All types' },
    { id: 'expense', label: 'Expenses' },
    { id: 'income', label: 'Income' },
    { id: 'transfer', label: 'Transfers' },
    { id: 'refund', label: 'Refunds' },
    { id: 'adjustment', label: 'Adjustments' },
  ];
  const filteredRecords = useMemo(() => {
    if (!rangeState.data) return [];
    return rangeState.data.filter((record) => {
      const transaction = ledgerTransaction(record);
      if (!transaction) return false;
      if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
      if (
        accountFilter !== 'all' &&
        recordId(accounts.get(transaction.accountId ?? '') ?? {}) !== accountFilter
      )
        return false;
      if (
        categoryFilter !== 'all' &&
        recordId(categories.get(transaction.categoryId ?? '') ?? {}) !== categoryFilter
      )
        return false;
      return true;
    });
  }, [rangeState.data, typeFilter, accountFilter, categoryFilter, accounts, categories]);
  const analytics = useMemo(() => {
    if (!profile || !categoryState.data || !accountState.data || !rangeState.data) return null;
    const transactions = filteredRecords.flatMap((record) => {
      const transaction = ledgerTransaction(record);
      return transaction ? [transaction] : [];
    });
    const categoriesForAnalytics = analyticsEntities(categoryState.data);
    const accountsForAnalytics = analyticsEntities(accountState.data);
    const current = aggregateAnalytics(
      transactions,
      categoriesForAnalytics,
      currency,
      period,
      range.startAt,
      range.endAt,
      timeZone,
      accountsForAnalytics,
    );
    const previous = aggregateAnalytics(
      transactions,
      categoriesForAnalytics,
      currency,
      period,
      range.previousStartAt,
      range.startAt,
      timeZone,
      accountsForAnalytics,
    );
    return { ...current, previousSpentMinor: previous.spentMinor };
  }, [
    profile,
    categoryState.data,
    accountState.data,
    rangeState.data,
    filteredRecords,
    currency,
    period,
    range,
    timeZone,
  ]);
  const currentRecords = useMemo(
    () =>
      filteredRecords.filter((record) => {
        const transaction = ledgerTransaction(record);
        return (
          transaction &&
          transaction.occurredAt >= range.startAt &&
          transaction.occurredAt < range.endAt
        );
      }),
    [filteredRecords, range.startAt, range.endAt],
  );
  const postedCurrentRecords = useMemo(
    () =>
      currentRecords.filter((record) => {
        const transaction = ledgerTransaction(record);
        return (
          transaction?.status === 'posted' &&
          transaction.deletedAt === undefined &&
          transaction.currency === currency
        );
      }),
    [currentRecords, currency],
  );
  const transactionCount = postedCurrentRecords.length;
  const exportRows = useMemo(
    () =>
      postedCurrentRecords.flatMap((record) => {
        const transaction = ledgerTransaction(record);
        if (!transaction) return [];
        const accountName = accounts.get(transaction.accountId ?? '')?.name;
        return [
          {
            date: new Date(transaction.occurredAt).toISOString(),
            type: transaction.type,
            title: transaction.title ?? '',
            merchant: transaction.merchant ?? '',
            category: categories.get(transaction.categoryId ?? '')?.name ?? '',
            account: typeof accountName === 'string' ? displayAccountName(accountName) : '',
            amount: formatMinor(
              transaction.type === 'expense' ? -transaction.amountMinor : transaction.amountMinor,
              transaction.currency,
            ),
            currency: transaction.currency,
          },
        ];
      }),
    [postedCurrentRecords, categories, accounts],
  );
  const exportAnalytics = () => {
    const csv = exportCsv(exportRows);
    if (!csv) {
      Alert.alert('Nothing to export', 'No posted transactions match this range and filter.');
      return;
    }
    void Share.share({ title: 'Analytics export', message: csv }).catch(() => {
      Alert.alert('Export failed', 'Your device could not open a share sheet.');
    });
  };
  const flowTotals = useMemo(() => {
    const totals = { spend: 0n, income: 0n, transfer: 0n, split: 0n, other: 0n };
    for (const record of postedCurrentRecords) {
      const transaction = ledgerTransaction(record);
      if (!transaction) continue;
      if (transaction.type === 'expense') {
        if (typeof record.groupId === 'string') totals.split += transaction.amountMinor;
        else totals.spend += transaction.amountMinor;
      } else if (transaction.type === 'income') totals.income += transaction.amountMinor;
      else if (transaction.type === 'transfer') totals.transfer += transaction.amountMinor;
      else totals.other += transaction.amountMinor;
    }
    return totals;
  }, [postedCurrentRecords]);
  const flowRows = [
    { key: 'spend', label: 'Personal expenses', amountMinor: flowTotals.spend, color: tokens.expense },
    { key: 'income', label: 'Income', amountMinor: flowTotals.income, color: tokens.income },
    { key: 'transfer', label: 'Transfers', amountMinor: flowTotals.transfer, color: tokens.transfer },
    { key: 'split', label: 'Shared expenses', amountMinor: flowTotals.split, color: tokens.split },
    { key: 'other', label: 'Refunds and adjustments', amountMinor: flowTotals.other, color: tokens.settlement },
  ];
  const groupExpenses = useMemo(
    () =>
      postedCurrentRecords.filter((record) => {
        const transaction = ledgerTransaction(record);
        return transaction?.type === 'expense' && typeof record.groupId === 'string';
      }),
    [postedCurrentRecords],
  );
  const settlements = useMemo(
    () =>
      (settlementState.data ?? [])
        .filter((record) => {
          const at = typeof record.occurredAt === 'number' ? record.occurredAt : record.createdAt;
          return (
            typeof record.amountMinor === 'bigint' &&
            record.currency === currency &&
            typeof at === 'number' &&
            at >= range.startAt &&
            at < range.endAt &&
            record.deletedAt === undefined
          );
        })
        .sort((left, right) => {
          const leftAt = typeof left.occurredAt === 'number' ? left.occurredAt : Number(left.createdAt);
          const rightAt = typeof right.occurredAt === 'number' ? right.occurredAt : Number(right.createdAt);
          return rightAt - leftAt;
        }),
    [settlementState.data, currency, range.startAt, range.endAt],
  );
  const settlementsMinor = settlements.reduce(
    (sum, settlement) => sum + (typeof settlement.amountMinor === 'bigint' ? settlement.amountMinor : 0n),
    0n,
  );
  const groups = (groupState.data ?? []).filter((group) => group.archivedAt === undefined);
  const groupIndex = useMemo(() => recordIndex(groups), [groups]);
  const budgetProgress = useMemo(() => {
    const records = budgetRangeState.data ?? [];
    return relevantBudgets.map((budget) => {
      const spentMinor = records.reduce((sum, record) => {
        const transaction = ledgerTransaction(record);
        if (
          !transaction ||
          transaction.type !== 'expense' ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined ||
          transaction.currency !== budget.currency ||
          transaction.occurredAt < budget.startAt ||
          transaction.occurredAt >= budget.endAt
        )
          return sum;
        if (budget.categoryId) {
          const transactionCategory = categories.get(transaction.categoryId ?? '');
          const budgetCategory = categories.get(budget.categoryId);
          const matches = transactionCategory && budgetCategory
            ? recordId(transactionCategory) === recordId(budgetCategory)
            : transaction.categoryId === budget.categoryId;
          if (!matches) return sum;
        }
        if (budget.accountId) {
          const transactionAccount = accounts.get(transaction.accountId ?? '');
          const budgetAccount = accounts.get(budget.accountId);
          const matches = transactionAccount && budgetAccount
            ? recordId(transactionAccount) === recordId(budgetAccount)
            : transaction.accountId === budget.accountId;
          if (!matches) return sum;
        }
        return sum + transaction.amountMinor;
      }, 0n);
      return { budget, spentMinor };
    });
  }, [relevantBudgets, budgetRangeState.data, categories, accounts]);
  const recurringRules = (recurringState.data ?? [])
    .filter((rule) => rule.enabled === true && rule.deletedAt === undefined)
    .slice()
    .sort((left, right) => Number(left.nextOccurrence ?? 0) - Number(right.nextOccurrence ?? 0));
  const topTransactions = useMemo(() => {
    const preferredType = typeFilter === 'all' ? 'expense' : typeFilter;
    return postedCurrentRecords
      .filter((record) => ledgerTransaction(record)?.type === preferredType)
      .sort((left, right) => {
        const leftAmount = ledgerTransaction(left)?.amountMinor ?? 0n;
        const rightAmount = ledgerTransaction(right)?.amountMinor ?? 0n;
        return leftAmount === rightAmount ? 0 : rightAmount > leftAmount ? 1 : -1;
      })
      .slice(0, 5);
  }, [postedCurrentRecords, typeFilter]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of postedCurrentRecords) {
      const transaction = ledgerTransaction(record);
      if (transaction?.type !== 'expense') continue;
      const category = categories.get(transaction.categoryId ?? '');
      const key = category ? recordId(category) : UNCATEGORIZED_ID;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [postedCurrentRecords, categories]);
  const error =
    profileState.error ||
    categoryState.error ||
    accountState.error ||
    rangeState.error ||
    budgetState.error ||
    budgetRangeState.error ||
    recurringState.error ||
    groupState.error ||
    settlementState.error;
  const hasRangeData = rangeState.covered || Boolean(rangeState.data?.length);
  const ready =
    !!profile &&
    !!categoryState.data &&
    !!accountState.data &&
    !!rangeState.data &&
    hasRangeData;
  const retry = () => {
    profileState.retry();
    categoryState.retry();
    accountState.retry();
    rangeState.retry();
    budgetState.retry();
    budgetRangeState.retry();
    recurringState.retry();
    groupState.retry();
    settlementState.retry();
  };
  const navigate = (dimension: 'category' | 'account' | 'merchant', item: AnalyticsBreakdownItem) => {
    router.push({
      pathname: '/analytics/breakdown/[dimension]',
      params: {
        dimension,
        key: item.id,
        period,
        startAt: String(range.startAt),
        endAt: String(range.endAt),
      },
    });
  };
  const comparison = analytics
    ? analytics.previousSpentMinor === 0n
      ? analytics.spentMinor === 0n
        ? 'No spending in either period'
        : 'No spending in the previous period'
      : `${analytics.spentMinor >= analytics.previousSpentMinor ? 'Up' : 'Down'} ${(
          ((analytics.spentMinor >= analytics.previousSpentMinor
            ? analytics.spentMinor - analytics.previousSpentMinor
            : analytics.previousSpentMinor - analytics.spentMinor) *
            100n) /
          analytics.previousSpentMinor
        ).toString()}% vs previous period`
    : '';
  const savingsRate = analytics
    ? analytics.incomeMinor === 0n
      ? '—'
      : `${Number(((analytics.incomeMinor - analytics.spentMinor) * 1000n) / analytics.incomeMinor) / 10}%`
    : '—';
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' }),
    [timeZone],
  );
  const rangeLabel = `${dateFormatter.format(range.startAt)} – ${dateFormatter.format(range.endAt - 1)}`;
  const trendBuckets = analytics?.buckets ?? [];
  const trendStride = Math.max(1, Math.ceil(trendBuckets.length / 7));
  const trendLabels = trendBuckets.map((bucket, index) => {
    if (index % trendStride !== 0 && index !== trendBuckets.length - 1) return '';
    if (period === 'year') return bucket.label;
    return period === 'week'
      ? bucket.label.split(' ')[0] ?? bucket.label
      : bucket.label.split(' ').at(-1) ?? bucket.label;
  });
  const currentBucket = trendBuckets.findIndex(
    (bucket) => Date.now() >= bucket.startAt && Date.now() < bucket.endAt,
  );
  const sharedExpenseMinor = groupExpenses.reduce((sum, record) => {
    const transaction = ledgerTransaction(record);
    return sum + (transaction?.amountMinor ?? 0n);
  }, 0n);
  const settlementDate = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 48,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="title">Analytics</Typography>
          <Typography variant="caption">A closer look at your local ledger</Typography>
        </View>
        <Button size="sm" variant="outline" onPress={exportAnalytics}>Export</Button>
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton
            label="Previous period"
            variant="ghost"
            onPress={() => setReferenceAt(range.previousStartAt + 1)}
          >
            <ArrowLeft size={18} color={tokens.foreground} />
          </IconButton>
          <Typography variant="caption">{rangeLabel} · {currency}</Typography>
          <IconButton
            label="Next period"
            variant="ghost"
            onPress={() => setReferenceAt(range.endAt)}
          >
            <ArrowRight size={18} color={tokens.foreground} />
          </IconButton>
        </View>
        <Tabs
          value={period}
          onChange={(value) => {
            setPeriod(value as AnalyticsPeriod);
            setReferenceAt(Date.now());
          }}
          tabs={[
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' },
          ]}
        />
        <FilterRail
          label="TYPE"
          value={typeFilter}
          options={typeOptions}
          onChange={(value) => setTypeFilter(value as AnalyticsType)}
        />
        <FilterRail
          label="ACCOUNT"
          value={accountFilter}
          options={accountOptions}
          onChange={setAccountFilter}
        />
        <FilterRail
          label="CATEGORY"
          value={categoryFilter}
          options={categoryOptions}
          onChange={setCategoryFilter}
        />
        <FilterRail
          label="CURRENCY"
          value={currency}
          options={currencyOptions}
          onChange={setCurrencyFilter}
        />
      </View>
      {!isConnected && ready && (
        <Typography variant="caption">Offline · showing records saved on this device.</Typography>
      )}
      {error && (
        <View style={{ gap: 10 }} accessibilityRole="alert">
          <Typography variant="small">
            {analytics && hasRangeData
              ? 'Showing saved data. Refresh failed; some summaries may be incomplete.'
              : 'Analytics data is unavailable.'}
          </Typography>
          <Button onPress={retry}>Retry</Button>
        </View>
      )}
      {rangeState.refreshing && <Typography variant="caption">Refreshing transactions…</Typography>}
      {!userId || (profileState.data && !profile) ? (
        <Empty title="Analytics unavailable" description="Sign in to see your spending and income." />
      ) : (!analytics || !hasRangeData) && !error ? (
        <Typography variant="heading" accessibilityLabel="Loading analytics">
          Loading analytics…
        </Typography>
      ) : (
        analytics &&
        hasRangeData && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: 'Spent', value: formatMinor(analytics.spentMinor, currency), color: tokens.expense },
                { label: 'Income', value: formatMinor(analytics.incomeMinor, currency), color: tokens.income },
                {
                  label: 'Net cash flow',
                  value: formatMinor(analytics.incomeMinor - analytics.spentMinor, currency),
                  color: analytics.incomeMinor >= analytics.spentMinor ? tokens.income : tokens.expense,
                },
                { label: 'Savings rate', value: savingsRate, color: tokens.primary },
                { label: 'Transactions', value: String(transactionCount), color: tokens.foreground },
              ].map((item) => (
                <View
                  key={item.label}
                  style={{
                    flexGrow: 1,
                    flexBasis: '46%',
                    minWidth: 142,
                    gap: 8,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <Metric label={item.label} value={item.value} />
                  <View style={{ height: 2, width: 30, borderRadius: 2, backgroundColor: item.color }} />
                </View>
              ))}
            </View>
            <Panel title="Cash flow">
              <CashFlowChart
                variant="lines"
                buckets={analytics.buckets}
                currency={currency}
                onSelectBucket={(bucket) =>
                  router.push({
                    pathname: '/(tabs)/activity',
                    params: {
                      period,
                      startAt: String(bucket.startAt),
                      endAt: String(bucket.endAt),
                    },
                  } as never)
                }
              />
            </Panel>
            <Panel title={period === 'year' ? 'Monthly spending trend' : 'Daily spending trend'}>
              {analytics.buckets.some((bucket) => bucket.amountMinor > 0n) ? (
                <BarChart
                  values={chartValues(analytics.buckets.map((bucket) => bucket.amountMinor))}
                  labels={trendLabels}
                  highlightIndex={currentBucket >= 0 ? currentBucket : undefined}
                />
              ) : (
                <Typography variant="small">No posted expenses to chart in this period.</Typography>
              )}
            </Panel>
            <Panel title="Spending by category">
              <BreakdownDonut
                items={analytics.categoryBreakdown}
                totalMinor={analytics.spentMinor}
                currency={currency}
                iconForCategory={(id) => {
                  const icon = categories.get(id)?.icon;
                  return typeof icon === 'string' ? icon : undefined;
                }}
                onSelectItem={(item) => navigate('category', item)}
              />
            </Panel>
            <Panel title="Accounts · posted spending">
              <RankedBreakdown
                items={analytics.accountBreakdown}
                totalMinor={analytics.spentMinor}
                currency={currency}
                onSelect={(item) => navigate('account', item)}
              />
            </Panel>
            <Panel title="Transaction mix">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {flowRows.map((item) => (
                  <View
                    key={item.key}
                    style={{
                      minWidth: '46%',
                      flexGrow: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 5, backgroundColor: item.color }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Typography variant="caption">{item.label}</Typography>
                      <Typography variant="small" style={{ color: tokens.foreground }}>
                        {formatMinor(item.amountMinor, currency)}
                      </Typography>
                    </View>
                  </View>
                ))}
              </View>
              <Typography variant="caption">Shared expenses are also included in total spent.</Typography>
            </Panel>
            <Panel title="Compared with last period">
              <Typography variant="heading">{comparison}</Typography>
              <Text style={{ color: tokens.foregroundMuted }}>
                Previously spent {formatMinor(analytics.previousSpentMinor, currency)}
              </Text>
            </Panel>
            <Panel
              title="Budgets"
              action={
                <Button size="sm" variant="ghost" onPress={() => router.push('/budget' as never)}>
                  View all
                </Button>
              }
            >
              {budgetState.loading || (relevantBudgets.length > 0 && budgetRangeState.loading) ? (
                <Typography variant="small">Loading saved budgets…</Typography>
              ) : budgetProgress.length ? (
                <View style={{ gap: 18 }}>
                  {budgetProgress.slice(0, 4).map(({ budget, spentMinor }) => {
                    const id = recordId(budget);
                    return (
                      <TouchableOpacity
                        key={id || budget.name}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${budget.name} budget`}
                        onPress={() => id && router.push({ pathname: '/budget/[id]', params: { id } } as never)}
                        activeOpacity={0.75}
                      >
                        <BudgetProgress
                          title={budget.name}
                          spentMinor={spentMinor}
                          limitMinor={budget.amountMinor}
                          currency={budget.currency}
                          primary
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : budgetState.data ? (
                <Empty
                  title="No active budgets"
                  description="Saved budget progress will appear here."
                  action={
                    <Button size="sm" variant="outline" onPress={() => router.push('/budget/new' as never)}>
                      Create budget
                    </Button>
                  }
                />
              ) : (
                <Typography variant="small">Saved budget data is unavailable.</Typography>
              )}
            </Panel>
            <Panel
              title="Recurring"
              action={
                <Button size="sm" variant="ghost" onPress={() => router.push('/recurring' as never)}>
                  View all
                </Button>
              }
            >
              {recurringState.loading ? (
                <Typography variant="small">Loading saved reminders…</Typography>
              ) : recurringState.data ? (
                recurringRules.length ? (
                  <View style={{ gap: 10 }}>
                    <Typography variant="caption">{recurringRules.length} active reminders</Typography>
                    {recurringRules.slice(0, 4).map((rule) => {
                      const template = localRecord(rule.template);
                      const amount = template?.amountMinor;
                      const templateCurrency = template?.currency;
                      const next = typeof rule.nextOccurrence === 'number' ? rule.nextOccurrence : undefined;
                      const dueLabel = next
                        ? new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }).format(next)
                        : 'Date not set';
                      return (
                        <View
                          key={recordId(rule) || String(rule.name)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderColor: tokens.borderSubtle,
                          }}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Typography variant="bodyLarge" numberOfLines={1}>
                              {typeof rule.name === 'string' ? rule.name : 'Recurring reminder'}
                            </Typography>
                            <Typography variant="caption">
                              {typeof rule.frequency === 'string' ? rule.frequency : 'Scheduled'} · next {dueLabel}
                            </Typography>
                          </View>
                          {typeof amount === 'bigint' && typeof templateCurrency === 'string' && (
                            <Typography variant="small" style={{ color: tokens.foreground }}>
                              {formatMinor(amount, templateCurrency)}
                            </Typography>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Empty
                    title="No active reminders"
                    description="Upcoming recurring rules will appear here."
                    action={
                      <Button size="sm" variant="outline" onPress={() => router.push('/recurring' as never)}>
                        Open recurring
                      </Button>
                    }
                  />
                )
              ) : (
                <Typography variant="small">Saved recurring data is unavailable.</Typography>
              )}
            </Panel>
            <Panel
              title="Groups, splits & settlements"
              action={
                <Button size="sm" variant="ghost" onPress={() => router.push('/(tabs)/groups' as never)}>
                  View groups
                </Button>
              }
            >
              <MetricPair
                left={{ label: 'Active groups', value: String(groups.length) }}
                right={{ label: 'Shared expenses', value: formatMinor(sharedExpenseMinor, currency) }}
              />
              <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Typography variant="caption">Settlements in this period</Typography>
                <Typography variant="small" style={{ color: tokens.foreground }}>
                  {formatMinor(settlementsMinor, currency)} · {settlements.length}
                </Typography>
              </View>
              {groupExpenses.length === 0 && settlements.length === 0 ? (
                <Typography variant="small">No shared expenses or settlements in this period.</Typography>
              ) : (
                <View style={{ gap: 2 }}>
                  {groupExpenses.slice().sort((left, right) => Number(right.occurredAt) - Number(left.occurredAt)).slice(0, 3).map((record) => {
                    const transaction = ledgerTransaction(record);
                    const groupId = typeof record.groupId === 'string' ? record.groupId : '';
                    const group = groupIndex.get(groupId);
                    const groupName = typeof group?.name === 'string' ? group.name : 'Shared expense';
                    return (
                      <TouchableOpacity
                        key={recordId(record)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${groupName}`}
                        onPress={() => groupId && router.push({ pathname: '/group/[id]', params: { id: groupId } } as never)}
                        activeOpacity={0.75}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Typography variant="small" style={{ color: tokens.foreground }} numberOfLines={1}>
                            {transaction?.title || transaction?.merchant || groupName}
                          </Typography>
                          <Typography variant="caption">{groupName}</Typography>
                        </View>
                        <Typography variant="small" style={{ color: tokens.foreground }}>
                          {transaction ? formatMinor(transaction.amountMinor, transaction.currency) : ''}
                        </Typography>
                      </TouchableOpacity>
                    );
                  })}
                  {settlements.slice(0, 3).map((record) => {
                    const at = typeof record.occurredAt === 'number' ? record.occurredAt : Number(record.createdAt);
                    const groupId = typeof record.groupId === 'string' ? record.groupId : '';
                    const group = groupIndex.get(groupId);
                    const groupName = typeof group?.name === 'string' ? group.name : 'Settlement';
                    return (
                      <TouchableOpacity
                        key={recordId(record)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${groupName} settlement`}
                        onPress={() => groupId && router.push({ pathname: '/group/[id]', params: { id: groupId } } as never)}
                        activeOpacity={0.75}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Typography variant="small" style={{ color: tokens.foreground }}>{groupName} settlement</Typography>
                          <Typography variant="caption">{settlementDate.format(at)}</Typography>
                        </View>
                        <Typography variant="small" style={{ color: tokens.primary }}>
                          {typeof record.amountMinor === 'bigint' ? formatMinor(record.amountMinor, currency) : ''}
                        </Typography>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {groupState.error || settlementState.error ? (
                <Typography variant="caption">Some saved group or settlement records are unavailable.</Typography>
              ) : null}
            </Panel>
            <Panel title={typeFilter === 'income' ? 'Top income' : 'Top transactions'}>
              {topTransactions.length ? (
                topTransactions.map((record) => {
                  const row = transactionRow(record, accounts, categories, timeZone);
                  const id = recordId(record);
                  return row && id ? (
                    <TransactionRow
                      key={id}
                      {...row}
                      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id } })}
                    />
                  ) : null;
                })
              ) : (
                <Empty
                  title={typeFilter === 'income' ? 'No income yet' : 'No transactions to rank'}
                  description="Posted transactions matching this period and filter will appear here."
                />
              )}
            </Panel>
            <Panel title="Top merchants">
              <RankedBreakdown
                items={analytics.merchantBreakdown}
                totalMinor={analytics.spentMinor}
                currency={currency}
                onSelect={(item) => navigate('merchant', item)}
              />
            </Panel>
            <Panel title="Category breakdown">
              {analytics.categoryBreakdown.length ? (
                <View style={{ gap: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 8,
                      paddingBottom: 8,
                      borderBottomWidth: 1,
                      borderColor: tokens.borderSubtle,
                    }}
                  >
                    <Typography variant="caption" style={{ flex: 1 }}>Category</Typography>
                    <Typography variant="caption" style={{ width: 46, textAlign: 'right' }}>Count</Typography>
                    <Typography variant="caption" style={{ width: 88, textAlign: 'right' }}>Amount</Typography>
                  </View>
                  {analytics.categoryBreakdown.map((item) => {
                    const share = analytics.spentMinor > 0n
                      ? Number((item.amountMinor * 1000n) / analytics.spentMinor) / 10
                      : 0;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${item.label} category, ${formatMinor(item.amountMinor, currency)}, ${share}% of spending`}
                        onPress={() => navigate('category', item)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          minHeight: 48,
                          borderBottomWidth: 1,
                          borderColor: tokens.borderSubtle,
                        }}
                      >
                        <Typography variant="small" numberOfLines={1} style={{ flex: 1, color: tokens.foreground }}>
                          {item.label}
                        </Typography>
                        <Typography variant="caption" style={{ width: 46, textAlign: 'right' }}>
                          {categoryCounts.get(item.id) ?? 0}
                        </Typography>
                        <View style={{ width: 88, alignItems: 'flex-end' }}>
                          <Typography variant="small" style={{ color: tokens.foreground }} numberOfLines={1}>
                            {formatMinor(item.amountMinor, currency)}
                          </Typography>
                          <Typography variant="caption">{share}%</Typography>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Typography variant="small">No posted expenses to break down.</Typography>
              )}
            </Panel>
          </>
        )
      )}
    </ScrollView>
  );
}

export default function AnalyticsScreen() {
  return (
    <AnalyticsErrorBoundary>
      <AnalyticsContent />
    </AnalyticsErrorBoundary>
  );
}
