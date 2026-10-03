'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TransactionsScreen } from '@finapp/ui/finance';
import { formatTransactionDate, type TransactionType } from '@finapp/ui/finance';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, readLocal, type LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, SignInGate } from '../_personal';

type Transaction = LocalRecord & {
  title?: string;
  merchant?: string;
  note?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
  groupId?: string;
};
type Entity = LocalRecord & { name?: string; icon?: string; currency?: string };
type Profile = LocalRecord & { timezone?: string; defaultCurrency?: string };
const validTypes: Record<TransactionType, true> = {
  expense: true,
  income: true,
  transfer: true,
  refund: true,
  adjustment: true,
};

export default function TransactionsPage() {
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<Entity>('account');
  const categoryState = useLocalRecords<Entity>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [rangeError, setRangeError] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deletePending, setDeletePending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, monthNumber] = month.split('-').map(Number);
  const startAt = new Date(year!, monthNumber! - 1, 1).getTime();
  const endAt = new Date(year!, monthNumber!, 1).getTime();
  const previousStartAt = new Date(year!, monthNumber! - 2, 1).getTime();

  const [previousRecords, setPreviousRecords] = React.useState<Transaction[]>();
  React.useEffect(() => {
    if (!userId || !isConnected) {
      setPreviousRecords(undefined);
      return;
    }
    let active = true;
    setPreviousRecords(undefined);
    void fetchTransactionRange(previousStartAt, startAt)
      .then(() => readLocal<Transaction>(userId, 'transaction'))
      .then((records) => {
        if (active) setPreviousRecords(records);
      })
      .catch(() => {
        if (active) setPreviousRecords(undefined);
      });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, previousStartAt, startAt, userId]);
  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(startAt, endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          !isConnected
            ? 'Offline: showing transactions already saved in this browser.'
            : cause instanceof Error
              ? cause.message
              : 'Could not refresh this date range.',
        );
    });
    return () => {
      active = false;
    };
  }, [endAt, fetchTransactionRange, isConnected, startAt, userId]);

  const accounts = accountState.records.filter((record) => userId && belongsToUser(record, userId));
  const categories = categoryState.records.filter(
    (record) => userId && belongsToUser(record, userId),
  );
  const transactions = transactionState.records
    .filter(
      (record) =>
        userId &&
        belongsToUser(record, userId) &&
        record.deletedAt === undefined &&
        record.status !== 'voided' &&
        Number.isFinite(Number(record.occurredAt)) &&
        Number(record.occurredAt) >= startAt &&
        Number(record.occurredAt) < endAt,
    )
    .sort((left, right) => Number(right.occurredAt) - Number(left.occurredAt));
  const profile = profileState.records[0];
  const items = transactions.flatMap((record) => {
    const id = idOf(record);
    const type = validTypes[record.type as TransactionType]
      ? (record.type as TransactionType)
      : null;
    if (!id || !type) return [];
    const account = accounts.find(
      (candidate) =>
        typeof record.accountId === 'string' && aliasesOf(candidate).includes(record.accountId),
    );
    const category = categories.find(
      (candidate) =>
        typeof record.categoryId === 'string' && aliasesOf(candidate).includes(record.categoryId),
    );
    const currency = String(
      record.currency ?? account?.currency ?? profile?.defaultCurrency ?? 'INR',
    );
    const searchText = [
      record.title,
      record.merchant,
      record.note,
      account?.name,
      category?.name,
      formatMinor(asMinor(record.amountMinor), currency),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    if (query.trim() && !searchText.includes(query.trim().toLocaleLowerCase())) return [];
    if (typeFilter !== 'all' && type !== typeFilter) return [];
    return [
      {
        id,
        title: String(record.title ?? record.merchant ?? 'Transaction'),
        category: String(
          category?.name ??
            (record.groupId ? 'Split expense' : type === 'transfer' ? 'Transfer' : 'Uncategorized'),
        ),
        categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined,
        account: account?.name,
        merchant: typeof record.merchant === 'string' ? record.merchant : undefined,
        note: typeof record.note === 'string' ? record.note : undefined,
        date: formatTransactionDate(Number(record.occurredAt), record.hasTime, profile?.timezone),
        amountMinor: asMinor(record.amountMinor),
        currency,
        type,
      },
    ];
  });
  const selectableIds = new Set(
    items.flatMap((item) => {
      const record = transactions.find((candidate) => idOf(candidate) === item.id);
      return record?.ownerId === userId && record.groupId === undefined ? [item.id] : [];
    }),
  );
  React.useEffect(() => {
    setSelectedIds((current) => {
      const visible = current.filter((id) => selectableIds.has(id));
      return visible.length === current.length ? current : visible;
    });
  }, [selectableIds]);
  async function deleteSelected() {
    if (!userId || deletePending || selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected transaction(s)?`)) return;
    setDeletePending(true);
    setActionError(null);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          if (!selectableIds.has(id)) throw new Error('Transaction is not deletable.');
          const record = transactions.find((candidate) => idOf(candidate) === id);
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
      );
      setSelectedIds([]);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not delete transactions.');
    } finally {
      setDeletePending(false);
    }
  }
  const currency = String(profile?.defaultCurrency ?? transactions[0]?.currency ?? 'INR');
  const previousTransactions = previousRecords?.filter(
    (record) =>
      userId &&
      belongsToUser(record, userId) &&
      record.deletedAt === undefined &&
      record.status !== 'voided' &&
      Number.isFinite(Number(record.occurredAt)) &&
      Number(record.occurredAt) >= previousStartAt &&
      Number(record.occurredAt) < startAt,
  );
  const previousExpenses = previousTransactions?.filter(
    (record) =>
      record.type === 'expense' &&
      record.status === 'posted' &&
      String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
  );
  const previousTotalExpense = previousExpenses?.reduce(
    (sum, record) => sum + asMinor(record.amountMinor),
    0n,
  );
  const previousTotalIncome = previousTransactions
    ?.filter(
      (record) =>
        record.type === 'income' &&
        record.status === 'posted' &&
        String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
    )
    .reduce((sum, record) => sum + asMinor(record.amountMinor), 0n);
  const totalExpense = transactions.reduce(
    (sum, record) =>
      record.type === 'expense' &&
      record.status === 'posted' &&
      String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency
        ? sum + asMinor(record.amountMinor)
        : sum,
    0n,
  );
  const totalIncome = transactions.reduce(
    (sum, record) =>
      record.type === 'income' &&
      record.status === 'posted' &&
      String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency
        ? sum + asMinor(record.amountMinor)
        : sum,
    0n,
  );
  const loading =
    transactionState.loading ||
    accountState.loading ||
    categoryState.loading ||
    profileState.loading;
  const error =
    transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  if (!userId)
    return (
      <SignInGate eyebrow="TRANSACTIONS" title="Your ledger stays private.">
        Sign in to view personal transactions saved in your finance data.
      </SignInGate>
    );

  return (
    <TransactionsScreen
      items={items}
      query={query}
      month={month}
      typeFilter={typeFilter}
      currency={currency}
      totalExpense={totalExpense}
      totalIncome={totalIncome}
      previousTotalExpense={previousTotalExpense}
      previousTotalIncome={previousTotalIncome}
      previousExpenseCount={previousExpenses?.length}
      transactionCount={transactions.length}
      expenseCount={
        transactions.filter(
          (record) =>
            record.type === 'expense' &&
            record.status === 'posted' &&
            String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency,
        ).length
      }
      incomeCount={transactions.filter((record) => record.type === 'income').length}
      loading={loading}
      error={error}
      rangeError={rangeError}
      onQueryChange={setQuery}
      onMonthChange={setMonth}
      onTypeFilterChange={setTypeFilter}
      onSelect={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
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
      onDeleteSelected={() => void deleteSelected()}
      onCreate={() => router.push('/transaction/new')}
    />
  );
}
