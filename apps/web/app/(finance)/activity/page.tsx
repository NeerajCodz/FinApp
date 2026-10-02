'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Typography } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import {
  ActivityActions,
  ActivityFilters,
  ActivityHeader,
  ActivityStatus,
  ActivitySummary,
  ActivityTopCategories,
  ActivityTransactionList,
  type ActivityCategoryItem,
} from '@finapp/ui/activity';
import {
  filterActivity,
  type ActivityFilter,
  type ActivityKind,
  type ActivityRow,
} from '@convex/activity/domain';
import {
  getAnalyticsCalendarDate,
  getAnalyticsCustomRange,
  getAnalyticsDayRange,
  getAnalyticsRange,
  type AnalyticsPeriod,
} from '@convex/analytics/domain';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { formatTransactionDate, type TransactionType } from '@finapp/ui/finance';
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  groupId?: string;
  title?: string;
  merchant?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
};
type NamedRecord = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & { defaultCurrency?: string; timezone?: string };
type Range = { startAt: number; endAt: number; label: string };
type ActivityPeriod = AnalyticsPeriod | 'all';

const filters: ActivityFilter[] = ['All', 'Expenses', 'Income', 'Transfers', 'Groups'];
const periodPresets = [
  { value: 'period:week', label: 'Week' },
  { value: 'period:month', label: 'Month' },
  { value: 'period:year', label: 'Year' },
  { value: 'quick:Today', label: 'Today' },
  { value: 'quick:This week', label: 'This week' },
  { value: 'quick:This month', label: 'This month' },
  { value: 'quick:Last month', label: 'Last month' },
  { value: 'period:all', label: 'All time' },
];

function asMinor(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}

function aliases(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}

function entityMap<T extends NamedRecord>(records: T[]) {
  const map = new Map<string, T>();
  for (const record of records) for (const id of aliases(record)) map.set(id, record);
  return map;
}

function rangeFromDay(at: number, timeZone: string): Range {
  const bounds = getAnalyticsDayRange(at, timeZone);
  return { ...bounds, label: 'Today' };
}

function formatRange(range: Range, timeZone: string) {
  if (range.label) return range.label;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
  });
  const first = formatter.format(range.startAt);
  const last = formatter.format(Math.max(range.startAt, range.endAt - 1));
  return first === last ? first : `${first} – ${last}`;
}

export default function ActivityPage() {
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<NamedRecord>('account');
  const categoryState = useLocalRecords<NamedRecord>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [period, setPeriod] = React.useState<ActivityPeriod>('month');
  const [customRange, setCustomRange] = React.useState<Range | null>(null);
  const [filter, setFilter] = React.useState<ActivityFilter>('All');
  const [query, setQuery] = React.useState('');
  const [accountFilter, setAccountFilter] = React.useState('all');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [referenceAt, setReferenceAt] = React.useState<number | null>(null);
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  React.useEffect(() => {
    setReferenceAt(Date.now());
    const params = new URLSearchParams(window.location.search);
    const startAt = Number(params.get('startAt'));
    const endAt = Number(params.get('endAt'));
    if (Number.isFinite(startAt) && Number.isFinite(endAt) && startAt >= 0 && endAt > startAt)
      setCustomRange({ startAt, endAt, label: '' });
  }, []);

  const profile = profileState.records[0];
  const timeZone = profile?.timezone ?? 'UTC';
  const currency = profile?.defaultCurrency ?? 'INR';
  const range = React.useMemo<Range | null>(() => {
    if (customRange) return customRange;
    if (referenceAt === null) return null;
    if (period === 'all') return { startAt: 0, endAt: referenceAt + 1, label: 'All time' };
    const selected = getAnalyticsRange(period, referenceAt, timeZone);
    return { startAt: selected.startAt, endAt: selected.endAt, label: '' };
  }, [customRange, period, referenceAt, timeZone]);

  React.useEffect(() => {
    if (!userId || !range) return;
    const endAt = Math.min(range.endAt, Date.now() + 1);
    if (range.startAt >= endAt) {
      setRangeLoading(false);
      setRangeError('');
      return;
    }
    let active = true;
    setRangeLoading(true);
    setRangeError('');
    void fetchTransactionRange(range.startAt, endAt)
      .catch((cause: unknown) => {
        if (active)
          setRangeError(
            !isConnected
              ? 'Offline: showing transactions already saved in this browser.'
              : cause instanceof Error
                ? cause.message
                : 'Could not refresh this date range.',
          );
      })
      .finally(() => {
        if (active) setRangeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, range, userId]);

  const accountById = React.useMemo(() => entityMap(accountState.records), [accountState.records]);
  const categoryById = React.useMemo(
    () => entityMap(categoryState.records),
    [categoryState.records],
  );
  const rows = React.useMemo(() => {
    if (!range) return [];
    const records = new Map<string, Transaction>();
    const activity: ActivityRow[] = [];
    for (const record of transactionState.records) {
      const id = String(record.id ?? record._id ?? record.cloudId ?? '');
      const occurredAt = Number(record.occurredAt ?? 0);
      if (
        !id ||
        record.deletedAt !== undefined ||
        occurredAt < range.startAt ||
        occurredAt >= Math.min(range.endAt, (referenceAt ?? Date.now()) + 1) ||
        !['expense', 'income', 'transfer', 'refund', 'adjustment'].includes(record.type ?? '')
      )
        continue;
      const account = accountById.get(accountFilter);
      if (
        accountFilter !== 'all' &&
        !(account ? aliases(account) : [accountFilter]).includes(String(record.accountId ?? ''))
      )
        continue;
      const category = categoryById.get(categoryFilter);
      if (
        categoryFilter !== 'all' &&
        !(category ? aliases(category) : [categoryFilter]).includes(String(record.categoryId ?? ''))
      )
        continue;
      const kind: ActivityKind =
        record.groupId && record.type === 'expense' ? 'group' : (record.type as ActivityKind);
      const amountMinor = asMinor(record.amountMinor);
      records.set(id, record);
      activity.push({
        id,
        ownerId: userId ?? '',
        kind,
        occurredAt,
        ...(record.merchant ? { merchant: record.merchant } : {}),
        amountMinor,
      });
    }
    const needle = query.trim().toLocaleLowerCase();
    return filterActivity(activity, filter)
      .filter((row) => {
        if (!needle) return true;
        const record = records.get(row.id);
        if (!record) return false;
        const account = accountById.get(record.accountId ?? '');
        const category = categoryById.get(record.categoryId ?? '');
        return [
          record.title,
          record.merchant,
          account?.name,
          category?.name,
          record.amountMinor,
          formatMinor(row.amountMinor, record.currency ?? currency),
        ].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(needle),
        );
      })
      .sort((left, right) => right.occurredAt - left.occurredAt)
      .map((row) => records.get(row.id)!)
      .filter((record) => (record.currency ?? currency) === currency);
  }, [
    accountById,
    accountFilter,
    categoryById,
    categoryFilter,
    currency,
    filter,
    query,
    range,
    referenceAt,
    transactionState.records,
    userId,
  ]);

  const totals = React.useMemo(
    () =>
      rows.reduce<{ income: bigint; expenses: bigint; transfers: bigint; count: number }>(
        (sum, record) => {
          if (record.status === 'pending' || record.status === 'voided') return sum;
          const amount = asMinor(record.amountMinor);
          if (record.type === 'income') sum.income += amount;
          if (record.type === 'expense') sum.expenses += amount;
          if (record.type === 'transfer') sum.transfers += amount;
          sum.count += 1;
          return sum;
        },
        { income: 0n, expenses: 0n, transfers: 0n, count: 0 },
      ),
    [rows],
  );
  const metricSparks = React.useMemo(() => {
    const recent = rows
      .filter((record) => record.status !== 'pending' && record.status !== 'voided')
      .slice(0, 5)
      .reverse();
    const valuesFor = (kind: 'spent' | 'income' | 'net' | 'count') => {
      const values = recent.map((record) => {
        const amount = asMinor(record.amountMinor);
        if (kind === 'count') return 1n;
        if (kind === 'spent') return record.type === 'expense' ? amount : 0n;
        if (kind === 'income') return record.type === 'income' ? amount : 0n;
        if (record.type === 'income') return amount;
        if (record.type === 'expense') return -amount;
        return 0n;
      });
      const largest = values.reduce((max, value) => {
        const absolute = value < 0n ? -value : value;
        return absolute > max ? absolute : max;
      }, 0n);
      return values.map((value) =>
        largest > 0n ? Math.max(8, Number(((value < 0n ? -value : value) * 100n) / largest)) : 0,
      );
    };
    return {
      spent: valuesFor('spent'),
      income: valuesFor('income'),
      net: valuesFor('net'),
      count: valuesFor('count'),
    };
  }, [rows]);

  const topCategories = React.useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const row of rows) {
      if (row.type !== 'expense' || row.status === 'pending' || row.status === 'voided') continue;
      const id = String(row.categoryId ?? '__uncategorized__');
      totals.set(id, (totals.get(id) ?? 0n) + asMinor(row.amountMinor));
    }
    return [...totals]
      .map(([id, amount]) => ({ id, amount, category: categoryById.get(id) }))
      .sort((a, b) => (a.amount === b.amount ? 0 : a.amount > b.amount ? -1 : 1))
      .slice(0, 5);
  }, [categoryById, rows]);
  const categoryTotal = rows.reduce(
    (sum, row) =>
      row.type === 'expense' && row.status !== 'pending' && row.status !== 'voided'
        ? sum + asMinor(row.amountMinor)
        : sum,
    0n,
  );
  const allError =
    transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  const ready =
    referenceAt !== null &&
    !!profile &&
    !transactionState.loading &&
    !accountState.loading &&
    !categoryState.loading &&
    !profileState.loading;

  const selectRange = (nextPeriod: ActivityPeriod) => {
    setPeriod(nextPeriod);
    setCustomRange(null);
  };
  const setQuickRange = (
    name: 'Today' | 'This week' | 'This month' | 'Last month' | 'All time',
  ) => {
    if (referenceAt === null) return;
    if (name === 'Today') {
      setCustomRange(rangeFromDay(referenceAt, timeZone));
      return;
    }
    if (name === 'All time') {
      setPeriod('all');
      setCustomRange(null);
      return;
    }
    if (name === 'This week') {
      setPeriod('week');
      setCustomRange(null);
      return;
    }
    const monthRange = getAnalyticsRange('month', referenceAt, timeZone);
    if (name === 'This month') {
      setPeriod('month');
      setCustomRange(null);
    } else {
      setPeriod('month');
      setCustomRange({
        startAt: monthRange.previousStartAt,
        endAt: monthRange.startAt,
        label: 'Last month',
      });
    }
  };

  const net = totals.income - totals.expenses;
  const transactionItems = React.useMemo(
    () =>
      rows.map((record) => {
        const id = String(record.id ?? record._id ?? record.cloudId ?? '');
        const category = categoryById.get(record.categoryId ?? '');
        const account = accountById.get(record.accountId ?? '');
        const occurredAt = Number(record.occurredAt ?? 0);
        const type = (record.type ?? 'expense') as TransactionType;
        return {
          id,
          title: record.title || record.merchant || 'Transaction',
          category: category?.name ?? 'Uncategorized',
          categoryIcon: category?.icon,
          account: account?.name,
          merchant: record.merchant,
          date: occurredAt
            ? formatTransactionDate(occurredAt, record.hasTime === true, timeZone)
            : 'Saved offline',
          amountMinor: asMinor(record.amountMinor),
          currency: record.currency ?? currency,
          type,
        };
      }),
    [accountById, categoryById, currency, rows, timeZone],
  );
  const categoryItems = React.useMemo<ActivityCategoryItem[]>(
    () =>
      topCategories.map(({ id, amount, category }) => ({
        id,
        name: category?.name ?? (id === '__uncategorized__' ? 'Uncategorized' : 'Category'),
        icon: typeof category?.icon === 'string' ? category.icon : '•',
        amount: formatMinor(amount, currency),
        share: categoryTotal > 0n ? Number((amount * 1000n) / categoryTotal) / 10 : 0,
      })),
    [categoryTotal, currency, topCategories],
  );
  if (!userId)
    return (
      <FinanceSignedOut
        section="ACTIVITY"
        title="Activity unavailable"
        description="Sign in to see your ledger."
      />
    );
  if (!profileState.loading && !profile)
    return (
      <FinanceSignedOut
        section="ACTIVITY"
        title="Activity unavailable"
        description="Your local profile could not be found."
      />
    );
  const pickerReferenceAt = customRange?.startAt ?? referenceAt ?? Date.now();
  const pickerEndAt = customRange
    ? Math.max(customRange.startAt, customRange.endAt - 1)
    : pickerReferenceAt;
  const rangeLabel = range ? formatRange(range, timeZone) : 'Choose dates';

  return (
    <div className="finance-page activity-page">
      <ActivityHeader
        query={query}
        onQueryChange={setQuery}
        onClearQuery={() => setQuery('')}
        onOpenAnalytics={() => router.push('/analytics')}
        onAddTransaction={() => router.push('/transaction/new')}
      />
      <ActivityFilters
        rangeLabel={rangeLabel}
        rangeStartDate={getAnalyticsCalendarDate(pickerReferenceAt, timeZone)}
        rangeEndDate={getAnalyticsCalendarDate(pickerEndAt, timeZone)}
        presets={periodPresets}
        period={customRange ? undefined : `period:${period}`}
        onPresetSelect={(value) => {
          const [kind, selected] = value.split(':');
          if (kind === 'period') selectRange(selected as ActivityPeriod);
          else if (kind === 'quick') setQuickRange(selected as Parameters<typeof setQuickRange>[0]);
        }}
        onRangeApply={(startDate, endDate) => {
          const bounds = getAnalyticsCustomRange(startDate, endDate, timeZone);
          setPeriod('month');
          setCustomRange({ ...bounds, label: '' });
        }}
        filters={filters.map((value) => ({ value, label: value }))}
        filter={filter}
        onFilterChange={(value) => setFilter(value as ActivityFilter)}
        accounts={accountState.records
          .filter((item) => !item.archivedAt && aliases(item).length > 0)
          .map((item) => ({ id: aliases(item)[0], label: item.name ?? 'Account' }))}
        account={accountFilter}
        onAccountChange={setAccountFilter}
        categories={categoryState.records
          .filter((item) => !item.archivedAt && aliases(item).length > 0)
          .map((item) => ({ id: aliases(item)[0], label: item.name ?? 'Category' }))}
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
      />

      {(rangeLoading || rangeError || allError) && (
        <ActivityStatus
          message={
            rangeLoading
              ? 'Refreshing activity…'
              : rangeError || 'Some saved records could not be loaded.'
          }
          alert={Boolean(rangeError || allError)}
          onRetry={rangeError || allError ? () => window.location.reload() : undefined}
        />
      )}

      {ready && (
        <ActivitySummary
          metrics={[
            {
              label: 'Total Spent',
              icon: 'spent',
              value: formatMinor(totals.expenses, currency),
              color: 'var(--finapp-expense)',
              spark: metricSparks.spent,
            },
            {
              label: 'Total Income',
              icon: 'income',
              value: formatMinor(totals.income, currency),
              color: 'var(--finapp-income)',
              spark: metricSparks.income,
            },
            {
              label: 'Net',
              icon: 'net',
              value: formatMinor(net, currency),
              color: net >= 0n ? 'var(--finapp-income)' : 'var(--finapp-expense)',
              spark: metricSparks.net,
            },
            {
              label: 'Transactions',
              icon: 'transactions',
              value: String(totals.count),
              color: 'var(--finapp-foreground)',
              spark: metricSparks.count,
            },
          ]}
        />
      )}

      {range && (
        <Typography className="activity-range-caption" variant="caption">
          {formatRange(range, timeZone)} · {currency}
        </Typography>
      )}

      <div className="activity-content-grid">
        <ActivityTransactionList
          items={transactionItems}
          loading={!ready && !allError}
          query={query}
          onSelect={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
        />
        <aside className="activity-sidebar">
          <ActivityActions
            onAddTransaction={() => router.push('/transaction/new')}
            onOpenTransactions={() => router.push('/transactions')}
            onOpenAnalytics={() => router.push('/analytics')}
          />
          <ActivityTopCategories
            items={categoryItems}
            rangeLabel={range ? formatRange(range, timeZone) : 'Loading range'}
            onSelect={(id) =>
              router.push(
                categoryById.has(id) ? `/category/${encodeURIComponent(id)}` : '/analytics',
              )
            }
          />
        </aside>
      </div>
    </div>
  );
}
