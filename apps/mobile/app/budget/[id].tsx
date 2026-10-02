import { useState } from 'react';
import { View } from 'react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetDetailScreen } from '@finapp/ui/finance';
import { Button, IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
type Budget = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
  updatedAt?: number;
  icon?: string;
  alertThreshold?: number;
  notes?: string;
  includeInAnalytics?: boolean;
  accountIds?: string[];
};
type Category = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  icon?: string;
  archivedAt?: number;
};
type Account = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name?: string;
  currency?: string;
  archivedAt?: number;
};
type Transaction = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  categoryId?: string;
  occurredAt?: number;
  amountMinor?: bigint | number | string;
  currency?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
  title?: string;
  merchant?: string;
  accountId?: string;
};
function aliases(row: LocalRecord) {
  return [row.id, row._id, row.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}
function minor(value: unknown) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
}
export default function BudgetDetailScreenRoute() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const budgetState = useLocalRecords<Budget>(userId, 'budget');
  const budget = budgetState.data?.find(
    (row) =>
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined &&
      (row.id === routeId || row._id === routeId || row.cloudId === routeId),
  );
  const startAt = Number(budget?.startAt ?? 0);
  const endAt = Number(budget?.endAt ?? 1);
  const categoryState = useLocalRecords<Category>(userId, 'category');
  const accountState = useLocalRecords<Account>(userId, 'account');
  const transactionState = useLocalTransactionRange<Transaction>(
    userId,
    startAt,
    endAt,
    fetchTransactionRange,
  );
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  if (budgetState.error) throw budgetState.error;
  if (categoryState.error) throw categoryState.error;
  if (accountState.error) throw accountState.error;
  if (transactionState.error) throw transactionState.error;
  const category = categoryState.data?.find(
    (row) => budget && aliases(row).includes(budget.categoryId ?? ''),
  );
  const categoryIds = category ? aliases(category) : budget?.categoryId ? [budget.categoryId] : [];
  const accountAliases = new Map<string, Account>();
  for (const account of accountState.data ?? [])
    for (const alias of aliases(account)) accountAliases.set(alias, account);
  const currency = budget?.currency ?? 'INR';
  const matching = (transactionState.data ?? [])
    .filter(
      (row) =>
        row.type === 'expense' &&
        row.status === 'posted' &&
        row.deletedAt === undefined &&
        row.currency === currency &&
        Number(row.occurredAt ?? 0) >= startAt &&
        Number(row.occurredAt ?? 0) < endAt &&
        categoryIds.includes(String(row.categoryId ?? '')) &&
        (!budget?.accountIds?.length ||
          (typeof row.accountId === 'string' &&
            budget.accountIds.some(
              (id) =>
                accountAliases.has(id) &&
                aliases(accountAliases.get(id)!).includes(row.accountId!),
            ))),
    )
    .sort((a, b) => Number(b.occurredAt ?? 0) - Number(a.occurredAt ?? 0));
  const spent = matching.reduce((sum, row) => sum + minor(row.amountMinor), 0n);
  async function archive() {
    if (!userId || !budget || pending) return;
    const budgetId = String(budget._id ?? budget.cloudId ?? budget.id ?? '');
    if (!budgetId) {
      setActionError('This budget has no saved identifier.');
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      await commitLocalWrite(
        userId,
        'budget',
        'budget.archive',
        { ...budget, archivedAt: Date.now() },
        { budgetId },
        {
          recordId: String(budget.id ?? budget._id ?? budget.cloudId ?? ''),
          dependencies: budget.cloudId || budget._id ? [] : [`budget:${budgetId}`],
          baseUpdatedAt: typeof budget.updatedAt === 'number' ? budget.updatedAt : undefined,
        },
      );
      router.replace('/budgets' as never);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not archive this budget.');
    } finally {
      setPending(false);
    }
  }
  if (!userId)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          padding: 24,
          paddingTop: insets.top + 20,
        }}
      >
        <Text>Sign in to view this category budget.</Text>
      </View>
    );
  if (
    budgetState.loading ||
    categoryState.data === undefined ||
    accountState.data === undefined
  )
    return (
      <View style={{ flex: 1, backgroundColor: tokens.background, padding: 24 }}>
        <Text>Opening budget…</Text>
      </View>
    );
  if (!budget)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          padding: 24,
          paddingTop: insets.top + 20,
          gap: 12,
        }}
      >
        <Typography variant="title">Budget unavailable</Typography>
        <Text>Only active category budgets are available here.</Text>
        <Button onPress={() => router.replace('/budgets' as never)}>Back to budgets</Button>
      </View>
    );
  const rows = matching.slice(0, 10).flatMap((row) => {
    const id = aliases(row)[0];
    return id
      ? [
          {
            id,
            title: row.title ?? row.merchant ?? 'Expense',
            date: Number(row.occurredAt ?? 0)
              ? new Intl.DateTimeFormat(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(Number(row.occurredAt))
              : 'Date unavailable',
            amountMinor: minor(row.amountMinor),
            currency: row.currency ?? currency,
            accountId: row.accountId,
            accountName: row.accountId ? accountAliases.get(row.accountId)?.name : undefined,
          },
        ]
      : [];
  });
  return (
    <BudgetDetailScreen
      name={budget.name ?? 'Budget'}
      category={category?.name ?? 'Category'}
      icon={category?.icon}
      currency={currency}
      limit={minor(budget.amountMinor)}
      spent={spent}
      transactions={rows}
      allTransactions={matching.flatMap((row) => {
        const id = aliases(row)[0];
        return id
          ? [{
              id,
              amountMinor: minor(row.amountMinor),
              currency: row.currency ?? currency,
              occurredAt: Number(row.occurredAt ?? 0),
              title: row.title ?? row.merchant ?? 'Expense',
              merchant: row.merchant,
              accountId: row.accountId,
              accountName: row.accountId ? accountAliases.get(row.accountId)?.name : undefined,
              categoryName: category?.name,
            }]
          : [];
      })}
      startAt={startAt}
      endAt={endAt}
      settings={{
        alertThreshold: budget.alertThreshold,
        notes: budget.notes,
        includeInAnalytics: budget.includeInAnalytics,
        accountIds: budget.accountIds,
      }}
      accounts={(accountState.data ?? []).flatMap((account) =>
        aliases(account).map((id) => ({ id, name: account.name ?? 'Account' })),
      )}
      loading={transactionState.loading}
      error={transactionState.error ? String(transactionState.error) : undefined}
      actionError={actionError}
      pending={pending}
      onEdit={() => router.push(`/budget/${encodeURIComponent(routeId)}/edit` as never)}
      onAnalytics={() => router.push(`/budget/${encodeURIComponent(routeId)}/analytics` as never)}
      onArchive={() => void archive()}
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}` as never)}
      onAddExpense={() => {
        const categoryId = String(category?._id ?? category?.id ?? budget.categoryId ?? '');
        const accountId = budget.accountIds?.length === 1 ? budget.accountIds[0] : undefined;
        const query = new URLSearchParams({ categoryId });
        if (accountId) query.set('accountId', accountId);
        router.push(`/transaction/new?${query.toString()}` as never);
      }}
    />
  );
}
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        padding: 20,
        paddingTop: insets.top + 12,
        gap: 18,
      }}
    >
      <IconButton
        label="Go back"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => router.back()}
      >
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="heading">Budget unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
