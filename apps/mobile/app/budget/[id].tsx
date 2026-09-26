import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ChartLineUp } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon, Money, TransactionRow } from '@/components/finance';
import { Button, Card, IconButton, Progress, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { displayAccountName, recordId, recordIndex, transactionRow } from '@/lib/ledger';

type BudgetRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name: string;
  amountMinor: bigint;
  currency: string;
  period: 'monthly' | 'category' | 'account' | 'custom';
  categoryId?: string;
  accountId?: string;
  startAt: number;
  endAt: number;
  archivedAt?: number;
};
type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  name: string;
  icon?: string;
  archivedAt?: number;
};
type AccountRecord = LocalRecord & {
  id?: string;
  _id?: string;
  name: string;
  archivedAt?: number;
};
type TransactionRecord = LocalRecord & {
  categoryId?: string;
  accountId: string;
  occurredAt: number;
  amountMinor: bigint;
  currency: string;
  type: string;
  status: string;
  deletedAt?: number;
};

export default function BudgetDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { userId, fetchTransactionRange } = useLocalSync();
  const budgetState = useLocalRecords<BudgetRecord>(userId, 'budget');
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const selectedBudget = budgetState.data?.find(
    (item) =>
      item.archivedAt === undefined && (item.id === id || item._id === id || item.cloudId === id),
  );
  const transactionState = useLocalTransactionRange<TransactionRecord>(
    userId,
    selectedBudget?.startAt ?? 0,
    selectedBudget?.endAt ?? 0,
    fetchTransactionRange,
  );

  if (budgetState.error) throw budgetState.error;
  if (categoryState.error) throw categoryState.error;
  if (accountState.error) throw accountState.error;
  if (transactionState.error) throw transactionState.error;
  const categoryIdByAlias = new Map<string, string>();
  for (const category of categoryState.data ?? []) {
    const canonicalId = category.id ?? category._id;
    if (!canonicalId) continue;
    if (category.id) categoryIdByAlias.set(category.id, canonicalId);
    if (category._id) categoryIdByAlias.set(category._id, canonicalId);
  }
  const accountIdByAlias = new Map<string, string>();
  for (const account of accountState.data ?? []) {
    const canonicalId = account.id ?? account._id;
    if (!canonicalId) continue;
    if (account.id) accountIdByAlias.set(account.id, canonicalId);
    if (account._id) accountIdByAlias.set(account._id, canonicalId);
  }

  const budgetLocalId = selectedBudget?.id ?? selectedBudget?._id ?? selectedBudget?.cloudId;
  const budgetPayloadId = selectedBudget?._id ?? selectedBudget?.cloudId ?? selectedBudget?.id;
  const matchingExpenses =
    selectedBudget && transactionState.data
      ? transactionState.data.filter(
          (transaction) =>
            transaction.type === 'expense' &&
            transaction.status === 'posted' &&
            transaction.deletedAt === undefined &&
            transaction.currency === selectedBudget.currency &&
            transaction.occurredAt >= selectedBudget.startAt &&
            transaction.occurredAt < selectedBudget.endAt &&
            (selectedBudget.categoryId === undefined ||
              (categoryIdByAlias.get(transaction.categoryId ?? '') ?? transaction.categoryId) ===
                (categoryIdByAlias.get(selectedBudget.categoryId) ?? selectedBudget.categoryId)) &&
            (selectedBudget.accountId === undefined ||
              (accountIdByAlias.get(transaction.accountId) ?? transaction.accountId) ===
                (accountIdByAlias.get(selectedBudget.accountId) ?? selectedBudget.accountId)),
        )
      : [];
  const spentMinor = matchingExpenses.reduce(
    (total, transaction) => total + transaction.amountMinor,
    0n,
  );
  const categoryIdsReady =
    selectedBudget?.categoryId === undefined || categoryState.data !== undefined;
  const accountIdsReady =
    selectedBudget?.accountId === undefined || accountState.data !== undefined;
  const budget =
    selectedBudget && transactionState.data && categoryIdsReady && accountIdsReady
      ? {
          ...selectedBudget,
          spentMinor,
          remainingMinor: selectedBudget.amountMinor - spentMinor,
        }
      : budgetState.data === undefined || selectedBudget !== undefined
        ? undefined
        : null;
  const selectedCategory = budget?.categoryId
    ? categoryState.data?.find(
        (item) =>
          item.archivedAt === undefined &&
          (item.id === budget.categoryId || item._id === budget.categoryId),
      )
    : undefined;
  const rawAccountName = budget?.accountId
    ? accountState.data?.find(
        (item) =>
          item.archivedAt === undefined &&
          (item.id === budget.accountId || item._id === budget.accountId),
      )?.name
    : undefined;
  const accountName =
    typeof rawAccountName === 'string' ? displayAccountName(rawAccountName) : undefined;
  const accountIndex = recordIndex(accountState.data ?? []);
  const categoryIndex = recordIndex(categoryState.data ?? []);
  const recentExpenses = [...matchingExpenses]
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 5)
    .flatMap((record) => {
      const row = transactionRow(
        record,
        accountIndex,
        categoryIndex,
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      );
      const transactionId = recordId(record);
      return row && transactionId ? [{ ...row, id: transactionId }] : [];
    });

  async function archiveBudget() {
    if (!userId || !selectedBudget || !budgetLocalId || !budgetPayloadId || pending) return;
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'budget',
        'budget.archive',
        { ...selectedBudget, archivedAt: Date.now() },
        { budgetId: budgetPayloadId },
        {
          recordId: budgetLocalId,
          dependencies: budgetPayloadId.startsWith('local-') ? [`budget:${budgetPayloadId}`] : [],
        },
      );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive budget.');
    } finally {
      setPending(false);
    }
  }

  if (budget === undefined)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          padding: 20,
          paddingTop: insets.top + 12,
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
        <Text style={{ color: tokens.foregroundMuted }}>Loading budget…</Text>
      </View>
    );
  if (budget === null)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: tokens.background,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <IconButton
          label="Back to budgets"
          variant="ghost"
          style={{ alignSelf: 'flex-start' }}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/budget' as never))}
        >
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Card variant="subtle" style={{ gap: 14, padding: 22 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                backgroundColor: tokens.surfaceRaised,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChartLineUp size={22} color={tokens.primary} />
            </View>
            <Typography variant="heading">This budget isn’t available</Typography>
            <Text style={{ color: tokens.foregroundMuted }}>
              It may have been archived or removed. Your other budgets are still available.
            </Text>
            <Button variant="outline" onPress={() => router.replace('/budget' as never)}>
              View budgets
            </Button>
            <Button variant="ghost" onPress={() => router.push('/budget/new' as never)}>
              Create a budget
            </Button>
          </Card>
        </View>
      </View>
    );

  const percent = Math.max(
    0,
    Math.min(100, Number((budget.spentMinor * 10000n) / budget.amountMinor) / 100),
  );
  const periodLabel =
    budget.period === 'monthly'
      ? 'Monthly'
      : budget.period === 'category'
        ? (selectedCategory?.name ?? 'Category budget')
        : budget.period === 'account'
          ? (accountName ?? 'Account budget')
          : 'Custom period';
  const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const range = `${new Date(budget.startAt).toLocaleDateString(undefined, dateOptions)} – ${new Date(budget.endAt).toLocaleDateString(undefined, dateOptions)}`;
  const remaining = budget.remainingMinor;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 36,
        gap: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="heading" numberOfLines={1}>
            {budget.name}
          </Typography>
          <Typography variant="caption">
            {periodLabel} · {range}
          </Typography>
        </View>
      </View>

      <Card
        variant="subtle"
        style={{
          padding: 20,
          gap: 18,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.surfaceRaised,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {selectedCategory ? (
            <CategoryIcon label={selectedCategory.name} icon={selectedCategory.icon} />
          ) : (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 15,
                backgroundColor: tokens.surfaceSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChartLineUp size={21} color={tokens.primary} />
            </View>
          )}
          <View style={{ flex: 1, gap: 3 }}>
            <Typography variant="bodyLarge">Budget progress</Typography>
            <Typography variant="caption">{Math.round(percent)}% used</Typography>
          </View>
          <Typography variant="caption">{budget.currency}</Typography>
        </View>
        <View style={{ gap: 4 }}>
          <Typography variant="caption">Spent this period</Typography>
          <Money amountMinor={budget.spentMinor} currency={budget.currency} size="display" />
          <Typography variant="small">
            of <Money amountMinor={budget.amountMinor} currency={budget.currency} />
          </Typography>
        </View>
        <Progress
          value={percent}
          color={percent >= 90 ? tokens.destructive : tokens.primary}
          height={10}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Typography variant="caption">Limit</Typography>
            <Money amountMinor={budget.amountMinor} currency={budget.currency} />
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
            <Typography variant="caption">
              {remaining < 0n ? 'Over limit' : 'Still available'}
            </Typography>
            <Money
              amountMinor={remaining < 0n ? -remaining : remaining}
              currency={budget.currency}
            />
          </View>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Typography variant="heading">Recent expenses</Typography>
        <Typography variant="caption">Posted transactions counted toward this budget</Typography>
        {recentExpenses.length > 0 ? (
          <View
            style={{
              paddingHorizontal: 14,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            {recentExpenses.map((expense, index) => (
              <React.Fragment key={expense.id}>
                {index > 0 && <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />}
                <TransactionRow
                  {...expense}
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: expense.id },
                    } as never)
                  }
                />
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View
            style={{
              padding: 18,
              gap: 6,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceSubtle,
            }}
          >
            <Typography variant="bodyLarge">No expenses counted yet</Typography>
            <Typography variant="small">Matching posted expenses will appear here.</Typography>
          </View>
        )}
      </View>

      {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
      <Button variant="outline" disabled={pending} onPress={archiveBudget}>
        {pending ? 'Archiving…' : 'Archive budget'}
      </Button>
    </ScrollView>
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
