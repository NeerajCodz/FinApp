import React, { Component, useMemo, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import {
  aggregateAnalytics, getAnalyticsRange, validateAnalyticsRange,
  type AnalyticsBreakdownItem, type AnalyticsPeriod,
} from '@convex/analytics/domain';
import { ArrowLeft, ReceiptText } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BreakdownDonut, CashFlowChart } from '@/components/charts/BarChart';
import { Money, TransactionRow } from '@/components/finance';
import { Button, Empty, IconButton, SectionHeader, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { formatMinor } from '@/lib/money';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { analyticsEntities, ledgerTransaction, recordId, recordIndex, transactionRow } from '@/lib/ledger';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type AnalyticsProps = { children: React.ReactNode };
type AnalyticsState = { hasError: boolean };

class AnalyticsErrorBoundary extends Component<AnalyticsProps, AnalyticsState> {
  state: AnalyticsState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Typography variant="heading">Analytics couldn’t load</Typography>
        <Text>Check your data and try again.</Text>
        <Button onPress={() => this.setState({ hasError: false })}>Try again</Button>
      </View>
    );
    return this.props.children;
  }
}

function RankedBreakdown({
  items, totalMinor, currency, onSelect,
}: {
  items: readonly AnalyticsBreakdownItem[];
  totalMinor: bigint;
  currency: string;
  onSelect: (item: AnalyticsBreakdownItem) => void;
}) {
  const { tokens } = useTheme();
  if (!items.length) return <Empty title="No expenses to break down" description="Posted expenses in this period will appear here." />;
  return <View style={{ gap: 4 }}>
    {items.map((item, index) => {
      const share = totalMinor > 0n ? Number((item.amountMinor * 1000n) / totalMinor) / 10 : 0;
      return <TouchableOpacity key={item.id} accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${formatMinor(item.amountMinor, currency)}, ${share}% of spending`}
        onPress={() => onSelect(item)} activeOpacity={0.65}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
        <Typography variant="caption" style={{ color: tokens.primary, width: 20 }}>{String(index + 1).padStart(2, '0')}</Typography>
        <Typography variant="small" numberOfLines={2} style={{ flex: 1 }}>{item.label}</Typography>
        <View style={{ alignItems: 'flex-end' }}>
          <Typography variant="small">{formatMinor(item.amountMinor, currency)}</Typography>
          <Typography variant="caption">{share}%</Typography>
        </View>
      </TouchableOpacity>;
    })}
  </View>;
}

function AnalyticsContent() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const profile = profileState.data?.[0];
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const range = useMemo(() => getAnalyticsRange(period, Date.now(), timeZone), [period, timeZone]);
  const rangeState = useLocalTransactionRange<LocalRecord>(
    userId, range.previousStartAt, range.endAt, fetchTransactionRange,
  );
  const analytics = useMemo(() => {
    if (!profile || !categoryState.data || !accountState.data || !rangeState.data) return null;
    validateAnalyticsRange(period, range.startAt, range.endAt);
    validateAnalyticsRange(period, range.previousStartAt, range.startAt);
    const transactions = rangeState.data.flatMap((record) => {
      const transaction = ledgerTransaction(record);
      return transaction ? [transaction] : [];
    });
    const categories = analyticsEntities(categoryState.data);
    const accounts = analyticsEntities(accountState.data);
    const current = aggregateAnalytics(transactions, categories, currency, period, range.startAt, range.endAt, timeZone, accounts);
    const previous = aggregateAnalytics(transactions, categories, currency, period, range.previousStartAt, range.startAt, timeZone, accounts);
    const largest = rangeState.data.filter((record) => {
      const transaction = ledgerTransaction(record);
      return transaction?.type === 'expense' && transaction.status === 'posted' &&
        transaction.deletedAt === undefined && transaction.currency === currency &&
        transaction.occurredAt >= range.startAt && transaction.occurredAt < range.endAt;
    }).sort((a, b) => (b.amountMinor as bigint) > (a.amountMinor as bigint) ? 1 : (b.amountMinor as bigint) < (a.amountMinor as bigint) ? -1 : 0).slice(0, 5);
    return { ...current, previousSpentMinor: previous.spentMinor, largest };
  }, [profile, categoryState.data, accountState.data, rangeState.data, currency, period, range, timeZone]);
  const accounts = useMemo(() => recordIndex(accountState.data ?? []), [accountState.data]);
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
  const error = profileState.error || categoryState.error || accountState.error || rangeState.error;
  const hasRangeData = rangeState.covered || Boolean(rangeState.data?.length);
  const retry = () => { profileState.retry(); categoryState.retry(); accountState.retry(); rangeState.retry(); };
  const navigate = (dimension: 'category' | 'account' | 'merchant', item: AnalyticsBreakdownItem) => {
    router.push({ pathname: '/analytics/breakdown/[dimension]', params: {
      dimension, key: item.id, period,
      startAt: String(range.startAt), endAt: String(range.endAt),
    } });
  };
  const comparison = analytics ? analytics.previousSpentMinor === 0n
    ? analytics.spentMinor === 0n ? 'No spending in either period' : 'No spending in the previous period'
    : `${analytics.spentMinor >= analytics.previousSpentMinor ? 'Up' : 'Down'} ${
      (((analytics.spentMinor - analytics.previousSpentMinor) * 100n) / analytics.previousSpentMinor < 0n
        ? -((analytics.spentMinor - analytics.previousSpentMinor) * 100n) / analytics.previousSpentMinor
        : ((analytics.spentMinor - analytics.previousSpentMinor) * 100n) / analytics.previousSpentMinor
      ).toString()}% vs previous period` : '';
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 64, gap: 30 }}
    showsVerticalScrollIndicator={false}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="title">Analytics</Typography>
    </View>
    <Tabs value={period} onChange={(value) => setPeriod(value as AnalyticsPeriod)} tabs={[
      { label: 'Week', value: 'week' }, { label: 'Month', value: 'month' }, { label: 'Year', value: 'year' },
    ]} />
    {error && <View style={{ gap: 10 }} accessibilityRole="alert">
      <Typography variant="small">{analytics && hasRangeData ? 'Showing saved data. Refresh failed; totals may be incomplete.' : 'Analytics data is unavailable.'}</Typography>
      <Button onPress={retry}>Retry</Button>
    </View>}
    {rangeState.refreshing && <Typography variant="caption">Refreshing transactions…</Typography>}
    {!userId || (profileState.data && !profile) ? (
      <Empty title="Analytics unavailable" description="Sign in to see your spending and income." />
    ) : (!analytics || !hasRangeData) && !error ? (
      <Typography variant="heading" accessibilityLabel="Loading analytics">Loading analytics…</Typography>
    ) : analytics && hasRangeData && <>
      <View style={{ gap: 8 }}>
        <Typography variant="caption">{period.toUpperCase()} · {currency}</Typography>
        <Typography variant="display">Money in motion.</Typography>
        <View style={{ marginTop: 8, gap: 6 }}>
          <Typography variant="label">Spent</Typography>
          <Money amountMinor={analytics.spentMinor} currency={currency} size="display" />
          <Typography variant="caption">{comparison}</Typography>
        </View>
        <View style={{ flexDirection: 'row', gap: 32, marginTop: 12 }}>
          <View style={{ gap: 4 }}><Typography variant="caption">Income</Typography><Money amountMinor={analytics.incomeMinor} currency={currency} type="income" /></View>
          <View style={{ gap: 4 }}><Typography variant="caption">Net</Typography><Typography variant="heading">{formatMinor(analytics.incomeMinor - analytics.spentMinor, currency)}</Typography></View>
        </View>
      </View>
      {rangeState.covered && analytics.spentMinor === 0n && analytics.incomeMinor === 0n &&
        <View style={{ alignItems: 'center', paddingVertical: 20, gap: 10 }}>
          <ReceiptText size={28} color={tokens.foregroundMuted} />
          <Typography variant="bodyLarge">No activity in this period</Typography>
          <Typography variant="small" style={{ textAlign: 'center' }}>
            Record a transaction to start seeing trends.
          </Typography>
          <Button size="sm" variant="outline" onPress={() => router.push('/transaction/new')}>
            Add transaction
          </Button>
        </View>}
      <View style={{ gap: 16 }}>
        <SectionHeader title="Cash flow" />
        <CashFlowChart buckets={analytics.buckets} currency={currency} />
      </View>
      <View style={{ gap: 16 }}>
        <Typography variant="bodyLarge">Spending by category</Typography>
        <BreakdownDonut items={analytics.categoryBreakdown} totalMinor={analytics.spentMinor} currency={currency}
          iconForCategory={(id) => {
            const icon = categories.get(id)?.icon;
            return typeof icon === 'string' ? icon : undefined;
          }}
          onSelectItem={(item) => navigate('category', item)} />
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="By account" />
        <RankedBreakdown items={analytics.accountBreakdown} totalMinor={analytics.spentMinor} currency={currency}
          onSelect={(item) => navigate('account', item)} />
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="By merchant" />
        <RankedBreakdown items={analytics.merchantBreakdown} totalMinor={analytics.spentMinor} currency={currency}
          onSelect={(item) => navigate('merchant', item)} />
      </View>
      <View style={{ gap: 6 }}>
        <SectionHeader title="Compared with last period" />
        <Typography variant="heading">{comparison}</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>Previously spent {formatMinor(analytics.previousSpentMinor, currency)}</Text>
      </View>
      <View style={{ gap: 12 }}>
        <SectionHeader title="Largest expenses" />
        {analytics.largest.length === 0 ? <Empty title="No expenses yet" description="Your largest posted expenses in this period will appear here." />
          : analytics.largest.map((record) => {
            const row = transactionRow(record, accounts, categories, timeZone);
            const id = recordId(record);
            return row && id ? <TransactionRow key={id} {...row} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id } })} /> : null;
          })}
      </View>
    </>}
  </ScrollView>;
}

export default function AnalyticsScreen() {
  return <AnalyticsErrorBoundary><AnalyticsContent /></AnalyticsErrorBoundary>;
}
