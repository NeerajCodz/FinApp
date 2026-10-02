import React from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { TransactionsScreen, transactionViews } from '@finapp/ui/finance';
import { Typography } from '@finapp/ui/native';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
export default function TransactionsRoute() {
  const { userId, fetchTransactionRange } = useLocalSync();
  const [query, setQuery] = React.useState(''),
    [typeFilter, setTypeFilter] = React.useState('all'),
    [month, setMonth] = React.useState(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
  const [year, monthNumber] = month.split('-').map(Number),
    startAt = new Date(year!, monthNumber! - 1, 1).getTime(),
    endAt = new Date(year!, monthNumber!, 1).getTime(),
    previousStartAt = new Date(year!, monthNumber! - 2, 1).getTime();
  const transactions = useLocalTransactionRange<LocalRecord>(
      userId,
      startAt,
      endAt,
      fetchTransactionRange,
    ),
    previousRange = useLocalTransactionRange<LocalRecord>(
      userId,
      previousStartAt,
      startAt,
      fetchTransactionRange,
    ),
    accounts = useLocalRecords<LocalRecord>(userId, 'account'),
    categories = useLocalRecords<LocalRecord>(userId, 'category'),
    profiles = useLocalRecords<LocalRecord>(userId, 'profile');
  const records = (transactions.data ?? []).filter(
    (record) => record.deletedAt === undefined && record.status !== 'voided',
  );
  const currency = String(profiles.data?.[0]?.defaultCurrency ?? records[0]?.currency ?? 'INR');
  const expenses = records.filter(
      (r) => r.type === 'expense' && r.status === 'posted' && r.currency === currency,
    ),
    income = records.filter(
      (r) => r.type === 'income' && r.status === 'posted' && r.currency === currency,
    );
  const previousRecords = previousRange.covered
    ? (previousRange.data ?? []).filter(
        (record) => record.deletedAt === undefined && record.status !== 'voided',
      )
    : undefined;
  const previousExpenses = previousRecords?.filter(
    (record) =>
      record.type === 'expense' &&
      record.status === 'posted' &&
      String(record.currency ?? profiles.data?.[0]?.defaultCurrency ?? 'INR') === currency,
  );
  const previousTotalExpense = previousExpenses?.reduce(
    (sum, record) => sum + BigInt(String(record.amountMinor ?? 0)),
    0n,
  );
  const previousTotalIncome = previousRecords
    ?.filter(
      (record) =>
        record.type === 'income' &&
        record.status === 'posted' &&
        String(record.currency ?? profiles.data?.[0]?.defaultCurrency ?? 'INR') === currency,
    )
    .reduce((sum, record) => sum + BigInt(String(record.amountMinor ?? 0)), 0n);
  const items = transactionViews(
    records.slice().sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt)),
    accounts.data ?? [],
    categories.data ?? [],
    typeof profiles.data?.[0]?.timezone === 'string' ? profiles.data[0].timezone : undefined,
  ).filter(
    (item) =>
      (typeFilter === 'all' || item.type === typeFilter) &&
      `${item.title} ${item.note ?? ''} ${item.merchant ?? ''} ${item.category} ${item.account ?? ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  if (!userId)
    return (
      <View style={{ padding: 24 }}>
        <Typography variant="heading">Sign in to view your transactions</Typography>
      </View>
    );
  return (
    <TransactionsScreen
      items={items}
      query={query}
      month={month}
      typeFilter={typeFilter}
      currency={currency}
      totalExpense={expenses.reduce((sum, r) => sum + BigInt(String(r.amountMinor ?? 0)), 0n)}
      totalIncome={income.reduce((sum, r) => sum + BigInt(String(r.amountMinor ?? 0)), 0n)}
      previousTotalExpense={previousTotalExpense}
      previousTotalIncome={previousTotalIncome}
      previousExpenseCount={previousExpenses?.length}
      transactionCount={records.length}
      expenseCount={expenses.length}
      incomeCount={records.filter((r) => r.type === 'income').length}
      loading={transactions.loading || accounts.loading || categories.loading || profiles.loading}
      error={accounts.error?.message ?? categories.error?.message ?? profiles.error?.message}
      rangeError={transactions.error?.message}
      onQueryChange={setQuery}
      onMonthChange={setMonth}
      onTypeFilterChange={setTypeFilter}
      onSelect={(id) => router.push(`/transaction/${encodeURIComponent(id)}` as never)}
      onCreate={() => router.push('/transaction/new')}
    />
  );
}
