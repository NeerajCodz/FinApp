import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ChartLineUp } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Card, IconButton, Progress, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';

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
  const spentMinor =
    selectedBudget && transactionState.data
      ? transactionState.data.reduce((total, transaction) => {
          if (
            transaction.type !== 'expense' ||
            transaction.status !== 'posted' ||
            transaction.deletedAt !== undefined ||
            transaction.currency !== selectedBudget.currency ||
            transaction.occurredAt < selectedBudget.startAt ||
            transaction.occurredAt >= selectedBudget.endAt ||
            (selectedBudget.categoryId !== undefined &&
              (categoryIdByAlias.get(transaction.categoryId ?? '') ?? transaction.categoryId) !==
                (categoryIdByAlias.get(selectedBudget.categoryId) ?? selectedBudget.categoryId)) ||
            (selectedBudget.accountId !== undefined &&
              (accountIdByAlias.get(transaction.accountId) ?? transaction.accountId) !==
                (accountIdByAlias.get(selectedBudget.accountId) ?? selectedBudget.accountId))
          )
            return total;
          return total + transaction.amountMinor;
        }, 0n)
      : 0n;
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
  const categoryName = budget?.categoryId
    ? categoryState.data?.find(
        (item) =>
          item.archivedAt === undefined &&
          (item.id === budget.categoryId || item._id === budget.categoryId),
      )?.name
    : undefined;
  const accountName = budget?.accountId
    ? accountState.data?.find(
        (item) =>
          item.archivedAt === undefined &&
          (item.id === budget.accountId || item._id === budget.accountId),
      )?.name
    : undefined;

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
          onPress={() => router.replace('/budget' as never)}
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
        ? (categoryName ?? 'Category budget')
        : budget.period === 'account'
          ? (accountName ?? 'Account budget')
          : 'Custom period';
  const range = `${new Date(budget.startAt).toLocaleDateString()} – ${new Date(budget.endAt).toLocaleDateString()}`;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
          {budget.name}
        </Typography>
      </View>
      <View style={{ gap: 10 }}>
        <Text style={{ color: tokens.foregroundMuted }}>
          {periodLabel} · {range}
        </Text>
        <Money amountMinor={budget.spentMinor} currency={budget.currency} size="display" />
        <Typography variant="caption">
          spent of <Money amountMinor={budget.amountMinor} currency={budget.currency} />
        </Typography>
        <Typography
          variant="heading"
          style={{ color: budget.remainingMinor < 0n ? tokens.destructive : tokens.foreground }}
        >
          {budget.remainingMinor < 0n ? 'Over by ' : 'Remaining '}
          <Money
            amountMinor={
              budget.remainingMinor < 0n ? -budget.remainingMinor : budget.remainingMinor
            }
            currency={budget.currency}
          />
        </Typography>
        <Progress
          value={percent}
          color={percent >= 90 ? tokens.destructive : tokens.primary}
          height={8}
        />
        <Text style={{ color: tokens.foregroundMuted }}>
          {((budget.spentMinor * 100n) / budget.amountMinor).toString()}% used
        </Text>
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
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Typography variant="heading">Budget unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
