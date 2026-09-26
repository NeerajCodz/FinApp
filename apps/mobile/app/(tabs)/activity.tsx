import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { MagnifyingGlass, X } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateSection, MetricPair, TransactionRow } from '@/components/finance';
import { Button, Empty, IconButton, Input, Tabs, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { layoutTokens } from '@finapp/ui/tokens';
import {
  aggregateAnalytics,
  getAnalyticsRange,
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

export default function ActivityScreen() {
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const profile = profileState.data?.[0];
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  const range = useMemo(() => getAnalyticsRange(period, Date.now(), timeZone), [period, timeZone]);
  const rangeState = useLocalTransactionRange<LocalRecord>(
    userId,
    range.startAt,
    range.endAt,
    fetchTransactionRange,
  );
  const accounts = useMemo(() => recordIndex(accountState.data ?? []), [accountState.data]);
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
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
        if (!needle) return true;
        const record = records.get(row.id)!;
        const transaction = ledgerTransaction(record)!;
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
  }, [rangeState.data, range.startAt, range.endAt, userId, query, filter, accounts, categories]);
  const totals = useMemo(
    () =>
      aggregateAnalytics(
        visible.flatMap((record) => {
          const transaction = ledgerTransaction(record);
          return transaction ? [transaction] : [];
        }),
        analyticsEntities(categoryState.data ?? []),
        currency,
        period,
        range.startAt,
        range.endAt,
        timeZone,
        analyticsEntities(accountState.data ?? []),
      ),
    [visible, categoryState.data, accountState.data, currency, period, range, timeZone],
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
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 16,
        paddingBottom: layoutTokens.sectionGap,
        gap: 24,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {searching ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Input
            accessibilityLabel="Search transactions"
            autoFocus
            placeholder="Title, merchant, category, amount…"
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1 }}
          />
          <IconButton
            label="Close search"
            variant="ghost"
            onPress={() => {
              setQuery('');
              setSearching(false);
            }}
          >
            <X size={20} color={tokens.foreground} />
          </IconButton>
        </View>
      ) : (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography variant="title">Activity</Typography>
          <IconButton label="Search activity" variant="ghost" onPress={() => setSearching(true)}>
            <MagnifyingGlass size={21} color={tokens.foreground} />
          </IconButton>
        </View>
      )}
      <Tabs
        value={period}
        onChange={(value) => setPeriod(value as AnalyticsPeriod)}
        tabs={[
          { label: 'Week', value: 'week' },
          { label: 'Month', value: 'month' },
          { label: 'Year', value: 'year' },
        ]}
      />
      {ready && (
        <View style={{ gap: 12 }}>
          <Typography variant="label">
            {period} · {currency}
          </Typography>
          <MetricPair
            left={{ label: 'Spent', value: formatMinor(totals.spentMinor, currency) }}
            right={{ label: 'Income', value: formatMinor(totals.incomeMinor, currency) }}
          />
          <Typography variant="caption">
            Totals include posted transactions in {currency} only.
          </Typography>
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <Tabs
          value={filter}
          onChange={(value) => setFilter(value as ActivityFilter)}
          tabs={filters.map((value) => ({ label: value, value }))}
        />
      </ScrollView>
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
              ? 'Try a merchant, title, category, account, or amount.'
              : 'No transactions match this period and filter.'
          }
        />
      ) : ready && sections.length === 0 ? (
        <Typography variant="small">
          No matching saved rows. Refresh to confirm the full period.
        </Typography>
      ) : (
        ready &&
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
      )}
    </ScrollView>
  );
}
