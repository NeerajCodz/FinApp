import React, { Component, useMemo, useState } from 'react';
import { Alert, Share, ScrollView, TouchableOpacity, View } from 'react-native';
import {
  aggregateAnalytics,
  getAnalyticsCalendarDate,
  getAnalyticsCustomRange,
  getAnalyticsRange,
  UNCATEGORIZED_ID,
  type AnalyticsBreakdownItem,
  type AnalyticsPeriod,
} from '@convex/analytics/domain';
import { ArrowLeft, ArrowRight } from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart, BreakdownDonut, CashFlowChart, SpendingLineChart } from '@finapp/ui/analytics';
import { DateRangePopover } from '@finapp/ui/activity';
import { BudgetProgress, Metric, MetricPair, TransactionRow } from '@finapp/ui/finance';
import {
  Button,
  Empty,
  FilterSheet,
  IconButton,
  QuickFiltersPopover,
  SectionHeader,
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
  recordIds,
  recordIndex,
  transactionRow,
} from '@/lib/ledger';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const periodOptions = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

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
    return (
      <Typography variant="small">No posted expenses match this period and filter.</Typography>
    );
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
            <Typography
              variant="small"
              numberOfLines={2}
              style={{ flex: 1, color: tokens.foreground }}
            >
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
  const [customRange, setCustomRange] = useState<{ startAt: number; endAt: number } | null>(null);
  const [referenceAt, setReferenceAt] = useState(() => Date.now());
  const [typeFilter, setTypeFilter] = useState<AnalyticsType>('all');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cashFlowChartType, setCashFlowChartType] = useState<'lines' | 'bars'>('lines');
  const [categoryChartType, setCategoryChartType] = useState<'donut' | 'bars'>('donut');
  const [dailyChartType, setDailyChartType] = useState<'bars' | 'line'>('bars');
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
  const transactionState = useLocalRecords<LocalRecord>(userId, 'transaction');
  const profile = profileState.data?.[0];
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  const defaultCurrency =
    typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const currency = currencyFilter || defaultCurrency;
  const range = useMemo(() => {
    if (customRange) {
      const duration = customRange.endAt - customRange.startAt;
      return { ...customRange, previousStartAt: customRange.startAt - duration };
    }
    return getAnalyticsRange(period, referenceAt, timeZone);
  }, [customRange, period, referenceAt, timeZone]);
  const rangeState = useLocalTransactionRange<LocalRecord>(
    userId,
    range.previousStartAt,
    range.endAt,
    fetchTransactionRange,
  );
  const currencyOptions = useMemo<FilterOption[]>(() => {
    const currencies = new Set<string>([defaultCurrency, currency]);
    const addCurrency = (value: unknown) => {
      if (typeof value === 'string' && value) currencies.add(value);
    };
    for (const record of rangeState.data ?? []) {
      addCurrency(ledgerTransaction(record)?.currency);
    }
    for (const record of transactionState.data ?? []) {
      addCurrency(ledgerTransaction(record)?.currency);
    }
    for (const record of accountState.data ?? []) addCurrency(record.currency);
    for (const record of budgetState.data ?? []) addCurrency(record.currency);
    for (const record of recurringState.data ?? []) {
      addCurrency(localRecord(record.template)?.currency);
    }
    for (const record of groupState.data ?? []) addCurrency(record.currency);
    for (const record of settlementState.data ?? []) addCurrency(record.currency);
    return [...currencies].sort().map((code) => ({ id: code, label: code }));
  }, [
    accountState.data,
    budgetState.data,
    defaultCurrency,
    currency,
    groupState.data,
    rangeState.data,
    transactionState.data,
    recurringState.data,
    settlementState.data,
  ]);
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
        (budget) =>
          budget.currency === currency &&
          budget.startAt < range.endAt &&
          budget.endAt > range.startAt,
      ),
    [activeBudgets, currency, range.startAt, range.endAt],
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
        .filter(
          (account) =>
            account.archivedAt === undefined && (account.currency ?? defaultCurrency) === currency,
        )
        .flatMap((account) => {
          const id = recordId(account);
          return id && typeof account.name === 'string'
            ? [{ id, label: displayAccountName(account.name) }]
            : [];
        }),
    ],
    [accountState.data, currency, defaultCurrency],
  );
  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      { id: 'all', label: 'All categories' },
      ...(categoryState.data ?? [])
        .filter((category) => category.archivedAt === undefined)
        .flatMap((category) => {
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
  const currencyGroupIds = useMemo(
    () =>
      new Set(
        (groupState.data ?? [])
          .filter(
            (group) =>
              group.archivedAt === undefined && (group.currency ?? defaultCurrency) === currency,
          )
          .flatMap(recordIds),
      ),
    [groupState.data, currency, defaultCurrency],
  );
  const flowTotals = useMemo(() => {
    const totals = { spend: 0n, income: 0n, transfer: 0n, split: 0n, other: 0n };
    for (const record of postedCurrentRecords) {
      const transaction = ledgerTransaction(record);
      if (!transaction) continue;
      if (transaction.type === 'expense') {
        if (typeof record.groupId === 'string' && currencyGroupIds.has(record.groupId))
          totals.split += transaction.amountMinor;
        else totals.spend += transaction.amountMinor;
      } else if (transaction.type === 'income') totals.income += transaction.amountMinor;
      else if (transaction.type === 'transfer') totals.transfer += transaction.amountMinor;
      else totals.other += transaction.amountMinor;
    }
    return totals;
  }, [postedCurrentRecords, currencyGroupIds]);
  const flowRows = [
    {
      key: 'spend',
      label: 'Personal expenses',
      amountMinor: flowTotals.spend,
      color: tokens.expense,
    },
    { key: 'income', label: 'Income', amountMinor: flowTotals.income, color: tokens.income },
    {
      key: 'transfer',
      label: 'Transfers',
      amountMinor: flowTotals.transfer,
      color: tokens.transfer,
    },
    { key: 'split', label: 'Shared expenses', amountMinor: flowTotals.split, color: tokens.split },
    {
      key: 'other',
      label: 'Refunds and adjustments',
      amountMinor: flowTotals.other,
      color: tokens.settlement,
    },
  ];
  const groupExpenses = useMemo(
    () =>
      postedCurrentRecords.filter((record) => {
        const transaction = ledgerTransaction(record);
        return (
          transaction?.type === 'expense' &&
          typeof record.groupId === 'string' &&
          currencyGroupIds.has(record.groupId)
        );
      }),
    [postedCurrentRecords, currencyGroupIds],
  );
  const settlements = useMemo(
    () =>
      (settlementState.data ?? [])
        .filter((record) => {
          const at = typeof record.occurredAt === 'number' ? record.occurredAt : record.createdAt;
          const groupId = typeof record.groupId === 'string' ? record.groupId : '';
          return (
            typeof record.amountMinor === 'bigint' &&
            typeof at === 'number' &&
            currencyGroupIds.has(groupId) &&
            record.currency === currency &&
            at >= range.startAt &&
            at < range.endAt &&
            record.deletedAt === undefined &&
            record.status !== 'voided'
          );
        })
        .sort((left, right) => {
          const leftAt =
            typeof left.occurredAt === 'number' ? left.occurredAt : Number(left.createdAt);
          const rightAt =
            typeof right.occurredAt === 'number' ? right.occurredAt : Number(right.createdAt);
          return rightAt - leftAt;
        }),
    [settlementState.data, currency, range.startAt, range.endAt, currencyGroupIds],
  );
  const settlementsMinor = settlements.reduce(
    (sum, settlement) =>
      sum + (typeof settlement.amountMinor === 'bigint' ? settlement.amountMinor : 0n),
    0n,
  );
  const groups = (groupState.data ?? []).filter(
    (group) => group.archivedAt === undefined && (group.currency ?? defaultCurrency) === currency,
  );
  const groupIndex = useMemo(() => recordIndex(groups), [groups]);
  const budgetProgress = useMemo(() => {
    const records = budgetRangeState.data ?? [];
    return relevantBudgets.map((budget) => {
      const spentMinor = records.reduce((sum, record) => {
        const transaction = ledgerTransaction(record);
        if (
          !transaction ||
          transaction.type !== 'expense' ||
          (typeFilter !== 'all' && typeFilter !== 'expense') ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined ||
          transaction.currency !== budget.currency ||
          transaction.occurredAt < range.startAt ||
          transaction.occurredAt >= range.endAt ||
          (accountFilter !== 'all' &&
            recordId(accounts.get(transaction.accountId ?? '') ?? {}) !== accountFilter) ||
          (categoryFilter !== 'all' &&
            recordId(categories.get(transaction.categoryId ?? '') ?? {}) !== categoryFilter) ||
          transaction.occurredAt < budget.startAt ||
          transaction.occurredAt >= budget.endAt
        )
          return sum;
        if (budget.categoryId) {
          const transactionCategory = categories.get(transaction.categoryId ?? '');
          const budgetCategory = categories.get(budget.categoryId);
          const matches =
            transactionCategory && budgetCategory
              ? recordId(transactionCategory) === recordId(budgetCategory)
              : transaction.categoryId === budget.categoryId;
          if (!matches) return sum;
        }
        if (budget.accountId) {
          const transactionAccount = accounts.get(transaction.accountId ?? '');
          const budgetAccount = accounts.get(budget.accountId);
          const matches =
            transactionAccount && budgetAccount
              ? recordId(transactionAccount) === recordId(budgetAccount)
              : transaction.accountId === budget.accountId;
          if (!matches) return sum;
        }
        return sum + transaction.amountMinor;
      }, 0n);
      return { budget, spentMinor };
    });
  }, [
    relevantBudgets,
    budgetRangeState.data,
    categories,
    accounts,
    typeFilter,
    accountFilter,
    categoryFilter,
    range.startAt,
    range.endAt,
  ]);
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
    transactionState.error ||
    rangeState.error ||
    budgetState.error ||
    budgetRangeState.error ||
    recurringState.error ||
    groupState.error ||
    settlementState.error;
  const hasRangeData = rangeState.covered || Boolean(rangeState.data?.length);
  const ready =
    !!profile && !!categoryState.data && !!accountState.data && !!rangeState.data && hasRangeData;
  const retry = () => {
    profileState.retry();
    categoryState.retry();
    accountState.retry();
    transactionState.retry();
    rangeState.retry();
    budgetState.retry();
    budgetRangeState.retry();
    recurringState.retry();
    groupState.retry();
    settlementState.retry();
  };
  const navigate = (
    dimension: 'category' | 'account' | 'merchant',
    item: AnalyticsBreakdownItem,
  ) => {
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
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [timeZone],
  );
  const rangeLabel = `${dateFormatter.format(range.startAt)} – ${dateFormatter.format(range.endAt - 1)}`;
  const quickFilterGroups = [
    {
      id: 'type',
      label: 'Type',
      options: typeOptions.map(({ id, label }) => ({ value: id, label })),
      value: typeFilter,
      onChange: (value: string) => setTypeFilter(value as AnalyticsType),
    },
    {
      id: 'account',
      label: 'Account',
      options: accountOptions.map(({ id, label }) => ({ value: id, label })),
      value: accountFilter,
      onChange: setAccountFilter,
    },
    {
      id: 'category',
      label: 'Category',
      options: categoryOptions.map(({ id, label }) => ({ value: id, label })),
      value: categoryFilter,
      onChange: setCategoryFilter,
    },
    {
      id: 'currency',
      label: 'Currency',
      options: currencyOptions.map(({ id, label }) => ({ value: id, label })),
      value: currency,
      onChange: (value: string) => {
        setCurrencyFilter(value);
        setAccountFilter('all');
      },
    },
  ];
  const trendBuckets = analytics?.buckets ?? [];
  const trendStride = Math.max(1, Math.ceil(trendBuckets.length / 7));
  const trendLabels = trendBuckets.map((bucket, index) => {
    if (index % trendStride !== 0 && index !== trendBuckets.length - 1) return '';
    if (period === 'year') return bucket.label;
    return period === 'week'
      ? (bucket.label.split(' ')[0] ?? bucket.label)
      : (bucket.label.split(' ').at(-1) ?? bucket.label);
  });
  const currentBucket = trendBuckets.findIndex(
    (bucket) => Date.now() >= bucket.startAt && Date.now() < bucket.endAt,
  );
  const accountBalances = useMemo(() => {
    const balances = new Map<string, bigint>();
    for (const account of accountState.data ?? []) {
      const id = recordId(account);
      const openingBalance =
        typeof account.balanceMinor === 'bigint'
          ? account.balanceMinor
          : typeof account.openingBalanceMinor === 'bigint'
            ? account.openingBalanceMinor
            : undefined;
      if (!id || openingBalance === undefined) continue;
      const ids = new Set(recordIds(account));
      const optimisticDelta = (transactionState.data ?? []).reduce((sum, record) => {
        if (
          typeof record.clientUpdatedAt !== 'number' ||
          record.status !== 'posted' ||
          record.deletedAt !== undefined ||
          typeof record.amountMinor !== 'bigint'
        )
          return sum;
        const sourceId = typeof record.accountId === 'string' ? record.accountId : '';
        const destinationId =
          typeof record.transferAccountId === 'string' ? record.transferAccountId : '';
        const sourceDelta = ids.has(sourceId)
          ? record.type === 'expense' || record.type === 'transfer'
            ? -record.amountMinor
            : record.amountMinor
          : 0n;
        const destinationDelta =
          record.type === 'transfer' && ids.has(destinationId) ? record.amountMinor : 0n;
        return sum + sourceDelta + destinationDelta;
      }, 0n);
      balances.set(id, openingBalance + optimisticDelta);
    }
    return balances;
  }, [accountState.data, transactionState.data]);
  const sharedExpenseMinor = groupExpenses.reduce((sum, record) => {
    const transaction = ledgerTransaction(record);
    return sum + (transaction?.amountMinor ?? 0n);
  }, 0n);
  const settlementDate = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  });

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
        <IconButton
          label="Go back"
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)' as never))}
        >
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="title">Analytics</Typography>
          <Typography variant="caption">A closer look at your local ledger</Typography>
        </View>
        <Button size="sm" variant="outline" onPress={exportAnalytics}>
          Export
        </Button>
      </View>
      <View style={{ gap: 12 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <IconButton
            label="Previous period"
            variant="ghost"
            onPress={() => {
              if (customRange) {
                const duration = customRange.endAt - customRange.startAt;
                setCustomRange({
                  startAt: customRange.startAt - duration,
                  endAt: customRange.startAt,
                });
              } else {
                setReferenceAt(range.previousStartAt + 1);
              }
            }}
          >
            <ArrowLeft size={18} color={tokens.foreground} />
          </IconButton>
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <DateRangePopover
              label={rangeLabel}
              startDate={getAnalyticsCalendarDate(customRange?.startAt ?? range.startAt, timeZone)}
              endDate={getAnalyticsCalendarDate(
                customRange
                  ? Math.max(customRange.startAt, customRange.endAt - 1)
                  : range.endAt - 1,
                timeZone,
              )}
              presets={periodOptions}
              onPresetSelect={(value) => {
                setPeriod(value as AnalyticsPeriod);
                setCustomRange(null);
                setReferenceAt(Date.now());
              }}
              onRangeApply={(startDate, endDate) => {
                setPeriod('month');
                setCustomRange(getAnalyticsCustomRange(startDate, endDate, timeZone));
              }}
            />
            <Typography variant="caption">{currency}</Typography>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setCustomRange(null);
                setReferenceAt(Date.now());
              }}
            >
              Today
            </Button>
          </View>
          <IconButton
            label="Next period"
            variant="ghost"
            onPress={() => {
              if (customRange) {
                const duration = customRange.endAt - customRange.startAt;
                setCustomRange({
                  startAt: customRange.endAt,
                  endAt: customRange.endAt + duration,
                });
              } else {
                setReferenceAt(range.endAt);
              }
            }}
          >
            <ArrowRight size={18} color={tokens.foreground} />
          </IconButton>
        </View>
        <QuickFiltersPopover groups={quickFilterGroups} />
      </View>
      {!isConnected && ready && (
        <Typography variant="caption">Offline · showing records saved on this device.</Typography>
      )}
      {ready && (
        <Typography variant="caption">
          {isConnected && rangeState.covered
            ? 'Selected server date range loaded.'
            : 'Showing records saved on this device for this period.'}
        </Typography>
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
        <Empty
          title="Analytics unavailable"
          description="Sign in to see your spending and income."
        />
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
                {
                  label: 'Total spent',
                  value: formatMinor(analytics.spentMinor, currency),
                  color: tokens.expense,
                },
                {
                  label: 'Total income',
                  value: formatMinor(analytics.incomeMinor, currency),
                  color: tokens.income,
                },
                {
                  label: 'Net cash flow',
                  value: formatMinor(analytics.incomeMinor - analytics.spentMinor, currency),
                  color:
                    analytics.incomeMinor >= analytics.spentMinor ? tokens.income : tokens.expense,
                },
                { label: 'Savings rate', value: savingsRate, color: tokens.primary },
                {
                  label: 'Transactions',
                  value: String(transactionCount),
                  color: tokens.foreground,
                },
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
                  <View
                    style={{ height: 2, width: 30, borderRadius: 2, backgroundColor: item.color }}
                  />
                </View>
              ))}
            </View>
            {transactionCount === 0 && (
              <Empty
                title="No activity in this period"
                description="Record a transaction to start seeing trends from your local finance data."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => router.push('/transaction/new' as never)}
                  >
                    Add transaction
                  </Button>
                }
              />
            )}
            <Panel title="Cash flow">
              <FilterSheet
                label="Chart"
                title="Cash flow chart type"
                options={[
                  { label: 'Lines', value: 'lines' },
                  { label: 'Bars', value: 'bars' },
                ]}
                value={cashFlowChartType}
                onChange={(value) => setCashFlowChartType(value as 'lines' | 'bars')}
              />
              <CashFlowChart
                variant={cashFlowChartType}
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
              <FilterSheet
                label="Chart"
                title="Spending trend chart type"
                options={[
                  { label: 'Bars', value: 'bars' },
                  { label: 'Line', value: 'line' },
                ]}
                value={dailyChartType}
                onChange={(value) => setDailyChartType(value as 'bars' | 'line')}
              />
              {analytics.buckets.some((bucket) => bucket.amountMinor > 0n) ? (
                dailyChartType === 'bars' ? (
                  <BarChart
                    values={chartValues(analytics.buckets.map((bucket) => bucket.amountMinor))}
                    labels={trendLabels}
                    highlightIndex={currentBucket >= 0 ? currentBucket : undefined}
                  />
                ) : (
                  <SpendingLineChart
                    values={chartValues(analytics.buckets.map((bucket) => bucket.amountMinor))}
                    labels={[
                      trendBuckets[0]?.label ?? 'Start',
                      trendBuckets.at(-1)?.label ?? 'End',
                    ]}
                  />
                )
              ) : (
                <Typography variant="small">No posted expenses to chart in this period.</Typography>
              )}
            </Panel>
            <Panel title="Spending by category">
              <FilterSheet
                label="Chart"
                title="Category chart type"
                options={[
                  { label: 'Donut', value: 'donut' },
                  { label: 'Bars', value: 'bars' },
                ]}
                value={categoryChartType}
                onChange={(value) => setCategoryChartType(value as 'donut' | 'bars')}
              />
              {categoryChartType === 'donut' ? (
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
              ) : analytics.categoryBreakdown.length ? (
                <BarChart
                  values={analytics.categoryBreakdown.map((item) =>
                    analytics.spentMinor > 0n
                      ? Number((item.amountMinor * 10000n) / analytics.spentMinor) / 100
                      : 0,
                  )}
                  labels={analytics.categoryBreakdown.map((item) => item.label)}
                />
              ) : (
                <Typography variant="small">No posted expenses in this period.</Typography>
              )}
            </Panel>
            <Panel
              title="Accounts & balances"
              action={
                <Button size="sm" variant="ghost" onPress={() => router.push('/account' as never)}>
                  All accounts
                </Button>
              }
            >
              {accountState.loading || transactionState.loading ? (
                <Typography variant="small">Loading account balances…</Typography>
              ) : accountState.data?.filter(
                  (account) =>
                    account.archivedAt === undefined &&
                    (account.currency ?? defaultCurrency) === currency,
                ).length ? (
                <View style={{ gap: 2 }}>
                  {accountState.data
                    .filter(
                      (account) =>
                        account.archivedAt === undefined &&
                        (account.currency ?? defaultCurrency) === currency,
                    )
                    .map((account) => {
                      const id = recordId(account);
                      if (!id) return null;
                      const aliases = recordIds(account);
                      const balance = accountBalances.get(id);
                      const breakdown = analytics.accountBreakdown.find((item) =>
                        aliases.includes(item.id),
                      );
                      const spentMinor = breakdown?.amountMinor ?? 0n;
                      return (
                        <TouchableOpacity
                          key={id}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${String(account.name ?? 'Account')} account`}
                          onPress={() => {
                            if (balance === undefined && breakdown) {
                              navigate('account', breakdown);
                              return;
                            }
                            router.push({ pathname: '/account/[id]', params: { id } } as never);
                          }}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            paddingVertical: 8,
                            borderBottomWidth: 1,
                            borderColor: tokens.borderSubtle,
                          }}
                        >
                          <View style={{ flex: 1, gap: 3 }}>
                            <Typography variant="small" numberOfLines={1}>
                              {typeof account.name === 'string'
                                ? displayAccountName(account.name)
                                : 'Account'}
                            </Typography>
                            <Typography variant="caption">
                              {balance === undefined ? 'Posted expenses' : 'Current balance'}
                            </Typography>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 2 }}>
                            <Typography variant="small">
                              {formatMinor(balance ?? spentMinor, currency)}
                            </Typography>
                            <Typography variant="caption">
                              {formatMinor(spentMinor, currency)} spent
                            </Typography>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              ) : (
                <Empty
                  title="No account activity"
                  description="Accounts in this currency will appear here."
                />
              )}
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
                    <View
                      style={{ width: 8, height: 8, borderRadius: 5, backgroundColor: item.color }}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Typography variant="caption">{item.label}</Typography>
                      <Typography variant="small" style={{ color: tokens.foreground }}>
                        {formatMinor(item.amountMinor, currency)}
                      </Typography>
                    </View>
                  </View>
                ))}
              </View>
              <Typography variant="caption">
                Shared expenses are also included in total spent.
              </Typography>
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
                        onPress={() =>
                          id && router.push({ pathname: '/budget/[id]', params: { id } } as never)
                        }
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
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => router.push('/budget/new' as never)}
                    >
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
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => router.push('/recurring' as never)}
                >
                  View all
                </Button>
              }
            >
              {recurringState.loading ? (
                <Typography variant="small">Loading saved reminders…</Typography>
              ) : recurringState.data ? (
                recurringRules.length ? (
                  <View style={{ gap: 10 }}>
                    <Typography variant="caption">
                      {recurringRules.length} active reminders
                    </Typography>
                    {recurringRules.slice(0, 4).map((rule) => {
                      const template = localRecord(rule.template);
                      const amount = template?.amountMinor;
                      const templateCurrency = template?.currency;
                      const next =
                        typeof rule.nextOccurrence === 'number' ? rule.nextOccurrence : undefined;
                      const dueLabel = next
                        ? new Intl.DateTimeFormat('en-US', {
                            timeZone,
                            month: 'short',
                            day: 'numeric',
                          }).format(next)
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
                              {typeof rule.frequency === 'string' ? rule.frequency : 'Scheduled'} ·
                              next {dueLabel}
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
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => router.push('/recurring' as never)}
                      >
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
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => router.push('/(tabs)/groups' as never)}
                >
                  View groups
                </Button>
              }
            >
              <MetricPair
                left={{ label: 'Active groups', value: String(groups.length) }}
                right={{
                  label: 'Shared expenses',
                  value: formatMinor(sharedExpenseMinor, currency),
                }}
              />
              <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Typography variant="caption">Settlements in this period</Typography>
                <Typography variant="small" style={{ color: tokens.foreground }}>
                  {formatMinor(settlementsMinor, currency)} · {settlements.length}
                </Typography>
              </View>
              {groupExpenses.length === 0 && settlements.length === 0 ? (
                <Typography variant="small">
                  No shared expenses or settlements in this period.
                </Typography>
              ) : (
                <View style={{ gap: 2 }}>
                  {groupExpenses
                    .slice()
                    .sort((left, right) => Number(right.occurredAt) - Number(left.occurredAt))
                    .slice(0, 3)
                    .map((record) => {
                      const transaction = ledgerTransaction(record);
                      const groupId = typeof record.groupId === 'string' ? record.groupId : '';
                      const group = groupIndex.get(groupId);
                      const groupName =
                        typeof group?.name === 'string' ? group.name : 'Shared expense';
                      return (
                        <TouchableOpacity
                          key={recordId(record)}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${groupName}`}
                          onPress={() =>
                            groupId &&
                            router.push({
                              pathname: '/group/[id]',
                              params: { id: groupId },
                            } as never)
                          }
                          activeOpacity={0.75}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            minHeight: 48,
                          }}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Typography
                              variant="small"
                              style={{ color: tokens.foreground }}
                              numberOfLines={1}
                            >
                              {transaction?.title || transaction?.merchant || groupName}
                            </Typography>
                            <Typography variant="caption">{groupName}</Typography>
                          </View>
                          <Typography variant="small" style={{ color: tokens.foreground }}>
                            {transaction
                              ? formatMinor(transaction.amountMinor, transaction.currency)
                              : ''}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  {settlements.slice(0, 3).map((record) => {
                    const at =
                      typeof record.occurredAt === 'number'
                        ? record.occurredAt
                        : Number(record.createdAt);
                    const groupId = typeof record.groupId === 'string' ? record.groupId : '';
                    const group = groupIndex.get(groupId);
                    const groupName = typeof group?.name === 'string' ? group.name : 'Settlement';
                    return (
                      <TouchableOpacity
                        key={recordId(record)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${groupName} settlement`}
                        onPress={() =>
                          groupId &&
                          router.push({ pathname: '/group/[id]', params: { id: groupId } } as never)
                        }
                        activeOpacity={0.75}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          minHeight: 44,
                        }}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Typography variant="small" style={{ color: tokens.foreground }}>
                            {groupName} settlement
                          </Typography>
                          <Typography variant="caption">{settlementDate.format(at)}</Typography>
                        </View>
                        <Typography variant="small" style={{ color: tokens.primary }}>
                          {typeof record.amountMinor === 'bigint'
                            ? formatMinor(record.amountMinor, currency)
                            : ''}
                        </Typography>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {groupState.error || settlementState.error ? (
                <Typography variant="caption">
                  Some saved group or settlement records are unavailable.
                </Typography>
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
                    <View style={{ width: 24 }} />
                    <Typography variant="caption" style={{ flex: 1 }}>
                      Category
                    </Typography>
                    <Typography variant="caption" style={{ width: 46, textAlign: 'right' }}>
                      Count
                    </Typography>
                    <Typography variant="caption" style={{ width: 88, textAlign: 'right' }}>
                      Amount
                    </Typography>
                  </View>
                  {analytics.categoryBreakdown.map((item, index) => {
                    const share =
                      analytics.spentMinor > 0n
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
                        <Typography variant="caption" style={{ width: 24, color: tokens.primary }}>
                          {String(index + 1).padStart(2, '0')}
                        </Typography>
                        <Typography
                          variant="small"
                          numberOfLines={1}
                          style={{ flex: 1, color: tokens.foreground }}
                        >
                          {item.label}
                        </Typography>
                        <Typography variant="caption" style={{ width: 46, textAlign: 'right' }}>
                          {categoryCounts.get(item.id) ?? 0}
                        </Typography>
                        <View style={{ width: 88, alignItems: 'flex-end' }}>
                          <Typography
                            variant="small"
                            style={{ color: tokens.foreground }}
                            numberOfLines={1}
                          >
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
