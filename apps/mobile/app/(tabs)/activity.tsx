import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateSection, MetricPair, TransactionRow } from '@finapp/ui/finance';
import { Button, Empty, Input, Tabs, Typography, useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';
import {
  aggregateAnalytics,
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
type QuickRange = 'today' | 'week' | 'month' | 'lastMonth' | 'all' | null;

function scalarParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type DrillRange = { startAt: number; endAt: number };
type ActivityCategoryTotal = { id: string; label: string; amountMinor: bigint };

function FilterRail({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Typography variant="caption">{label}</Typography>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
          {options.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={option.id === value ? 'primary' : 'outline'}
              onPress={() => onChange(option.id)}
              style={option.id === value ? { backgroundColor: tokens.primary } : undefined}
            >
              {option.label}
            </Button>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

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
      ...(categoryState.data ?? []).flatMap((record) => {
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
        if (accountFilter !== 'all' && recordId(accounts.get(transaction.accountId ?? '') ?? {}) !== accountFilter)
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
      quickRange === 'lastMonth' || quickRange === 'month' ? 'month' : quickRange === 'week' || quickRange === 'today' ? 'week' : period,
      range.startAt,
      range.endAt,
      timeZone,
      analyticsEntities(accountState.data ?? []),
    );
  }, [visible, categoryState.data, accountState.data, currency, period, quickRange, range, timeZone]);
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
  const topCategories = useMemo<ActivityCategoryTotal[]>(() => {
    const totals = new Map<string, ActivityCategoryTotal>();
    for (const record of rangeState.data ?? []) {
      const transaction = ledgerTransaction(record);
      if (
        !transaction ||
        transaction.type !== 'expense' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== currency ||
        transaction.occurredAt < range.startAt ||
        transaction.occurredAt >= range.endAt
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
  }, [rangeState.data, range.startAt, range.endAt, currency, categories]);

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
      <View style={{ gap: 5 }}>
        <Typography variant="title">Activity</Typography>
        <Typography variant="small">Your saved transactions, in one place.</Typography>
      </View>
      <Input
        accessibilityLabel="Search transactions"
        placeholder="Search title, merchant, category, account, or amount"
        value={query}
        onChangeText={setQuery}
      />
      <View style={{ gap: 12 }}>
        <Typography variant="caption">PERIOD · {rangeLabel}</Typography>
        <Tabs
          value={period}
          onChange={(value) => {
            setPeriod(value as AnalyticsPeriod);
            setQuickRange(null);
            setDrillRange(null);
          }}
          tabs={[
            { label: 'Week', value: 'week' },
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8, paddingRight: 16 }}>
            {[
              { label: 'Today', value: 'today' as const },
              { label: 'This week', value: 'week' as const },
              { label: 'This month', value: 'month' as const },
              { label: 'Last month', value: 'lastMonth' as const },
              { label: 'All time', value: 'all' as const },
            ].map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={quickRange === option.value ? 'secondary' : 'outline'}
                onPress={() => {
                  setQuickRange(option.value);
                  if (option.value === 'week' || option.value === 'today') setPeriod('week');
                  if (option.value === 'month' || option.value === 'lastMonth')
                    setPeriod('month');
                  setDrillRange(null);
                }}
              >
                {option.label}
              </Button>
            ))}
          </View>
        </ScrollView>
      </View>
      <View style={{ gap: 14, padding: 16, borderRadius: 18, backgroundColor: tokens.surfaceSubtle }}>
        {ready ? (
          <>
            <MetricPair
              left={{ label: 'Income', value: formatMinor(totals.incomeMinor, currency) }}
              right={{ label: 'Expenses', value: formatMinor(totals.spentMinor, currency) }}
            />
            <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
            <MetricPair
              left={{ label: 'Transfers', value: formatMinor(transferMinor, currency) }}
              right={{ label: 'Transactions', value: String(count) }}
            />
            <Typography variant="caption">Posted transactions · {currency}</Typography>
          </>
        ) : (
          <Typography variant="caption">Totals will appear when saved activity is ready.</Typography>
        )}
      </View>
      <View style={{ gap: 13, padding: 16, borderRadius: 18, backgroundColor: tokens.surfaceSubtle }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="heading">Top categories</Typography>
          <Typography variant="caption">{rangeLabel}</Typography>
        </View>
        {ready && topCategories.length ? (
          topCategories.map((category, index) => {
            const maximum = topCategories[0]?.amountMinor ?? 0n;
            const percentage = maximum > 0n ? Number((category.amountMinor * 100n) / maximum) : 0;
            const colors = [
              tokens.chart.volt,
              tokens.chart.blue,
              tokens.chart.violet,
              tokens.chart.orange,
              tokens.chart.pink,
            ];
            return (
              <View key={category.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Typography variant="small" numberOfLines={1}>{category.label}</Typography>
                  <Typography variant="small">{formatMinor(category.amountMinor, currency)}</Typography>
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
                      width: `${percentage}%`,
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: colors[index % colors.length],
                    }}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <Typography variant="caption">
            {ready ? 'No posted expenses in this period.' : 'Category totals will appear when activity is ready.'}
          </Typography>
        )}
      </View>
      <View style={{ gap: 16 }}>
        <FilterRail
          label="TYPE"
          value={filter}
          options={filters.map((value) => ({ id: value, label: value }))}
          onChange={(value) => setFilter(value as ActivityFilter)}
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
      {!userId || (profileState.data && !profile) ? (
        <Empty title="Activity unavailable" description="Sign in to see your ledger." />
      ) : !ready && !error ? (
        <Typography variant="heading" accessibilityLabel="Loading activity">
          Loading activity…
        </Typography>
      ) : ready && sections.length === 0 && rangeState.covered ? (
        <Empty
          title={query ? 'No search matches' : 'No activity this period'}
          description={
            query
              ? 'Try another title, merchant, category, account, or amount.'
              : 'No saved transactions match the selected period and filters.'
          }
        />
      ) : ready && sections.length === 0 ? (
        <Typography variant="small">
          No matching saved rows. Refresh to confirm the full period.
        </Typography>
      ) : ready ? (
        sections.map(([date, records]) => (
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
        ))
      ) : error ? (
        <Empty
          title="Activity unavailable"
          description="Saved activity could not be loaded. Retry to refresh your local view."
        />
      ) : null}
    </ScrollView>
  );
}
