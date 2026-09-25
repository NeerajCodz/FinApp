import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from '@/lib/icons';
import {
  aggregateAnalytics, getAnalyticsRange, UNCATEGORIZED_ID, UNASSIGNED_ACCOUNT_ID,
  UNSPECIFIED_MERCHANT, validateAnalyticsRange, type AnalyticsPeriod,
} from '@convex/analytics/domain';
import { TransactionRow } from '@/components/finance';
import { Button, Empty, IconButton, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { analyticsEntities, ledgerTransaction, recordId, recordIndex, transactionRow } from '@/lib/ledger';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { formatMinor } from '@/lib/money';

const scalar = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default function AnalyticsBreakdownScreen() {
  const params = useLocalSearchParams<{
    dimension: string | string[]; key: string | string[]; period: string | string[];
    startAt: string | string[]; endAt: string | string[];
  }>();
  const dimension = scalar(params.dimension);
  const key = scalar(params.key);
  const period = scalar(params.period);
  const startRaw = scalar(params.startAt);
  const endRaw = scalar(params.endAt);
  const startAt = startRaw && /^\d+$/.test(startRaw) ? Number(startRaw) : NaN;
  const endAt = endRaw && /^\d+$/.test(endRaw) ? Number(endRaw) : NaN;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const profile = profileState.data?.[0];
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  let valid = !!key && (dimension === 'category' || dimension === 'account' || dimension === 'merchant') &&
    (period === 'week' || period === 'month' || period === 'year') && Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt);
  if (valid) {
    try {
      validateAnalyticsRange(period as AnalyticsPeriod, startAt, endAt);
      const canonical = getAnalyticsRange(period as AnalyticsPeriod, startAt + 1, timeZone);
      valid = canonical.startAt === startAt && canonical.endAt === endAt;
    } catch { valid = false; }
  }
  const rangeState = useLocalTransactionRange<LocalRecord>(
    valid ? userId : null, valid ? startAt : 0, valid ? endAt : 1, fetchTransactionRange,
  );
  const accounts = useMemo(() => recordIndex(accountState.data ?? []), [accountState.data]);
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
  const result = useMemo(() => {
    if (!valid || !rangeState.data || !accountState.data || !categoryState.data) return null;
    const source = rangeState.data.flatMap((record) => {
      const transaction = ledgerTransaction(record);
      return transaction ? [transaction] : [];
    });
    const summary = aggregateAnalytics(source, analyticsEntities(categoryState.data), currency,
      period as AnalyticsPeriod, startAt, endAt, timeZone, analyticsEntities(accountState.data));
    const items = dimension === 'category' ? summary.categoryBreakdown
      : dimension === 'account' ? summary.accountBreakdown : summary.merchantBreakdown;
    const item = items.find((entry) => entry.id === key);
    const rows = rangeState.data.filter((record) => {
      const transaction = ledgerTransaction(record);
      if (!transaction || transaction.type !== 'expense' || transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined || transaction.currency !== currency ||
        transaction.occurredAt < startAt || transaction.occurredAt >= endAt) return false;
      const resolved = dimension === 'category'
        ? (categories.get(transaction.categoryId ?? '') ? recordId(categories.get(transaction.categoryId ?? '')!) : UNCATEGORIZED_ID)
        : dimension === 'account'
          ? (accounts.get(transaction.accountId ?? '') ? recordId(accounts.get(transaction.accountId ?? '')!) : UNASSIGNED_ACCOUNT_ID)
          : transaction.merchant?.trim() || UNSPECIFIED_MERCHANT;
      return resolved === key;
    }).sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt));
    return { item, rows, totalMinor: summary.spentMinor };
  }, [valid, rangeState.data, accountState.data, categoryState.data, currency, period, startAt, endAt, timeZone, dimension, key, accounts, categories]);
  const error = profileState.error || categoryState.error || accountState.error || rangeState.error;
  const recover = <View style={{ gap: 12 }}>
    <Empty title="Breakdown unavailable" description="This selection or date range is no longer available." />
    <Button onPress={() => router.replace('/analytics')}>Back to analytics</Button>
  </View>;
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
    contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48, gap: 24 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}><ArrowLeft size={21} color={tokens.foreground} /></IconButton>
      <Typography variant="title">{dimension === 'category' ? 'Category' : dimension === 'account' ? 'Account' : 'Merchant'}</Typography>
    </View>
    {!valid || (profileState.data && !profile) || (result && !result.item && rangeState.covered) ? recover : <>
      {error && <View style={{ gap: 10 }} accessibilityRole="alert">
        <Typography variant="small">{result?.item ? 'Showing saved data. Refresh failed; share may be incomplete.' : 'Breakdown data is unavailable.'}</Typography>
        <Button onPress={() => { profileState.retry(); categoryState.retry(); accountState.retry(); rangeState.retry(); }}>Retry</Button>
      </View>}
      {rangeState.refreshing && <Typography variant="caption">Refreshing transactions…</Typography>}
      {(!result || (!result.item && !rangeState.covered)) && !error ? <Typography variant="heading">Loading breakdown…</Typography> : result && result.item && <>
        <Typography variant="display">{result.item.label}</Typography>
        <Typography variant="heading">{formatMinor(result.item.amountMinor, currency)}</Typography>
        <Typography variant="caption">
          {result.totalMinor > 0n ? Number((result.item.amountMinor * 1000n) / result.totalMinor) / 10 : 0}% of spending · {period}
        </Typography>
        {result.rows.length === 0 ? <Empty title="No matching transactions" description={rangeState.covered ? 'No posted expenses match this breakdown.' : 'No matching saved rows. Refresh to confirm the full period.'} />
          : result.rows.map((record) => {
            const row = transactionRow(record, accounts, categories, timeZone);
            const id = recordId(record);
            return row && id ? <TransactionRow key={id} {...row}
              onPress={() => router.push({ pathname: '/transaction/[id]', params: { id } })} /> : null;
          })}
      </>}
    </>}
  </ScrollView>;
}
