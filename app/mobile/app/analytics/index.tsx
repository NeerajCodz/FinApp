import React, { Component, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { aggregateAnalytics, validateAnalyticsRange, type AnalyticsTransaction } from '@convex/analytics/domain';
import { ArrowLeft } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { InsightBars, SpendingLineChart } from '@/components/charts/BarChart';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, SectionHeader, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { formatMinor } from '@/lib/money';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Period = 'week' | 'month' | 'year';
type AnalyticsProps = { children: React.ReactNode };
type AnalyticsState = { hasError: boolean };

class AnalyticsErrorBoundary extends Component<AnalyticsProps, AnalyticsState> {
  state: AnalyticsState = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <Typography variant="heading">Analytics couldn’t load</Typography>
          <Text>Check your connection and try again.</Text>
          <Button onPress={() => router.replace('/analytics' as never)}>Try again</Button>
        </View>
      );
    }
    return this.props.children;
  }
}

function getRange(period: Period) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === 'month') start.setDate(1);
  if (period === 'year') start.setMonth(0, 1);
  const end = new Date(start);
  if (period === 'week') end.setDate(end.getDate() + 7);
  else if (period === 'month') end.setMonth(end.getMonth() + 1);
  else end.setFullYear(end.getFullYear() + 1);
  const previous = new Date(start);
  if (period === 'week') previous.setDate(previous.getDate() - 7);
  else if (period === 'month') previous.setMonth(previous.getMonth() - 1);
  else previous.setFullYear(previous.getFullYear() - 1);
  return { startAt: start.getTime(), endAt: end.getTime(), previousStartAt: previous.getTime() };
}

function AnalyticsContent() {
  const [period, setPeriod] = useState<Period>('month');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const range = useMemo(() => getRange(period), [period]);
  const { userId, fetchTransactionRange } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const rangeState = useLocalTransactionRange<LocalRecord>(
    userId,
    range.previousStartAt,
    range.endAt,
    fetchTransactionRange,
  );
  const analytics = useMemo(() => {
    if (!profileState.data || !categoryState.data || !rangeState.data) return undefined;
    const profile = profileState.data[0];
    if (!profile) return null;
    const currency = typeof profile.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
    const timeZone = typeof profile.timezone === 'string' ? profile.timezone : 'UTC';
    validateAnalyticsRange(period, range.startAt, range.endAt);
    validateAnalyticsRange(period, range.previousStartAt, range.startAt);
    const analyticsTransactions = rangeState.data as AnalyticsTransaction[];
    const categoryNames = categoryState.data
      .filter((category) => typeof category.name === 'string')
      .map((category) => ({
        id: String(category.id ?? category._id),
        name: category.name as string,
      }));
    const current = aggregateAnalytics(
      analyticsTransactions,
      categoryNames,
      currency,
      period,
      range.startAt,
      range.endAt,
      timeZone,
    );
    const previous = aggregateAnalytics(
      analyticsTransactions,
      [],
      currency,
      period,
      range.previousStartAt,
      range.startAt,
      timeZone,
    );
    return { currency, ...current, previousSpentMinor: previous.spentMinor };
  }, [categoryState.data, period, profileState.data, range, rangeState.data]);
  const currency = analytics?.currency;
  const buckets = analytics?.buckets ?? [];
  const categories = analytics?.categoryBreakdown ?? [];
  const minorUnit = currency
    ? 10 **
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits!
    : undefined;
  const maxCategoryMinor = categories.reduce(
    (maximum, category) => (category.amountMinor > maximum ? category.amountMinor : maximum),
    0n,
  );
  const comparison = analytics
    ? analytics.previousSpentMinor === 0n
      ? analytics.spentMinor === 0n
        ? 'No spending in either period'
        : 'No spending in the previous period'
      : `${analytics.spentMinor >= analytics.previousSpentMinor ? 'Up' : 'Down'} ${Math.abs(Number(((analytics.spentMinor - analytics.previousSpentMinor) * 100n) / analytics.previousSpentMinor))}% vs previous period`
    : '';
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 64,
        gap: 36,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Analytics</Typography>
      </View>

      <Tabs
        value={period}
        onChange={(value) => setPeriod(value as Period)}
        tabs={[
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
          { label: 'Year', value: 'year' },
        ]}
      />

      {analytics === undefined ? (
        <View style={{ gap: 12 }} accessibilityLabel="Loading analytics">
          <Typography variant="display">Loading analytics…</Typography>
        </View>
      ) : analytics === null ? (
        <Empty
          title="Analytics unavailable"
          description="Sign in to see your spending and income."
        />
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <Typography variant="display">Your spending,{`\n`}in focus.</Typography>
            <View style={{ gap: 4, marginTop: 8 }}>
              <Typography variant="label">Spent</Typography>
              <Money
                amountMinor={analytics.spentMinor}
                currency={analytics.currency}
                size="display"
              />
              <Typography variant="caption">{comparison}</Typography>
              <Typography variant="caption">Income</Typography>
              <Money
                amountMinor={analytics.incomeMinor}
                currency={analytics.currency}
                size="body"
                type="income"
              />
            </View>
          </View>

          {analytics.spentMinor === 0n && analytics.incomeMinor === 0n ? (
            <Empty
              title="No activity in this period"
              description="Posted expenses and income will appear here."
            />
          ) : (
            <SpendingLineChart
              values={buckets.map((bucket) => Number(bucket.amountMinor) / (minorUnit ?? 1))}
            />
          )}

          <View style={{ gap: 20 }}>
            <SectionHeader title="Where it went" />
            {categories.length > 0 ? (
              <InsightBars
                items={categories.map((category, index) => ({
                  label: category.label,
                  value:
                    maxCategoryMinor > 0n
                      ? Number((category.amountMinor * 100n) / maxCategoryMinor)
                      : 0,
                  amount: formatMinor(category.amountMinor, analytics.currency),
                  color: [tokens.chart.volt, tokens.chart.blue, tokens.chart.violet][index % 3],
                }))}
              />
            ) : (
              <Empty
                title="No expense categories yet"
                description="Categorized posted expenses will be shown here."
              />
            )}
          </View>

          <View style={{ gap: 10 }}>
            <SectionHeader title="Patterns" />
            <Typography variant="heading">
              {analytics.spentMinor > analytics.previousSpentMinor
                ? 'Spending increased'
                : analytics.spentMinor < analytics.previousSpentMinor
                  ? 'Spending decreased'
                  : 'Spending stayed level'}
            </Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>{comparison}.</Text>
          </View>
        </>
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
