import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ChartLineUp } from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, IconButton, Typography, useTheme } from '@finapp/ui/native';
import { FinanceEmptyState } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { formatMinor } from '@/lib/money';
import { recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';

type Category = LocalRecord & { name?: string };
type Expense = LocalRecord & {
  amountMinor?: bigint;
  categoryId?: string;
  occurredAt?: number;
};

export default function GroupAnalyticsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const { group, ledger, loading, refreshing, error, retry } = useGroupLedger(id);
  const { data: categories } = useLocalRecords<Category>(userId, 'category');
  const expenses = (ledger?.expenses ?? []) as Expense[];
  const currency = String(group?.currency ?? ledger?.currency ?? 'INR');
  const names: Record<string, string> = {};
  for (const category of categories ?? []) {
    for (const categoryId of recordIds(category)) names[categoryId] = category.name ?? 'Other';
  }
  const total = expenses.reduce(
    (sum, expense) => sum + (typeof expense.amountMinor === 'bigint' ? expense.amountMinor : 0n),
    0n,
  );
  const average = expenses.length ? total / BigInt(expenses.length) : 0n;
  const categoryTotals: Record<string, bigint> = {};
  for (const expense of expenses) {
    const categoryId = typeof expense.categoryId === 'string' ? expense.categoryId : '';
    categoryTotals[categoryId] =
      (categoryTotals[categoryId] ?? 0n) +
      (typeof expense.amountMinor === 'bigint' ? expense.amountMinor : 0n);
  }
  const categoriesBySpend = Object.entries(categoryTotals)
    .map(([categoryId, value]) => ({
      label: categoryId ? (names[categoryId] ?? 'Other') : 'Uncategorized',
      value,
    }))
    .sort((left, right) => (left.value > right.value ? -1 : left.value < right.value ? 1 : 0))
    .slice(0, 5);
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - 5);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setMonth(start.getMonth() + index);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date),
      value: 0n,
    };
  });
  const monthBuckets: Record<string, (typeof monthly)[number]> = {};
  for (const bucket of monthly) monthBuckets[bucket.key] = bucket;
  for (const expense of expenses) {
    const date = new Date(Number(expense.occurredAt ?? 0));
    const bucket = monthBuckets[`${date.getFullYear()}-${date.getMonth()}`];
    if (bucket) bucket.value += typeof expense.amountMinor === 'bigint' ? expense.amountMinor : 0n;
  }
  const largestMonth =
    monthly.reduce((largest, item) => (item.value > largest ? item.value : largest), 0n) || 1n;
  const largestCategory =
    categoriesBySpend.reduce(
      (largest, item) => (item.value > largest ? item.value : largest),
      0n,
    ) || 1n;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 24,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Back to group" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Typography variant="label">SHARED LEDGER</Typography>
          <Typography variant="title">{String(group?.name ?? 'Group')} analytics</Typography>
        </View>
      </View>
      {group && !isConnected && !error ? (
        <Typography variant="small" accessibilityRole="alert">
          Offline · showing saved group history
        </Typography>
      ) : null}
      {!id ? (
        <Empty title="Missing group ID" description="Open analytics from a group." />
      ) : !group && loading ? (
        <Typography variant="heading">Loading group analytics…</Typography>
      ) : !group ? (
        <Empty title="Group unavailable" description="This group is not saved on this device." />
      ) : error ? (
        <View style={{ gap: 12 }} accessibilityRole="alert">
          <Empty
            title="Analytics unavailable"
            description={`The complete group ledger could not be loaded. ${error.message}`}
          />
          <Button onPress={retry}>Retry</Button>
        </View>
      ) : loading || !ledger ? (
        <View style={{ gap: 12 }} accessibilityRole="progressbar">
          <Typography variant="heading">Loading group history…</Typography>
          <Typography variant="small">
            Preparing complete ledger analytics{refreshing ? ' · syncing' : ''}
          </Typography>
        </View>
      ) : expenses.length === 0 ? (
        <FinanceEmptyState
          kind="analytics"
          title="No group spending yet."
          description="Posted expenses will appear here once the group ledger has activity."
        />
      ) : (
        <>
          <View accessibilityLabel="Group spending summary" style={{ gap: 10 }}>
            {[
              ['Total spending', formatMinor(total, currency)],
              ['Posted expenses', String(expenses.length)],
              ['Average expense', formatMinor(average, currency)],
            ].map(([label, value]) => (
              <View
                key={label}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: tokens.border,
                  gap: 4,
                }}
              >
                <Typography variant="small">{label}</Typography>
                <Typography variant="heading">{value}</Typography>
              </View>
            ))}
          </View>
          <View
            accessibilityLabel={`Monthly spending: ${monthly.map((item) => `${item.label} ${formatMinor(item.value, currency)}`).join(', ')}`}
            style={{ gap: 14 }}
          >
            <View>
              <Typography variant="heading">Monthly spending</Typography>
              <Typography variant="small">Last six calendar months · {currency}</Typography>
            </View>
            <View style={{ height: 178, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              {monthly.map((item) => (
                <View
                  key={item.key}
                  style={{
                    flex: 1,
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 7,
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      minHeight: 3,
                      height: `${Math.max(2, Number((item.value * 100n) / largestMonth))}%`,
                      backgroundColor: tokens.primary,
                      borderRadius: 3,
                    }}
                  />
                  <Typography variant="small">{item.label}</Typography>
                </View>
              ))}
            </View>
          </View>
          <View style={{ gap: 14 }}>
            <Typography variant="heading">Spending by category</Typography>
            {categoriesBySpend.length ? (
              categoriesBySpend.map((item) => (
                <View key={item.label} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <Typography variant="bodyLarge">{item.label}</Typography>
                    <Typography variant="label">{formatMinor(item.value, currency)}</Typography>
                  </View>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel={`${item.label} share`}
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: Number((item.value * 100n) / largestCategory),
                    }}
                    style={{
                      height: 8,
                      backgroundColor: tokens.border,
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.max(2, Number((item.value * 100n) / largestCategory))}%`,
                        height: '100%',
                        backgroundColor: tokens.primary,
                      }}
                    />
                  </View>
                </View>
              ))
            ) : (
              <FinanceEmptyState
                kind="analytics"
                title="No category breakdown available."
                description="Category details will appear when posted expenses include categories."
                compact
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
