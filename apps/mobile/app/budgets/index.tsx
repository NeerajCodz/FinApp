import { View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { BudgetOverviewScreen } from '@finapp/ui/finance';
import { Button, IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

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
  alertThreshold?: number;
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
type Account = LocalRecord;
type Transaction = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  categoryId?: string;
  type?: string;
  status?: string;
  deletedAt?: number;
  currency?: string;
  amountMinor?: bigint | number | string;
  occurredAt?: number;
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

export default function BudgetScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const budgetState = useLocalRecords<Budget>(userId, 'budget');
  const categoryState = useLocalRecords<Category>(userId, 'category');
  const accountState = useLocalRecords<Account>(userId, 'account');
  const active = (budgetState.data ?? []).filter(
    (row) =>
      row.period === 'category' &&
      !!row.categoryId &&
      row.archivedAt === undefined &&
      (row.id ?? row._id ?? row.cloudId) !== undefined,
  );
  const activeStart = active.length
    ? Math.min(...active.map((row) => Number(row.startAt ?? 0)))
    : null;
  const activeEnd = active.length ? Math.max(...active.map((row) => Number(row.endAt ?? 0))) : null;
  const now = new Date();
  const fallbackStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const fallbackEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const startAt = activeStart ?? fallbackStart;
  const endAt = activeEnd ?? fallbackEnd;
  const transactionState = useLocalTransactionRange<Transaction>(
    userId,
    startAt,
    endAt,
    fetchTransactionRange,
  );
  const categoryMap = new Map<string, Category>();
  for (const category of categoryState.data ?? [])
    for (const id of aliases(category)) categoryMap.set(id, category);
  const accountAliases = new Map<string, Set<string>>();
  for (const account of accountState.data ?? []) {
    const accountIds = aliases(account);
    for (const accountId of accountIds) accountAliases.set(accountId, new Set(accountIds));
  }
  const items = active
    .flatMap((budget) => {
      const category = categoryMap.get(budget.categoryId ?? '');
      const categoryIds = new Set(category ? aliases(category) : []);
      const currency = budget.currency ?? 'INR';
      const spent = (transactionState.data ?? [])
        .filter(
          (row) =>
            row.type === 'expense' &&
            row.status === 'posted' &&
            row.deletedAt === undefined &&
            row.currency === currency &&
            Number(row.occurredAt ?? 0) >= Number(budget.startAt ?? 0) &&
            Number(row.occurredAt ?? 0) < Number(budget.endAt ?? 0) &&
            categoryIds.has(String(row.categoryId ?? '')) &&
            (!budget.accountIds?.length ||
              (typeof row.accountId === 'string' &&
                budget.accountIds.some((id) => accountAliases.get(id)?.has(row.accountId!)))),
        )
        .reduce((sum, row) => sum + minor(row.amountMinor), 0n);
      const id = aliases(budget)[0];
      return id
        ? [
            {
              id,
              name: budget.name ?? 'Budget',
              category: category?.name ?? 'Category',
              icon: category?.icon,
              currency,
              spentMinor: spent,
              limitMinor: minor(budget.amountMinor),
              startAt: Number(budget.startAt ?? 0),
              endAt: Number(budget.endAt ?? 0),
              alertThreshold: budget.alertThreshold,
            },
          ]
        : [];
    })
    .sort((a, b) => a.startAt - b.startAt || a.name.localeCompare(b.name));
  const error =
    budgetState.error ?? categoryState.error ?? transactionState.error ?? accountState.error;
  return (
    <>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 18,
          backgroundColor: tokens.background,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconButton label="Back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading">Budgets</Typography>
        </View>
      </View>
      <BudgetOverviewScreen
        items={items}
        loading={
          budgetState.loading ||
          categoryState.loading ||
          transactionState.loading ||
          accountState.loading
        }
        error={error ? String(error) : undefined}
        onCreate={() => router.push('/budgets/new')}
        onOpen={(id) => router.push(`/budget/${encodeURIComponent(id)}`)}
        onAnalytics={() => {
          const first = items[0];
          if (first) router.push(`/budget/${encodeURIComponent(first.id)}/analytics` as never);
        }}
      />
    </>
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
      <Typography variant="heading">Budgets unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
