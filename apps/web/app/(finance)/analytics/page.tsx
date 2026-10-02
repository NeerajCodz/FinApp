'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button, Card, Typography, useTheme } from '@finapp/ui/web';
import {
  AnalyticsChartPanel,
  AnalyticsFilters,
  AnalyticsHeader,
  AnalyticsSummary,
  BarChart,
  BreakdownDonut,
  CashFlowChart,
  SpendingLineChart,
} from '@finapp/ui/analytics';
import {
  BudgetProgress,
  FinanceEmptyState,
  TransactionRow,
  formatTransactionDate,
} from '@finapp/ui/finance';
import {
  aggregateAnalytics,
  getAnalyticsCalendarDate,
  getAnalyticsCustomRange,
  getAnalyticsRange,
  type AnalyticsPeriod,
  type AnalyticsTransaction,
} from '@convex/analytics/domain';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { routeIdFor } from '../_personal';

type Profile = LocalRecord & { defaultCurrency?: string; timezone?: string };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Account = LocalRecord & {
  name?: string;
  currency?: string;
  currentBalance?: bigint | number | string;
  archivedAt?: number;
};
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  accountId?: string;
  groupId?: string;
  merchant?: string;
  title?: string;
  occurredAt?: number;
  hasTime?: boolean;
  deletedAt?: number;
};
type Budget = LocalRecord & {
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  accountId?: string;
  accountIds?: string[];
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
};
type RecurringRule = LocalRecord & {
  name?: string;
  enabled?: boolean;
  nextOccurrence?: number;
  frequency?: string;
  template?: {
    amountMinor?: bigint | number | string;
    currency?: string;
    categoryId?: string;
    accountId?: string;
  };
};
type Group = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Settlement = LocalRecord & {
  groupId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};

const periods: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];
const categoryChartTypes = [
  { value: 'donut', label: 'Donut' },
  { value: 'bars', label: 'Bars' },
] as const;
const dailyChartTypes = [
  { value: 'bars', label: 'Bars' },
  { value: 'line', label: 'Line' },
] as const;

function amountAsBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function idAliases(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function idOf(record: LocalRecord) {
  return idAliases(record)[0] ?? '';
}

function aliasMap<T extends LocalRecord>(records: T[]) {
  const map = new Map<string, T>();
  for (const record of records) for (const id of idAliases(record)) map.set(id, record);
  return map;
}

function rangeTitle(startAt: number, endAt: number, period: AnalyticsPeriod, timeZone: string) {
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone,
    ...(period === 'week'
      ? { month: 'short', day: 'numeric' }
      : period === 'month'
        ? { month: 'long', year: 'numeric' }
        : { year: 'numeric' }),
  });
  if (period === 'year') return date.format(startAt);
  const first = date.format(startAt);
  const last = date.format(Math.max(startAt, endAt - 1));
  return first === last ? first : `${first} – ${last}`;
}

function customRangeTitle(startAt: number, endAt: number, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const first = formatter.format(startAt);
  const last = formatter.format(Math.max(startAt, endAt - 1));
  return first === last ? first : `${first} – ${last}`;
}

export default function AnalyticsPage() {
  const { userId, isConnected, fetchTransactionRange, fetchGroupRange } = useBrowserSync();
  const router = useRouter();
  const { tokens } = useTheme();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const categoryState = useLocalRecords<Category>('category');
  const accountState = useLocalRecords<Account>('account');
  const profileState = useLocalRecords<Profile>('profile');
  const budgetState = useLocalRecords<Budget>('budget');
  const recurringState = useLocalRecords<RecurringRule>('recurringRule');
  const groupState = useLocalRecords<Group>('group');
  const settlementState = useLocalRecords<Settlement>('settlement');
  const [period, setPeriod] = React.useState<AnalyticsPeriod>('month');
  const [referenceAt, setReferenceAt] = React.useState<number | null>(null);
  const [customRange, setCustomRange] = React.useState<{ startAt: number; endAt: number } | null>(
    null,
  );
  const [selectedCurrency, setSelectedCurrency] = React.useState('');
  const [accountFilter, setAccountFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState<
    'all' | 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'
  >('all');
  const [categoryChartType, setCategoryChartType] = React.useState<'donut' | 'bars'>('donut');
  const [dailyChartType, setDailyChartType] = React.useState<'bars' | 'line'>('bars');
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const [loadedRange, setLoadedRange] = React.useState('');
  const [groupRangeLoading, setGroupRangeLoading] = React.useState(false);
  const [groupRangeError, setGroupRangeError] = React.useState('');
  React.useEffect(() => setReferenceAt(Date.now()), []);

  const profile = profileState.records[0];
  const timeZone = profile?.timezone ?? 'UTC';
  const currencyOptions = React.useMemo(
    () =>
      [
        ...new Set([
          ...transactionState.records.map((item) => String(item.currency ?? '')).filter(Boolean),
          ...accountState.records.map((item) => String(item.currency ?? '')).filter(Boolean),
          ...budgetState.records.map((item) => String(item.currency ?? '')).filter(Boolean),
          ...recurringState.records
            .map((item) => String(item.template?.currency ?? ''))
            .filter(Boolean),
          ...groupState.records.map((item) => String(item.currency ?? '')).filter(Boolean),
          ...settlementState.records.map((item) => String(item.currency ?? '')).filter(Boolean),
          ...(profile?.defaultCurrency ? [profile.defaultCurrency] : []),
        ]),
      ].sort(),
    [
      accountState.records,
      budgetState.records,
      groupState.records,
      profile?.defaultCurrency,
      recurringState.records,
      settlementState.records,
      transactionState.records,
    ],
  );
  const currency =
    selectedCurrency && currencyOptions.includes(selectedCurrency)
      ? selectedCurrency
      : profile?.defaultCurrency && currencyOptions.includes(profile.defaultCurrency)
        ? profile.defaultCurrency
        : currencyOptions[0] || 'INR';
  const range = React.useMemo(() => {
    if (referenceAt === null) return null;
    if (customRange) {
      const duration = customRange.endAt - customRange.startAt;
      return {
        ...customRange,
        previousStartAt: customRange.startAt - duration,
      };
    }
    return getAnalyticsRange(period, referenceAt, timeZone);
  }, [customRange, period, referenceAt, timeZone]);
  const queryRange = React.useMemo(
    () => (range ? { startAt: range.previousStartAt, endAt: range.endAt } : null),
    [range],
  );
  const rangeKey = queryRange ? `${queryRange.startAt}:${queryRange.endAt}` : '';

  React.useEffect(() => {
    if (!userId || !queryRange) return;
    const endAt = Math.min(queryRange.endAt, Date.now() + 1);
    if (queryRange.startAt >= endAt) {
      setRangeLoading(false);
      setRangeError('');
      return;
    }
    let active = true;
    setRangeLoading(true);
    setRangeError('');
    void fetchTransactionRange(queryRange.startAt, endAt)
      .then(() => {
        if (active) setLoadedRange(rangeKey);
      })
      .catch((cause: unknown) => {
        if (active)
          setRangeError(
            !isConnected
              ? 'Offline: results include only records already stored in this browser.'
              : cause instanceof Error
                ? cause.message
                : 'Could not load the selected date range.',
          );
      })
      .finally(() => {
        if (active) setRangeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, queryRange, rangeKey, userId]);

  const activeGroups = React.useMemo(
    () => groupState.records.filter((group) => !group.archivedAt && idOf(group)),
    [groupState.records],
  );
  const currencyGroups = React.useMemo(
    () =>
      activeGroups.filter(
        (group) => (group.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
      ),
    [activeGroups, currency, profile?.defaultCurrency],
  );
  const groupIds = React.useMemo(() => currencyGroups.flatMap(idAliases), [currencyGroups]);
  const groupRangeKey = range ? `${groupIds.join(',')}:${range.startAt}:${range.endAt}` : '';
  React.useEffect(() => {
    if (!userId || !range || !currencyGroups.length || !isConnected) return;
    const endAt = Math.min(range.endAt, Date.now() + 1);
    if (range.startAt >= endAt) {
      setGroupRangeLoading(false);
      setGroupRangeError('');
      return;
    }
    let active = true;
    setGroupRangeLoading(true);
    setGroupRangeError('');
    void Promise.all(
      currencyGroups.map((group) => fetchGroupRange(idOf(group), range.startAt, endAt)),
    )
      .catch((cause: unknown) => {
        if (active)
          setGroupRangeError(
            cause instanceof Error ? cause.message : 'Could not refresh shared activity.',
          );
      })
      .finally(() => {
        if (active) setGroupRangeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currencyGroups, fetchGroupRange, groupRangeKey, isConnected, range, userId]);

  const categoryEntities = React.useMemo(
    () =>
      categoryState.records.flatMap((category) => {
        const aliases = idAliases(category);
        const id = aliases[0];
        return id ? [{ id, name: String(category.name ?? 'Category'), aliases }] : [];
      }),
    [categoryState.records],
  );
  const accountEntities = React.useMemo(
    () =>
      accountState.records.flatMap((account) => {
        if (account.includeInAnalytics === false) return [];
        const aliases = idAliases(account);
        const id = aliases[0];
        return id ? [{ id, name: String(account.name ?? 'Account'), aliases }] : [];
      }),
    [accountState.records],
  );
  const analyticsTransactions = React.useMemo(
    () =>
      transactionState.records.flatMap((record): AnalyticsTransaction[] => {
        const type = record.type;
        if (
          type !== 'expense' &&
          type !== 'income' &&
          type !== 'transfer' &&
          type !== 'refund' &&
          type !== 'adjustment'
        )
          return [];
        return [
          {
            type,
            amountMinor: amountAsBigInt(record.amountMinor),
            currency: String(record.currency ?? profile?.defaultCurrency ?? 'INR'),
            ...(typeof record.categoryId === 'string' ? { categoryId: record.categoryId } : {}),
            ...(typeof record.accountId === 'string' ? { accountId: record.accountId } : {}),
            ...(typeof record.merchant === 'string' ? { merchant: record.merchant } : {}),
            ...(typeof record.title === 'string' ? { title: record.title } : {}),
            occurredAt: Number(record.occurredAt ?? 0),
            status:
              record.status === 'pending' || record.status === 'voided' ? record.status : 'posted',
            ...(typeof record.deletedAt === 'number' ? { deletedAt: record.deletedAt } : {}),
          },
        ];
      }),
    [profile?.defaultCurrency, transactionState.records],
  );

  const categoryById = React.useMemo(
    () => aliasMap(categoryState.records),
    [categoryState.records],
  );
  const accountById = React.useMemo(() => aliasMap(accountState.records), [accountState.records]);
  const filteredTransactions = React.useMemo(
    () =>
      analyticsTransactions.filter((transaction) => {
        if (accountById.get(transaction.accountId ?? '')?.includeInAnalytics === false)
          return false;
        const account = accountById.get(accountFilter);
        const category = categoryById.get(categoryFilter);
        if (
          accountFilter !== 'all' &&
          !(account ? idAliases(account) : [accountFilter]).includes(transaction.accountId ?? '')
        )
          return false;
        if (
          categoryFilter !== 'all' &&
          !(category ? idAliases(category) : [categoryFilter]).includes(
            transaction.categoryId ?? '',
          )
        )
          return false;
        if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
        return true;
      }),
    [accountById, accountFilter, analyticsTransactions, categoryById, categoryFilter, typeFilter],
  );

  const result = React.useMemo(() => {
    if (!range) return null;
    return aggregateAnalytics(
      filteredTransactions,
      categoryEntities,
      currency,
      period,
      range.startAt,
      range.endAt,
      timeZone,
      accountEntities,
    );
  }, [accountEntities, categoryEntities, currency, filteredTransactions, period, range, timeZone]);
  const previous = React.useMemo(() => {
    if (!range) return null;
    return aggregateAnalytics(
      filteredTransactions,
      categoryEntities,
      currency,
      period,
      range.previousStartAt,
      range.startAt,
      timeZone,
      accountEntities,
    );
  }, [accountEntities, categoryEntities, currency, filteredTransactions, period, range, timeZone]);
  const rangeRecords = React.useMemo(() => {
    if (!range) return [];
    return transactionState.records.filter((record) => {
      if (accountById.get(String(record.accountId ?? ''))?.includeInAnalytics === false)
        return false;
      const occurredAt = Number(record.occurredAt ?? 0);
      const account = accountById.get(accountFilter);
      const category = categoryById.get(categoryFilter);
      const validType =
        record.type === 'expense' ||
        record.type === 'income' ||
        record.type === 'transfer' ||
        record.type === 'refund' ||
        record.type === 'adjustment';
      return (
        validType &&
        (record.status === undefined || record.status === 'posted') &&
        record.deletedAt === undefined &&
        (record.currency ?? profile?.defaultCurrency ?? 'INR') === currency &&
        occurredAt >= range.startAt &&
        occurredAt < range.endAt &&
        (typeFilter === 'all' || record.type === typeFilter) &&
        (accountFilter === 'all' ||
          (account ? idAliases(account) : [accountFilter]).includes(
            String(record.accountId ?? ''),
          )) &&
        (categoryFilter === 'all' ||
          (category ? idAliases(category) : [categoryFilter]).includes(
            String(record.categoryId ?? ''),
          ))
      );
    });
  }, [
    accountById,
    accountFilter,
    categoryById,
    categoryFilter,
    currency,
    profile?.defaultCurrency,
    range,
    transactionState.records,
    typeFilter,
  ]);

  const transactionCount = rangeRecords.length;
  const chartMax =
    result?.buckets.reduce(
      (maximum, bucket) => (bucket.amountMinor > maximum ? bucket.amountMinor : maximum),
      0n,
    ) ?? 0n;
  const chartValues =
    result?.buckets.map((bucket) =>
      chartMax > 0n ? Number((bucket.amountMinor * 10000n) / chartMax) / 100 : 0,
    ) ?? [];
  const chartAxisFormatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        ...(period === 'year' ? { month: 'short' } : { day: 'numeric' }),
      }),
    [period, timeZone],
  );
  const chartDetailFormatter = React.useMemo(
    () => new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone }),
    [timeZone],
  );
  const chartAxisLabels =
    result?.buckets.map((bucket) =>
      period === 'year' ? bucket.label : chartAxisFormatter.format(bucket.startAt),
    ) ?? [];
  const chartDetails =
    result?.buckets.map((bucket) => chartDetailFormatter.format(bucket.startAt)) ?? [];
  const chartAmounts =
    result?.buckets.map((bucket) => formatMinor(bucket.amountMinor, currency)) ?? [];
  const categoryAmounts =
    result?.categoryBreakdown.map((item) => formatMinor(item.amountMinor, currency)) ?? [];
  const categoryDetails = result
    ? result.categoryBreakdown.map(
        (item) =>
          `${result.spentMinor > 0n ? Number((item.amountMinor * 1000n) / result.spentMinor) / 10 : 0}% of spending`,
      )
    : [];

  const savingsRate =
    result?.incomeMinor && result.incomeMinor > 0n
      ? Number(((result.incomeMinor - result.spentMinor) * 1000n) / result.incomeMinor) / 10
      : null;
  const comparison =
    previous && result
      ? previous.spentMinor === 0n
        ? result.spentMinor === 0n
          ? 'No spending in either period'
          : 'No spending in the previous period'
        : `${result.spentMinor >= previous.spentMinor ? 'Up' : 'Down'} ${Number(((result.spentMinor >= previous.spentMinor ? result.spentMinor - previous.spentMinor : previous.spentMinor - result.spentMinor) * 100n) / previous.spentMinor)}% vs previous period`
      : '';

  const splitSpend = rangeRecords
    .filter((record) => record.type === 'expense' && record.groupId)
    .reduce((sum, item) => sum + amountAsBigInt(item.amountMinor), 0n);
  const settlementsInRange = settlementState.records.filter((item) => {
    const at = Number(item.occurredAt ?? 0);
    const groupId = String(item.groupId ?? '');
    const group = currencyGroups.find((candidate) => idAliases(candidate).includes(groupId));
    return (
      item.deletedAt === undefined &&
      item.status !== 'voided' &&
      groupIds.includes(groupId) &&
      (item.currency ?? group?.currency ?? profile?.defaultCurrency ?? 'INR') === currency &&
      at >= (range?.startAt ?? 0) &&
      at < (range?.endAt ?? 0)
    );
  });
  const settledMinor = settlementsInRange.reduce(
    (sum, item) => sum + amountAsBigInt(item.amountMinor),
    0n,
  );

  const budgetItems = budgetState.records
    .filter(
      (budget) =>
        !budget.archivedAt &&
        budget.includeInAnalytics !== false &&
        (budget.currency ??
          accountById.get(String(budget.accountId ?? ''))?.currency ??
          profile?.defaultCurrency ??
          'INR') === currency,
    )
    .filter(
      (budget) =>
        !range ||
        (Number(budget.startAt ?? range.startAt) < range.endAt &&
          Number(budget.endAt ?? range.endAt) > range.startAt),
    )
    .slice(0, 4);
  const recurringItems = recurringState.records
    .filter(
      (rule) =>
        rule.enabled &&
        (rule.template?.currency ??
          accountById.get(String(rule.template?.accountId ?? ''))?.currency ??
          profile?.defaultCurrency ??
          'INR') === currency,
    )
    .slice(0, 4);
  const budgetSpent = (budget: Budget) =>
    rangeRecords.reduce((sum, record) => {
      const at = Number(record.occurredAt ?? 0);
      if (
        record.type !== 'expense' ||
        at < Number(budget.startAt ?? range?.startAt ?? 0) ||
        at >= Number(budget.endAt ?? range?.endAt ?? 0)
      )
        return sum;
      if (categoryById.get(String(record.categoryId ?? ''))?.includeInBudgets === false) return sum;
      const budgetCategory = budget.categoryId ? categoryById.get(budget.categoryId) : undefined;
      if (
        budget.categoryId &&
        (!budgetCategory || !idAliases(budgetCategory).includes(String(record.categoryId ?? '')))
      )
        return sum;
      const budgetAccount = budget.accountId ? accountById.get(budget.accountId) : undefined;
      if (
        budget.accountId &&
        (!budgetAccount || !idAliases(budgetAccount).includes(String(record.accountId ?? '')))
      )
        return sum;
      if (
        budget.accountIds?.length &&
        !budget.accountIds.some((id) => {
          const scopedAccount = accountById.get(id);
          return (scopedAccount ? idAliases(scopedAccount) : [id]).includes(
            String(record.accountId ?? ''),
          );
        })
      )
        return sum;
      return sum + amountAsBigInt(record.amountMinor);
    }, 0n);

  const largestExpenses = rangeRecords
    .filter((record) => record.type === 'expense')
    .sort((a, b) =>
      amountAsBigInt(a.amountMinor) === amountAsBigInt(b.amountMinor)
        ? 0
        : amountAsBigInt(a.amountMinor) > amountAsBigInt(b.amountMinor)
          ? -1
          : 1,
    )
    .slice(0, 5);
  const categoryCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of rangeRecords)
      if (record.type === 'expense') {
        const id = categoryById.get(String(record.categoryId ?? ''));
        const key = id ? idOf(id) : '__uncategorized__';
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    return counts;
  }, [categoryById, rangeRecords]);
  const breakdownHref = (dimension: 'category' | 'account' | 'merchant', key: string) => {
    if (!range) return '/analytics';
    return `/analytics/breakdown/${dimension}?${new URLSearchParams({ key, period, startAt: String(range.startAt), endAt: String(range.endAt) }).toString()}`;
  };
  const coreError =
    transactionState.error ?? categoryState.error ?? accountState.error ?? profileState.error;
  const auxiliaryError =
    budgetState.error ?? recurringState.error ?? groupState.error ?? settlementState.error;
  const loading =
    referenceAt === null ||
    transactionState.loading ||
    categoryState.loading ||
    accountState.loading ||
    profileState.loading;

  const downloadCsv = () => {
    const columns = [
      'Date',
      'Title',
      'Type',
      'Merchant',
      'Category',
      'Account',
      'Amount minor',
      'Currency',
      'Status',
    ];
    const rows = rangeRecords.map((record) => {
      const category = categoryById.get(String(record.categoryId ?? ''));
      const account = accountById.get(String(record.accountId ?? ''));
      return [
        Number(record.occurredAt ?? 0) ? new Date(Number(record.occurredAt)).toISOString() : '',
        record.title ?? '',
        record.type ?? '',
        record.merchant ?? '',
        category?.name ?? '',
        account?.name ?? '',
        String(amountAsBigInt(record.amountMinor)),
        String(record.currency ?? profile?.defaultCurrency ?? 'INR'),
        record.status ?? 'posted',
      ];
    });
    const csv = [columns, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `finapp-analytics-${period}-${currency.toLowerCase()}.csv`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">SEE THE PATTERN</p>
        <h1>Analytics</h1>
        <p>Sign in to view finance records saved in this browser.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  return (
    <div className="finance-page" style={{ display: 'grid', gap: 14, paddingBottom: 88 }}>
      <AnalyticsHeader onExport={downloadCsv} />

      <AnalyticsFilters
        periods={periods}
        period={customRange ? undefined : period}
        onPeriodChange={(value) => {
          setPeriod(value as AnalyticsPeriod);
          setCustomRange(null);
          setReferenceAt(Date.now());
        }}
        rangeLabel={
          range
            ? customRange
              ? customRangeTitle(customRange.startAt, customRange.endAt, timeZone)
              : rangeTitle(range.startAt, range.endAt, period, timeZone)
            : 'Loading range'
        }
        rangeStartDate={getAnalyticsCalendarDate(
          customRange?.startAt ?? range?.startAt ?? Date.now(),
          timeZone,
        )}
        rangeEndDate={getAnalyticsCalendarDate(
          customRange
            ? Math.max(customRange.startAt, customRange.endAt - 1)
            : range
              ? Math.max(range.startAt, range.endAt - 1)
              : Date.now(),
          timeZone,
        )}
        onRangeApply={(startDate, endDate) =>
          setCustomRange(getAnalyticsCustomRange(startDate, endDate, timeZone))
        }
        onPrevious={() => {
          if (!range) return;
          if (customRange) {
            const duration = customRange.endAt - customRange.startAt;
            setCustomRange({
              startAt: customRange.startAt - duration,
              endAt: customRange.startAt,
            });
          } else {
            setReferenceAt(range.previousStartAt);
          }
        }}
        onNext={() => {
          if (!range) return;
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
        onToday={() => {
          setCustomRange(null);
          setReferenceAt(Date.now());
        }}
        canNavigate={Boolean(range)}
        currency={currency}
        currencies={currencyOptions}
        onCurrencyChange={(value) => {
          setSelectedCurrency(value);
          setAccountFilter('all');
        }}
        account={accountFilter}
        accounts={accountState.records
          .filter(
            (item) =>
              !item.archivedAt && (item.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
          )
          .map((item) => ({ value: idOf(item), label: item.name ?? 'Account' }))}
        onAccountChange={setAccountFilter}
        category={categoryFilter}
        categories={categoryState.records
          .filter((item) => !item.archivedAt)
          .map((item) => ({ value: idOf(item), label: item.name ?? 'Category' }))}
        onCategoryChange={setCategoryFilter}
        type={typeFilter}
        onTypeChange={(value) => setTypeFilter(value as typeof typeFilter)}
      />

      <div
        role={rangeError || coreError || groupRangeError || auxiliaryError ? 'alert' : 'status'}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}
      >
        <Typography variant="caption">
          {rangeLoading
            ? 'Refreshing transactions…'
            : rangeError
              ? 'Showing saved data; this range may be incomplete.'
              : isConnected && loadedRange === rangeKey
                ? 'Selected server date range loaded.'
                : 'Showing browser-cached transactions for this period.'}
          {groupRangeLoading ? ' · Refreshing shared activity…' : ''}
          {groupRangeError ? ` · ${groupRangeError}` : ''}
        </Typography>
        {(rangeError || groupRangeError || coreError || auxiliaryError) && (
          <Button size="sm" variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        )}
        {coreError && (
          <Typography variant="caption" style={{ color: tokens.destructive }}>
            Local finance data could not be loaded: {coreError}
          </Typography>
        )}
        {auxiliaryError && (
          <Typography variant="caption" style={{ color: tokens.destructive }}>
            Some additional finance records could not be loaded: {auxiliaryError}
          </Typography>
        )}
      </div>

      {loading ? (
        <Typography variant="heading">Loading analytics…</Typography>
      ) : coreError ? null : result ? (
        <>
          <AnalyticsSummary
            metrics={[
              {
                label: 'Total Spent',
                icon: 'spent',
                value: formatMinor(result.spentMinor, currency),
                color: tokens.expense,
                detail: comparison,
              },
              {
                label: 'Total Income',
                icon: 'income',
                value: formatMinor(result.incomeMinor, currency),
                color: tokens.income,
              },
              {
                label: 'Net Cash Flow',
                icon: 'net',
                value: formatMinor(result.incomeMinor - result.spentMinor, currency),
                color: result.incomeMinor >= result.spentMinor ? tokens.income : tokens.expense,
              },
              {
                label: 'Savings Rate',
                icon: 'savings',
                value: savingsRate === null ? '—' : `${savingsRate}%`,
                color: tokens.primary,
              },
              {
                label: 'Transactions',
                icon: 'transactions',
                value: String(transactionCount),
                color: tokens.foreground,
              },
            ]}
          />

          {transactionCount === 0 && (
            <FinanceEmptyState
              kind="analytics"
              title="No activity in this period"
              description="Record a transaction to start seeing trends from your local finance data."
              action={
                <Link className="finance-inline-link" href="/transaction/new">
                  Add transaction
                </Link>
              }
            />
          )}

          <section className="analytics-primary-charts">
            <AnalyticsChartPanel
              title="Cash flow"
              description="Select a period to inspect its activity"
            >
              {result.buckets.length ? (
                <CashFlowChart
                  buckets={result.buckets}
                  currency={currency}
                  timeZone={timeZone}
                  onSelectBucket={(bucket) =>
                    router.push(`/activity?startAt=${bucket.startAt}&endAt=${bucket.endAt}`)
                  }
                />
              ) : (
                <FinanceEmptyState
                  kind="analytics"
                  compact
                  title="No cash flow in this period"
                  description="Cash flow will appear when you record income or expenses in this period."
                />
              )}
            </AnalyticsChartPanel>
            <AnalyticsChartPanel
              title="Spending by category"
              description={`Posted expenses · ${currency}`}
              chartType={categoryChartType}
              chartTypes={categoryChartTypes}
              onChartTypeChange={(value) => setCategoryChartType(value as 'donut' | 'bars')}
            >
              {categoryChartType === 'donut' ? (
                <BreakdownDonut
                  items={result.categoryBreakdown}
                  totalMinor={result.spentMinor}
                  currency={currency}
                  iconForCategory={(id) => {
                    const category = categoryById.get(id);
                    return typeof category?.icon === 'string' ? category.icon : undefined;
                  }}
                  onSelectItem={(item) => router.push(breakdownHref('category', item.id))}
                />
              ) : result.categoryBreakdown.length ? (
                <BarChart
                  values={result.categoryBreakdown.map((item) =>
                    result.spentMinor > 0n
                      ? Number((item.amountMinor * 10000n) / result.spentMinor) / 100
                      : 0,
                  )}
                  labels={result.categoryBreakdown.map((item) => item.label)}
                  details={categoryDetails}
                  amounts={categoryAmounts}
                  orientation="horizontal"
                />
              ) : (
                <FinanceEmptyState
                  kind="analytics"
                  compact
                  title="No posted expenses"
                  description="Posted expenses in this period will appear here."
                />
              )}
            </AnalyticsChartPanel>
          </section>
          <section className="analytics-secondary-grid">
            <AnalyticsChartPanel
              title="Daily spending"
              description={`${period === 'year' ? 'Monthly totals' : 'Posted expense totals'} · ${currency}`}
              chartType={dailyChartType}
              chartTypes={dailyChartTypes}
              onChartTypeChange={(value) => setDailyChartType(value as 'bars' | 'line')}
            >
              {chartMax > 0n ? (
                dailyChartType === 'bars' ? (
                  <BarChart
                    values={chartValues}
                    labels={chartAxisLabels}
                    details={chartDetails}
                    amounts={chartAmounts}
                  />
                ) : (
                  <SpendingLineChart
                    values={chartValues}
                    labels={[
                      result.buckets[0]?.label ?? 'Start',
                      result.buckets.at(-1)?.label ?? 'End',
                    ]}
                    xLabels={chartAxisLabels}
                    details={chartDetails}
                    amounts={chartAmounts}
                  />
                )
              ) : (
                <Typography variant="caption">No daily spending in this period.</Typography>
              )}
            </AnalyticsChartPanel>

            <Card style={{ display: 'grid', alignContent: 'start', gap: 12, padding: 15 }}>
              <div>
                <Typography variant="bodyLarge">Accounts & balances</Typography>
                <Typography variant="caption">
                  Current balances and expense share · {currency}
                </Typography>
              </div>
              {accountState.records.filter(
                (account) =>
                  !account.archivedAt &&
                  account.includeInAnalytics !== false &&
                  (account.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
              ).length ? (
                accountState.records
                  .filter(
                    (account) =>
                      !account.archivedAt &&
                      account.includeInAnalytics !== false &&
                      (account.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
                  )
                  .map((account) => {
                    const balance =
                      account.currentBalance === undefined
                        ? null
                        : amountAsBigInt(account.currentBalance);
                    const expense =
                      result.accountBreakdown.find((item) => idAliases(account).includes(item.id))
                        ?.amountMinor ?? 0n;
                    return (
                      <Link
                        key={idOf(account)}
                        href={
                          balance === null
                            ? breakdownHref('account', idOf(account))
                            : `/account/${encodeURIComponent(routeIdFor(idOf(account)))}`
                        }
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 3,
                          color: 'inherit',
                          textDecoration: 'none',
                          padding: '7px 0',
                          borderBottom: `1px solid ${tokens.borderSubtle}`,
                        }}
                      >
                        <Typography variant="small">{account.name ?? 'Account'}</Typography>
                        <Typography variant="small">
                          {balance === null
                            ? formatMinor(expense, currency)
                            : formatMinor(balance, currency)}
                        </Typography>
                        <Typography variant="caption">
                          {balance === null ? 'Posted expenses' : 'Balance'}
                        </Typography>
                        <Typography variant="caption" style={{ textAlign: 'right' }}>
                          {formatMinor(expense, currency)} spent
                        </Typography>
                      </Link>
                    );
                  })
              ) : (
                <FinanceEmptyState
                  kind="account"
                  compact
                  title="No account activity"
                  description="Accounts in this currency will appear here."
                />
              )}
              <Link className="finance-inline-link" href="/accounts">
                All accounts
              </Link>
            </Card>
          </section>

          <section className="analytics-planning-grid">
            <Card style={{ display: 'grid', alignContent: 'start', gap: 12, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <Typography variant="bodyLarge">Budget progress</Typography>
                  <Typography variant="caption">Spend within the selected range</Typography>
                </div>
                <Link className="finance-inline-link" href="/budgets">
                  View all
                </Link>
              </div>
              {budgetState.loading ? (
                <Typography variant="small">Loading budgets…</Typography>
              ) : budgetState.error ? (
                <Typography variant="small" role="alert">
                  Budgets could not be loaded.
                </Typography>
              ) : budgetItems.length ? (
                budgetItems.map((budget) => (
                  <BudgetProgress
                    key={idOf(budget)}
                    title={budget.name ?? 'Budget'}
                    spentMinor={budgetSpent(budget)}
                    limitMinor={amountAsBigInt(budget.amountMinor)}
                    currency={
                      budget.currency ??
                      accountById.get(String(budget.accountId ?? ''))?.currency ??
                      profile?.defaultCurrency ??
                      'INR'
                    }
                  />
                ))
              ) : (
                <FinanceEmptyState
                  kind="budget"
                  compact
                  title="No budgets yet"
                  description="Create a budget to keep an eye on your plan."
                  action={
                    <Link className="finance-inline-link" href="/budgets/new">
                      Create a budget
                    </Link>
                  }
                />
              )}
            </Card>
            <Card style={{ display: 'grid', alignContent: 'start', gap: 12, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <Typography variant="bodyLarge">Recurring & subscriptions</Typography>
                  <Typography variant="caption">Saved recurring payments</Typography>
                </div>
                <Link className="finance-inline-link" href="/recurring">
                  View all
                </Link>
              </div>
              {recurringState.loading ? (
                <Typography variant="small">Loading recurring payments…</Typography>
              ) : recurringState.error ? (
                <Typography variant="small" role="alert">
                  Recurring records could not be loaded.
                </Typography>
              ) : recurringItems.length ? (
                recurringItems.map((rule) => {
                  const ruleCurrency =
                    rule.template?.currency ??
                    accountById.get(String(rule.template?.accountId ?? ''))?.currency ??
                    profile?.defaultCurrency ??
                    'INR';
                  return (
                    <div
                      key={idOf(rule)}
                      style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}
                    >
                      <Typography variant="small">{rule.name ?? 'Recurring payment'}</Typography>
                      <Typography variant="small">
                        {rule.template?.amountMinor === undefined
                          ? '—'
                          : formatMinor(amountAsBigInt(rule.template.amountMinor), ruleCurrency)}
                      </Typography>
                      <Typography variant="caption">{rule.frequency ?? 'Scheduled'}</Typography>
                      <Typography variant="caption">
                        {rule.nextOccurrence
                          ? new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              timeZone,
                            }).format(Number(rule.nextOccurrence))
                          : 'Date unavailable'}
                      </Typography>
                    </div>
                  );
                })
              ) : (
                <FinanceEmptyState
                  kind="recurring"
                  compact
                  title="No recurring payments"
                  description="Enabled recurring records will be listed here."
                />
              )}
            </Card>
          </section>

          <section className="analytics-shared-grid">
            <Card style={{ display: 'grid', alignContent: 'start', gap: 12, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <Typography variant="bodyLarge">Groups, splits & settlements</Typography>
                  <Typography variant="caption">Shared records in this range</Typography>
                </div>
                <Link className="finance-inline-link" href="/groups">
                  View groups
                </Link>
              </div>
              {groupState.loading ? (
                <Typography variant="small">Loading groups…</Typography>
              ) : groupState.error ? (
                <Typography variant="small" role="alert">
                  Groups could not be loaded.
                </Typography>
              ) : currencyGroups.length ? (
                currencyGroups.map((group) => {
                  const groupAliases = idAliases(group);
                  const amount = rangeRecords
                    .filter(
                      (record) =>
                        record.type === 'expense' &&
                        groupAliases.includes(String(record.groupId ?? '')),
                    )
                    .reduce((sum, record) => sum + amountAsBigInt(record.amountMinor), 0n);
                  const settlements = settlementsInRange
                    .filter((item) => groupAliases.includes(String(item.groupId ?? '')))
                    .reduce((sum, item) => sum + amountAsBigInt(item.amountMinor), 0n);
                  return (
                    <Link
                      key={idOf(group)}
                      href={`/group/${encodeURIComponent(idOf(group))}`}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        gap: 4,
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      <Typography variant="small">{group.name ?? 'Shared group'}</Typography>
                      <Typography variant="small">{formatMinor(amount, currency)}</Typography>
                      <Typography variant="caption">Shared expenses</Typography>
                      <Typography variant="caption" style={{ textAlign: 'right' }}>
                        Settled {formatMinor(settlements, currency)}
                      </Typography>
                    </Link>
                  );
                })
              ) : (
                <FinanceEmptyState
                  kind="group"
                  compact
                  title="No shared groups"
                  description="Group activity will appear after you join or create a group."
                />
              )}
              <Typography variant="caption">
                Total shared expenses {formatMinor(splitSpend, currency)} · settlements{' '}
                {formatMinor(settledMinor, currency)}
              </Typography>
            </Card>
            <Card style={{ display: 'grid', alignContent: 'start', gap: 10, padding: 15 }}>
              <div>
                <Typography variant="bodyLarge">Top transactions</Typography>
                <Typography variant="caption">Highest posted expenses in this period</Typography>
              </div>
              {largestExpenses.length ? (
                largestExpenses.map((record) => {
                  const id = idOf(record);
                  const category = categoryById.get(String(record.categoryId ?? ''));
                  const account = accountById.get(String(record.accountId ?? ''));
                  return (
                    <TransactionRow
                      key={id}
                      title={record.title || record.merchant || 'Transaction'}
                      merchant={record.merchant}
                      category={category?.name}
                      categoryIcon={category?.icon}
                      account={account?.name}
                      date={
                        record.occurredAt
                          ? formatTransactionDate(
                              Number(record.occurredAt),
                              record.hasTime === true,
                              timeZone,
                            )
                          : undefined
                      }
                      status={typeof record.status === 'string' ? record.status : undefined}
                      amountMinor={amountAsBigInt(record.amountMinor)}
                      currency={String(record.currency ?? currency)}
                      type="expense"
                      semanticType={record.groupId ? 'split' : undefined}
                      onPress={
                        id ? () => router.push(`/transaction/${encodeURIComponent(id)}`) : undefined
                      }
                    />
                  );
                })
              ) : (
                <FinanceEmptyState
                  kind="transaction"
                  compact
                  title="No expenses yet"
                  description="Posted expenses in this period will appear here."
                />
              )}
            </Card>
          </section>
          <section className="analytics-bottom-grid">
            <Card style={{ display: 'grid', alignContent: 'start', gap: 10, padding: 15 }}>
              <div>
                <Typography variant="bodyLarge">Top merchants</Typography>
                <Typography variant="caption">Posted expenses · {currency}</Typography>
              </div>
              {result.merchantBreakdown.length ? (
                result.merchantBreakdown.slice(0, 7).map((item) => (
                  <Link
                    key={item.id}
                    href={breakdownHref('merchant', item.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    <Typography variant="small">{item.label}</Typography>
                    <Typography variant="small">
                      {formatMinor(item.amountMinor, currency)}
                    </Typography>
                  </Link>
                ))
              ) : (
                <FinanceEmptyState
                  kind="transaction"
                  compact
                  title="No merchant totals"
                  description="Merchant totals will appear when expenses are recorded in this range."
                />
              )}
            </Card>
            <Card style={{ display: 'grid', alignContent: 'start', gap: 10, padding: 15 }}>
              <div>
                <Typography variant="bodyLarge">Category breakdown</Typography>
                <Typography variant="caption">Counts and share of selected-range spend</Typography>
              </div>
              {result.categoryBreakdown.length ? (
                <div style={{ display: 'grid', gap: 7 }}>
                  {result.categoryBreakdown.map((item, index) => {
                    const count = categoryCounts.get(item.id) ?? 0;
                    const share =
                      result.spentMinor > 0n
                        ? Number((item.amountMinor * 1000n) / result.spentMinor) / 10
                        : 0;
                    return (
                      <Link
                        key={item.id}
                        href={breakdownHref('category', item.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '24px 1fr auto',
                          alignItems: 'center',
                          gap: 8,
                          color: 'inherit',
                          textDecoration: 'none',
                          padding: '5px 0',
                          borderBottom: `1px solid ${tokens.borderSubtle}`,
                        }}
                      >
                        <Typography variant="caption" style={{ color: tokens.primary }}>
                          {String(index + 1).padStart(2, '0')}
                        </Typography>
                        <span>
                          <Typography variant="small">{item.label}</Typography>
                          <Typography variant="caption">
                            {count} transactions · {share}%
                          </Typography>
                        </span>
                        <Typography variant="small">
                          {formatMinor(item.amountMinor, currency)}
                        </Typography>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <FinanceEmptyState
                  kind="category"
                  compact
                  title="No category totals"
                  description="Category totals will appear when categorized expenses are recorded."
                />
              )}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  );
}
