import React from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { TransactionsScreen, transactionViews } from '@finapp/ui/finance';
import { Typography } from '@finapp/ui/native';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
export default function TransactionsRoute() {
  const { userId, fetchTransactionRange } = useLocalSync();
  const [query, setQuery] = React.useState(''),
    [typeFilter, setTypeFilter] = React.useState('all'),
    [month, setMonth] = React.useState(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deletePending, setDeletePending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
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
  const selectableIds = new Set(
    items.flatMap((item) => {
      const record = records.find(
        (candidate) => String(candidate.id ?? candidate._id ?? candidate.cloudId ?? '') === item.id,
      );
      return record?.ownerId === userId && record.groupId === undefined ? [item.id] : [];
    }),
  );
  React.useEffect(() => {
    setSelectedIds((current) => {
      const visible = current.filter((id) => selectableIds.has(id));
      return visible.length === current.length ? current : visible;
    });
  }, [selectableIds]);
  const deleteSelected = () => {
    if (!userId || deletePending || selectedIds.length === 0) return;
    Alert.alert('Delete transactions?', `Delete ${selectedIds.length} selected transaction(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeletePending(true);
          setActionError(null);
          void Promise.all(
            selectedIds.map(async (id) => {
              if (!selectableIds.has(id)) throw new Error('Transaction is not deletable.');
              const record = records.find(
                (candidate) =>
                  String(candidate.id ?? candidate._id ?? candidate.cloudId ?? '') === id,
              );
              if (!record) throw new Error('Transaction is unavailable.');
              await commitLocalWrite(
                userId,
                'transaction',
                'transaction.delete',
                { ...record, deletedAt: Date.now() },
                { transactionId: id },
                { recordId: id },
              );
            }),
          )
            .then(() => setSelectedIds((current) => current.filter((id) => !selectableIds.has(id))))
            .catch((cause: unknown) =>
              setActionError(
                cause instanceof Error ? cause.message : 'Could not delete transactions.',
              ),
            )
            .finally(() => setDeletePending(false));
        },
      },
    ]);
  };
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
      selectableIds={selectableIds}
      selectedIds={selectedIds}
      selectedCount={selectedIds.length}
      deletePending={deletePending}
      actionError={actionError}
      onToggleSelect={(id) =>
        setSelectedIds((current) =>
          current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
        )
      }
      onClearSelection={() => setSelectedIds([])}
      onDeleteSelected={deleteSelected}
      onCreate={() => router.push('/transaction/new')}
    />
  );
}
