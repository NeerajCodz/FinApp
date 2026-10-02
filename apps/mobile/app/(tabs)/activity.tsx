import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityFilters } from '@finapp/ui/activity';
import { CategoryIcon, DateSection, TransactionRow } from '@finapp/ui/finance';
import { FinanceEmptyState } from '@finapp/ui/finance';
import { Button, Empty, IconButton, Input, Typography, useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';

import {
  aggregateAnalytics,
  getAnalyticsCalendarDate,
  getAnalyticsCustomRange,
  getAnalyticsRange,
  getAnalyticsDayRange,
  type AnalyticsPeriod,
} from '@convex/analytics/domain';
import { filterActivity, type ActivityFilter, type ActivityKind } from '@convex/activity/domain';
import { formatMinor } from '@/lib/money';
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

const filters: ActivityFilter[] = ['All', 'Expenses', 'Income', 'Transfers', 'Groups'];
const periodPresets = [
  { label: 'Week', value: 'period:week' },
  { label: 'Month', value: 'period:month' },
  { label: 'Year', value: 'period:year' },
  { label: 'Today', value: 'quick:today' },
  { label: 'This week', value: 'quick:week' },
  { label: 'This month', value: 'quick:month' },
  { label: 'Last month', value: 'quick:lastMonth' },
  { label: 'All time', value: 'quick:all' },
];
type QuickRange = 'today' | 'week' | 'month' | 'lastMonth' | 'all' | null;

function scalarParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type DrillRange = { startAt: number; endAt: number };
type ActivityCategoryTotal = { id: string; label: string; amountMinor: bigint };

export default function ActivityScreen() {
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [quickRange, setQuickRange] = useState<QuickRange>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const params = useLocalSearchParams<{
    period?: string | string[];
    startAt?: string | string[];
    endAt?: string | string[];
  }>();
  const routePeriod = scalarParam(params.period);
  const routeStart = scalarParam(params.startAt);
  const routeEnd = scalarParam(params.endAt);
  const [drillRange, setDrillRange] = useState<DrillRange | null>(null);
  useEffect(() => {
    if (!routeStart || !routeEnd || !/^\d+$/.test(routeStart) || !/^\d+$/.test(routeEnd)) return;
    const startAt = Number(routeStart);
    const endAt = Number(routeEnd);
    if (!Number.isSafeInteger(startAt) || !Number.isSafeInteger(endAt) || endAt <= startAt) return;
    setDrillRange({ startAt, endAt });
    if (routePeriod === 'week' || routePeriod === 'month' || routePeriod === 'year')
      setPeriod(routePeriod);
    setQuickRange(null);
  }, [routePeriod, routeStart, routeEnd]);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange, isConnected } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const profile = profileState.data?.[0];
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  const range = useMemo(() => {
    if (drillRange) return { ...drillRange, previousStartAt: drillRange.startAt };
    const now = Date.now();
    if (quickRange === 'all') return { startAt: 0, endAt: now + 1, previousStartAt: 0 };
    if (quickRange === 'today')
      return { ...getAnalyticsDayRange(now, timeZone), previousStartAt: 0 };
    if (quickRange === 'week') return getAnalyticsRange('week', now, timeZone);
    if (quickRange === 'month') return getAnalyticsRange('month', now, timeZone);
    if (quickRange === 'lastMonth') {
      const currentMonth = getAnalyticsRange('month', now, timeZone);
      return getAnalyticsRange('month', currentMonth.startAt - 1, timeZone);
    }
    return getAnalyticsRange(period, now, timeZone);
  }, [period, quickRange, timeZone, drillRange]);
  const rangeState = useLocalTransactionRange<LocalRecord>(
    userId,
    range.startAt,
    range.endAt,
    fetchTransactionRange,
  );
  const accounts = useMemo(() => recordIndex(accountState.data ?? []), [accountState.data]);
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
  const accountOptions = useMemo(
    () => [
      { id: 'all', label: 'All accounts' },
      ...(accountState.data ?? [])
        .filter((record) => record.archivedAt === undefined)
        .flatMap((record) => {
          const id = recordId(record);
          return id && typeof record.name === 'string'
            ? [{ id, label: displayAccountName(record.name) }]
            : [];
        }),
    ],
    [accountState.data],
  );
  const categoryOptions = useMemo(
    () => [
      { id: 'all', label: 'All categories' },
      ...(categoryState.data ?? [])
        .filter((record) => record.archivedAt === undefined)
        .flatMap((record) => {
          const id = recordId(record);
          return id && typeof record.name === 'string' ? [{ id, label: record.name }] : [];
        }),
    ],
    [categoryState.data],
  );
  const visible = useMemo(() => {
    if (!rangeState.data) return [];
    const records = new Map(rangeState.data.map((record) => [recordId(record), record]));
    const rows = rangeState.data.flatMap((record) => {
      const transaction = ledgerTransaction(record);
      const id = recordId(record);
      if (
        !transaction ||
        !id ||
        transaction.deletedAt !== undefined ||
        transaction.occurredAt < range.startAt ||
        transaction.occurredAt >= range.endAt
      )
        return [];
      const kind: ActivityKind =
        record.groupId && transaction.type === 'expense' ? 'group' : transaction.type;
      return [
        {
          id,
          ownerId: userId ?? '',
          kind,
          occurredAt: transaction.occurredAt,
          merchant: transaction.merchant,
          amountMinor: transaction.amountMinor,
        },
      ];
    });
    const needle = query.trim().toLocaleLowerCase();
    return filterActivity(rows, filter)
      .filter((row) => {
        const record = records.get(row.id);
        const transaction = record ? ledgerTransaction(record) : null;
        if (!record || !transaction) return false;
        if (transaction.currency !== currency) return false;
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
        if (!needle) return true;
        const accountName = accounts.get(transaction.accountId ?? '')?.name;
        return [
          transaction.title,
          transaction.merchant,
          categories.get(transaction.categoryId ?? '')?.name,
          typeof accountName === 'string' ? displayAccountName(accountName) : undefined,
          transaction.amountMinor.toString(),
          formatMinor(transaction.amountMinor, transaction.currency),
        ].some((value) =>
          String(value ?? '')
            .toLocaleLowerCase()
            .includes(needle),
        );
      })
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .map((row) => records.get(row.id)!);
  }, [
    rangeState.data,
    range.startAt,
    range.endAt,
    currency,
    userId,
    query,
    filter,
    categoryFilter,
    accountFilter,
    accounts,
    categories,
  ]);
  const totals = useMemo(() => {
    if (quickRange === 'all') {
      let spentMinor = 0n;
      let incomeMinor = 0n;
      for (const record of visible) {
        const transaction = ledgerTransaction(record);
        if (
          !transaction ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined ||
          transaction.currency !== currency
        )
          continue;
        if (transaction.type === 'expense') spentMinor += transaction.amountMinor;
        if (transaction.type === 'income') incomeMinor += transaction.amountMinor;
      }
      return { spentMinor, incomeMinor };
    }
    return aggregateAnalytics(
      visible.flatMap((record) => {
        const transaction = ledgerTransaction(record);
        return transaction ? [transaction] : [];
      }),
      analyticsEntities(categoryState.data ?? []),
      currency,
      quickRange === 'lastMonth' || quickRange === 'month'
        ? 'month'
        : quickRange === 'week' || quickRange === 'today'
          ? 'week'
          : period,
      range.startAt,
      range.endAt,
      timeZone,
      analyticsEntities(accountState.data ?? []),
    );
  }, [
    visible,
    categoryState.data,
    accountState.data,
    currency,
    period,
    quickRange,
    range,
    timeZone,
  ]);
  const count = useMemo(
    () =>
      visible.filter((record) => {
        const transaction = ledgerTransaction(record);
        return (
          transaction?.status === 'posted' &&
          transaction.deletedAt === undefined &&
          transaction.currency === currency
        );
      }).length,
    [visible, currency],
  );
  const transferMinor = useMemo(
    () =>
      visible.reduce((sum, record) => {
        const transaction = ledgerTransaction(record);
        return transaction &&
          transaction.type === 'transfer' &&
          transaction.status === 'posted' &&
          transaction.deletedAt === undefined &&
          transaction.currency === currency
          ? sum + transaction.amountMinor
          : sum;
      }, 0n),
    [visible, currency],
  );
  const metricSparks = useMemo(() => {
    const recent = visible
      .filter((record) => {
        const transaction = ledgerTransaction(record);
        return transaction && transaction.status !== 'pending' && transaction.status !== 'voided';
      })
      .slice(0, 5)
      .reverse();
    const valuesFor = (kind: 'spent' | 'income' | 'net' | 'count') => {
      const values = recent.map((record) => {
        const transaction = ledgerTransaction(record);
        if (!transaction) return 0n;
        if (kind === 'count') return 1n;
        if (kind === 'spent') return transaction.type === 'expense' ? transaction.amountMinor : 0n;
        if (kind === 'income') return transaction.type === 'income' ? transaction.amountMinor : 0n;
        if (transaction.type === 'income') return transaction.amountMinor;
        if (transaction.type === 'expense') return -transaction.amountMinor;
        return 0n;
      });
      const largest = values.reduce((max, value) => {
        const absolute = value < 0n ? -value : value;
        return absolute > max ? absolute : max;
      }, 0n);
      return values.map((value) => {
        const absolute = value < 0n ? -value : value;
        return largest > 0n ? Math.max(8, Number((absolute * 100n) / largest)) : 0;
      });
    };
    return {
      spent: valuesFor('spent'),
      income: valuesFor('income'),
      net: valuesFor('net'),
      count: valuesFor('count'),
    };
  }, [visible]);
  const categoryTotal = useMemo(
    () =>
      visible.reduce((sum, record) => {
        const transaction = ledgerTransaction(record);
        return transaction &&
          transaction.type === 'expense' &&
          transaction.status === 'posted' &&
          transaction.deletedAt === undefined &&
          transaction.currency === currency
          ? sum + transaction.amountMinor
          : sum;
      }, 0n),
    [visible, currency],
  );
  const topCategories = useMemo<ActivityCategoryTotal[]>(() => {
    const totals = new Map<string, ActivityCategoryTotal>();
    for (const record of visible) {
      const transaction = ledgerTransaction(record);
      if (
        !transaction ||
        transaction.type !== 'expense' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency
      )
        continue;
      const id = transaction.categoryId ?? '__uncategorized__';
      const category = categories.get(id);
      const current = totals.get(id);
      if (current) current.amountMinor += transaction.amountMinor;
      else
        totals.set(id, {
          id,
          label:
            typeof category?.name === 'string'
              ? category.name
              : transaction.categoryId
                ? 'Former category'
                : 'Uncategorized',
          amountMinor: transaction.amountMinor,
        });
    }
    return [...totals.values()]
      .sort((a, b) =>
        a.amountMinor === b.amountMinor
          ? a.label.localeCompare(b.label)
          : a.amountMinor > b.amountMinor
            ? -1
            : 1,
      )
      .slice(0, 5);
  }, [visible, currency, categories]);
  const sections = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const groups = new Map<string, LocalRecord[]>();
    for (const record of visible) {
      const date = formatter.format(Number(record.occurredAt));
      const group = groups.get(date) ?? [];
      group.push(record);
      groups.set(date, group);
    }
    return [...groups];
  }, [visible, timeZone]);
  const error = profileState.error || accountState.error || categoryState.error || rangeState.error;
  const ready =
    !!profile &&
    !!accountState.data &&
    !!categoryState.data &&
    !!rangeState.data &&
    (rangeState.covered || rangeState.data.length > 0);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' }),
    [timeZone],
  );
  const rangeLabel =
    quickRange === 'all'
      ? 'All time'
      : `${dateFormatter.format(range.startAt)} – ${dateFormatter.format(range.endAt - 1)}`;
  const pickerStartAt = drillRange?.startAt ?? (quickRange === 'all' ? Date.now() : range.startAt);
  const pickerEndAt = drillRange
    ? Math.max(drillRange.startAt, drillRange.endAt - 1)
    : quickRange === 'all'
      ? Date.now()
      : Math.max(range.startAt, range.endAt - 1);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + layoutTokens.sectionGap,
        gap: 22,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <IconButton
            label="Go back"
            variant="ghost"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/(tabs)' as never)
            }
          >
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <View style={{ flex: 1, gap: 5 }}>
            <Typography variant="title">Activity</Typography>
            <Typography variant="small">Your saved transactions, in one place.</Typography>
          </View>
        </View>
        <Button size="sm" variant="ghost" onPress={() => router.push('/analytics' as never)}>
          Analytics
        </Button>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Input
          accessibilityLabel="Search transactions"
          placeholder="Search title, merchant, category, account, or amount"
          value={query}
          onChangeText={setQuery}
          style={{ flex: 1 }}
        />
        {query.length > 0 && (
          <Button size="sm" variant="ghost" onPress={() => setQuery('')}>
            Clear
          </Button>
        )}
      </View>
      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ gap: 3 }}>
            <Typography variant="bodyLarge">Quick filters</Typography>
            <Typography variant="caption">Choose the activity included below.</Typography>
          </View>
          <Button
            size="sm"
            variant="outline"
            onPress={() => router.push('/transaction/new' as never)}
          >
            Add transaction
          </Button>
        </View>
        <ActivityFilters
          rangeLabel={rangeLabel}
          rangeStartDate={getAnalyticsCalendarDate(pickerStartAt, timeZone)}
          rangeEndDate={getAnalyticsCalendarDate(pickerEndAt, timeZone)}
          presets={periodPresets}
          onPresetSelect={(value) => {
            const [kind, selected] = value.split(':');
            if (kind === 'period') {
              setPeriod(selected as AnalyticsPeriod);
              setQuickRange(null);
            } else if (kind === 'quick') {
              const selectedRange = selected as Exclude<QuickRange, null>;
              setQuickRange(selectedRange);
              if (selectedRange === 'week' || selectedRange === 'today') setPeriod('week');
              if (selectedRange === 'month' || selectedRange === 'lastMonth') setPeriod('month');
            }
            setDrillRange(null);
          }}
          onRangeApply={(startDate, endDate) => {
            setPeriod('month');
            setQuickRange(null);
            setDrillRange(getAnalyticsCustomRange(startDate, endDate, timeZone));
          }}
          filters={filters.map((value) => ({ value, label: value }))}
          filter={filter}
          onFilterChange={(value) => setFilter(value as ActivityFilter)}
          accounts={accountOptions.filter((option) => option.id !== 'all')}
          account={accountFilter}
          onAccountChange={setAccountFilter}
          categories={categoryOptions.filter((option) => option.id !== 'all')}
          category={categoryFilter}
          onCategoryChange={setCategoryFilter}
        />
      </View>
      <View
        style={{ gap: 14, padding: 16, borderRadius: 18, backgroundColor: tokens.surfaceSubtle }}
      >
        {ready ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                {
                  label: 'Total Spent',
                  value: formatMinor(totals.spentMinor, currency),
                  color: tokens.expense,
                  spark: metricSparks.spent,
                },
                {
                  label: 'Total Income',
                  value: formatMinor(totals.incomeMinor, currency),
                  color: tokens.income,
                  spark: metricSparks.income,
                },
                {
                  label: 'Net',
                  value: formatMinor(totals.incomeMinor - totals.spentMinor, currency),
                  color: totals.incomeMinor >= totals.spentMinor ? tokens.income : tokens.expense,
                  spark: metricSparks.net,
                },
                {
                  label: 'Transactions',
                  value: String(count),
                  color: tokens.foreground,
                  spark: metricSparks.count,
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
                    backgroundColor: tokens.surfaceRaised,
                  }}
                >
                  <Typography variant="caption">{item.label}</Typography>
                  <Typography
                    variant="heading"
                    numberOfLines={1}
                    style={{ color: item.color, fontVariant: ['tabular-nums'] }}
                  >
                    {item.value}
                  </Typography>
                  <View
                    style={{ height: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}
                  >
                    {item.spark.map((height, index) => (
                      <View
                        key={`${item.label}-${index}`}
                        style={{
                          flex: 1,
                          height: `${height}%`,
                          borderRadius: 2,
                          backgroundColor: item.color,
                          opacity: 0.72,
                        }}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Typography variant="caption">
              Posted transactions · {currency} · Transfers {formatMinor(transferMinor, currency)}
            </Typography>
          </>
        ) : (
          <Typography variant="caption">
            Totals will appear when saved activity is ready.
          </Typography>
        )}
      </View>
      <View
        style={{ gap: 13, padding: 16, borderRadius: 18, backgroundColor: tokens.surfaceSubtle }}
      >
        <View style={{ gap: 3 }}>
          <Typography variant="bodyLarge">Top categories</Typography>
          <Typography variant="caption">Posted expenses · {rangeLabel}</Typography>
        </View>
        {ready && topCategories.length ? (
          topCategories.map((category, index) => {
            const categoryRecord = categories.get(category.id);
            const share =
              categoryTotal > 0n ? Number((category.amountMinor * 1000n) / categoryTotal) / 10 : 0;
            const colors = [
              tokens.chart.volt,
              tokens.chart.blue,
              tokens.chart.violet,
              tokens.chart.orange,
              tokens.chart.pink,
            ];
            return (
              <TouchableOpacity
                key={category.id}
                accessibilityRole="button"
                accessibilityLabel={`${category.label}, ${formatMinor(category.amountMinor, currency)}, ${share}% of spending`}
                onPress={() => {
                  const id = categoryRecord ? recordId(categoryRecord) : '';
                  if (id) router.push({ pathname: '/category/[id]', params: { id } } as never);
                  else router.push('/analytics' as never);
                }}
                activeOpacity={0.72}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <CategoryIcon
                  label={category.label}
                  icon={typeof categoryRecord?.icon === 'string' ? categoryRecord.icon : undefined}
                />
                <View style={{ flex: 1, gap: 7 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Typography variant="small" numberOfLines={1} style={{ flex: 1 }}>
                      {category.label}
                    </Typography>
                    <Typography variant="small">
                      {formatMinor(category.amountMinor, currency)}
                    </Typography>
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: tokens.borderSubtle,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${share}%`,
                        height: '100%',
                        borderRadius: 3,
                        backgroundColor: colors[index % colors.length],
                      }}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Typography variant="caption">
            {ready
              ? 'No posted expenses in this range.'
              : 'Category totals will appear when activity is ready.'}
          </Typography>
        )}
      </View>
      {!isConnected && ready && (
        <Typography variant="caption">Offline · showing activity saved on this device.</Typography>
      )}
      {error && (
        <View style={{ gap: 10 }} accessibilityRole="alert">
          <Typography variant="small">
            {ready
              ? 'Showing saved activity. Refresh failed; totals may be incomplete.'
              : 'Activity is unavailable.'}
          </Typography>
          <Button
            onPress={() => {
              profileState.retry();
              accountState.retry();
              categoryState.retry();
              rangeState.retry();
            }}
          >
            Retry
          </Button>
        </View>
      )}
      {rangeState.refreshing && <Typography variant="caption">Refreshing activity…</Typography>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
        <Typography variant="bodyLarge">Transactions</Typography>
        <Typography variant="caption">{visible.length} records</Typography>
      </View>
      {!userId || (profileState.data && !profile) ? (
        <Empty title="Activity unavailable" description="Sign in to see your ledger." />
      ) : !ready && !error ? (
        <Typography variant="heading" accessibilityLabel="Loading activity">
          Loading activity…
        </Typography>
      ) : ready && sections.length === 0 && rangeState.covered ? (
        <FinanceEmptyState
          kind={query ? 'search' : 'activity'}
          title={query ? 'No search matches.' : 'No activity this period.'}
          description={
            query
              ? 'Try another title, merchant, category, account, or amount.'
              : 'No saved transactions match the selected period and filters.'
          }
        />
      ) : ready && sections.length === 0 ? (
        <FinanceEmptyState
          kind="search"
          title="No matching saved rows."
          description="Refresh to confirm the full period."
          compact
        />
      ) : ready ? (
        <>
          {sections.map(([date, records]) => (
            <DateSection key={date} title={date}>
              {records.map((record) => {
                const row = transactionRow(record, accounts, categories, timeZone);
                const id = recordId(record);
                return row && id ? (
                  <TransactionRow
                    key={id}
                    {...row}
                    onPress={() => router.push({ pathname: '/transaction/[id]', params: { id } })}
                  />
                ) : null;
              })}
            </DateSection>
          ))}
        </>
      ) : error ? (
        <Empty
          title="Activity unavailable"
          description="Saved activity could not be loaded. Retry to refresh your local view."
        />
      ) : null}
    </ScrollView>
  );
}
