import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, CaretRight, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Progress, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type BudgetRecord = LocalRecord & {
  id?: string;
  _id?: string;
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
type CategoryRecord = LocalRecord & { id?: string; _id?: string };
type AccountRecord = LocalRecord & { id?: string; _id?: string };

export default function BudgetScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const budgetState = useLocalRecords<BudgetRecord>(userId, 'budget');
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const activeBudgets = (budgetState.data ?? [])
    .filter((budget) => budget.archivedAt === undefined)
    .sort((left, right) => left.startAt - right.startAt || left.name.localeCompare(right.name));
  const needsCategoryIds = activeBudgets.some((budget) => budget.categoryId !== undefined);
  const needsAccountIds = activeBudgets.some((budget) => budget.accountId !== undefined);
  const startAt =
    activeBudgets.length > 0 ? Math.min(...activeBudgets.map((budget) => budget.startAt)) : 0;
  const endAt =
    activeBudgets.length > 0 ? Math.max(...activeBudgets.map((budget) => budget.endAt)) : 0;
  const transactionState = useLocalTransactionRange<TransactionRecord>(
    userId,
    startAt,
    endAt,
    fetchTransactionRange,
  );

  if (budgetState.error) throw budgetState.error;
  if (transactionState.error) throw transactionState.error;
  if (needsCategoryIds && categoryState.error) throw categoryState.error;
  if (needsAccountIds && accountState.error) throw accountState.error;
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

  const transactions = activeBudgets.length > 0 ? transactionState.data ?? [] : [];
  const budgets = activeBudgets.map((budget) => {
    const spentMinor = transactions.reduce((total, transaction) => {
      if (
        transaction.type !== 'expense' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined ||
        transaction.currency !== budget.currency ||
        transaction.occurredAt < budget.startAt ||
        transaction.occurredAt >= budget.endAt ||
        (budget.categoryId !== undefined &&
          (categoryIdByAlias.get(transaction.categoryId ?? '') ?? transaction.categoryId) !==
            (categoryIdByAlias.get(budget.categoryId) ?? budget.categoryId)) ||
        (budget.accountId !== undefined &&
          (accountIdByAlias.get(transaction.accountId) ?? transaction.accountId) !==
            (accountIdByAlias.get(budget.accountId) ?? budget.accountId))
      )
        return total;
      return total + transaction.amountMinor;
    }, 0n);
    return {
      ...budget,
      spentMinor,
      remainingMinor: budget.amountMinor - spentMinor,
    };
  });
  const loading =
    budgetState.loading ||
    (needsCategoryIds && categoryState.loading) ||
    (needsAccountIds && accountState.loading) ||
    (activeBudgets.length > 0 && transactionState.loading);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 28,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>
          Budgets
        </Typography>
        <IconButton
          label="New budget"
          variant="ghost"
          onPress={() => router.push('/budget/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>
      {loading ? (
        <Text style={{ color: tokens.foregroundMuted }}>Loading budgets…</Text>
      ) : budgets.length === 0 ? (
        <Empty
          title="No budgets yet."
          description="Set a spending limit and see real expenses count toward it."
          action={
            <Button size="sm" variant="outline" onPress={() => router.push('/budget/new' as never)}>
              Create budget
            </Button>
          }
        />
      ) : (
        <View style={{ gap: 18 }}>
          {budgets.map((budget, index) => {
            const progress = Number((budget.spentMinor * 10000n) / budget.amountMinor) / 100;
            const percent = Math.min(100, Math.max(0, progress));
            const period =
              budget.period === 'monthly'
                ? 'Monthly'
                : budget.period === 'category'
                  ? 'Category'
                  : budget.period === 'account'
                    ? 'Account'
                    : 'Custom period';
            return (
              <React.Fragment key={budget.id ?? budget._id}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${budget.name} budget`}
                  onPress={() => router.push(`/budget/${budget.id ?? budget._id}` as never)}
                  style={({ pressed }) => ({
                    gap: 11,
                    paddingVertical: 8,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Typography variant="bodyLarge">{budget.name}</Typography>
                      <Text style={{ color: tokens.foregroundMuted }}>{period}</Text>
                    </View>
                    <CaretRight size={18} color={tokens.foregroundSubtle} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Money amountMinor={budget.spentMinor} currency={budget.currency} />
                    <Text style={{ color: tokens.foregroundMuted }}>of</Text>
                    <Money amountMinor={budget.amountMinor} currency={budget.currency} />
                  </View>
                  <Progress
                    value={percent}
                    color={percent >= 90 ? tokens.destructive : tokens.primary}
                  />
                  <Text style={{ color: tokens.foregroundMuted }}>
                    {budget.remainingMinor < 0n ? 'Over by ' : 'Remaining '}
                    {
                      <Money
                        amountMinor={
                          budget.remainingMinor < 0n
                            ? -budget.remainingMinor
                            : budget.remainingMinor
                        }
                        currency={budget.currency}
                      />
                    }
                  </Text>
                </Pressable>
                {index < budgets.length - 1 && <Separator />}
              </React.Fragment>
            );
          })}
        </View>
      )}
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
      <Typography variant="heading">Budgets unavailable</Typography>
      <Text>{error.message}</Text>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
