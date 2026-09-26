import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, CaretRight, ChartLineUp, Plus } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon, Money } from '@/components/finance';
import { Button, IconButton, Progress, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

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
type CategoryRecord = LocalRecord & { id?: string; _id?: string; name?: string; icon?: string };
type AccountRecord = LocalRecord & { id?: string; _id?: string };

export default function BudgetScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const budgetState = useLocalRecords<BudgetRecord>(userId, 'budget');
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const activeBudgets = (budgetState.data ?? [])
    .filter(
      (budget) =>
        budget.archivedAt === undefined &&
        (budget.id ?? budget._id ?? budget.cloudId) !== undefined,
    )
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
  const categoryById = new Map<string, CategoryRecord>();
  for (const category of categoryState.data ?? []) {
    const canonicalId = category.id ?? category._id;
    if (!canonicalId) continue;
    if (category.id) categoryIdByAlias.set(category.id, canonicalId);
    if (category.id) categoryById.set(category.id, category);
    if (category._id) categoryById.set(category._id, category);
    if (category._id) categoryIdByAlias.set(category._id, canonicalId);
  }
  const accountIdByAlias = new Map<string, string>();
  for (const account of accountState.data ?? []) {
    const canonicalId = account.id ?? account._id;
    if (!canonicalId) continue;
    if (account.id) accountIdByAlias.set(account.id, canonicalId);
    if (account._id) accountIdByAlias.set(account._id, canonicalId);
  }

  const transactions = activeBudgets.length > 0 ? (transactionState.data ?? []) : [];
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
  const featuredBudget = budgets[0];
  const summaryCurrency = featuredBudget?.currency ?? 'INR';
  const summaryLimit = featuredBudget?.amountMinor ?? 0n;
  const summarySpent = featuredBudget?.spentMinor ?? 0n;
  const summaryRemaining = summaryLimit - summarySpent;
  const summaryPercent =
    summaryLimit > 0n ? Math.min(100, Number((summarySpent * 10000n) / summaryLimit) / 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 36,
        gap: 22,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="title">Budgets</Typography>
          <Typography variant="caption">Keep spending within reach</Typography>
        </View>
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
        <View
          style={{
            minHeight: 360,
            justifyContent: 'center',
            padding: 24,
            gap: 16,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 19,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChartLineUp size={27} color={tokens.primary} />
          </View>
          <View style={{ gap: 8 }}>
            <Typography variant="heading">Give your money a plan</Typography>
            <Typography variant="small">
              Add a spending limit and watch real posted expenses move against it.
            </Typography>
          </View>
          <Button onPress={() => router.push('/budget/new' as never)}>Create a budget</Button>
        </View>
      ) : (
        <>
          <View
            style={{
              padding: 20,
              gap: 18,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceRaised,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ gap: 3 }}>
                <Typography variant="label">Budget overview</Typography>
                <Typography variant="caption">
                  {featuredBudget
                    ? `${featuredBudget.name} · ${summaryCurrency}`
                    : 'No active budget'}
                </Typography>
              </View>
              <ChartLineUp size={21} color={tokens.primary} />
            </View>
            <View style={{ gap: 4 }}>
              <Typography variant="caption">Spent so far</Typography>
              <Money amountMinor={summarySpent} currency={summaryCurrency} size="display" />
            </View>
            <Progress
              value={summaryPercent}
              color={summaryPercent >= 100 ? tokens.destructive : tokens.primary}
              height={9}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Typography variant="caption">Budgeted</Typography>
                <Money amountMinor={summaryLimit} currency={summaryCurrency} />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                <Typography variant="caption">
                  {summaryRemaining < 0n ? 'Over limit' : 'Available'}
                </Typography>
                <Money
                  amountMinor={summaryRemaining < 0n ? -summaryRemaining : summaryRemaining}
                  currency={summaryCurrency}
                />
              </View>
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="heading">Your budgets</Typography>
              <Typography variant="caption">{budgets.length} active</Typography>
            </View>
            {budgets.map((budget) => {
              const budgetId = budget.id ?? budget._id ?? budget.cloudId;
              if (!budgetId) return null;
              const progress =
                budget.amountMinor > 0n
                  ? Number((budget.spentMinor * 10000n) / budget.amountMinor) / 100
                  : 0;
              const category = budget.categoryId ? categoryById.get(budget.categoryId) : undefined;
              const percent = Math.min(100, Math.max(0, progress));
              const period =
                budget.period === 'monthly'
                  ? 'Monthly'
                  : budget.period === 'category'
                    ? (category?.name ?? 'Category')
                    : budget.period === 'account'
                      ? 'Account'
                      : 'Custom period';
              const remaining = budget.remainingMinor;
              return (
                <TouchableOpacity
                  key={budgetId}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${budget.name} budget`}
                  onPress={() =>
                    router.push({ pathname: '/budget/[id]', params: { id: budgetId } } as never)
                  }
                  activeOpacity={0.78}
                  style={{
                    gap: 15,
                    padding: 17,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                    backgroundColor: tokens.surfaceSubtle,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                    {category ? (
                      <CategoryIcon label={category.name ?? 'Category'} icon={category.icon} />
                    ) : (
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor: tokens.surfaceRaised,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ChartLineUp size={20} color={tokens.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 3 }}>
                      <Typography variant="bodyLarge" numberOfLines={1}>
                        {budget.name}
                      </Typography>
                      <Typography variant="caption">
                        {period} · {budget.currency}
                      </Typography>
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
                    color={progress >= 100 ? tokens.destructive : tokens.primary}
                    height={7}
                  />
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: remaining < 0n ? tokens.destructive : tokens.foregroundMuted,
                      }}
                    >
                      {remaining < 0n ? 'Over by ' : 'Available '}
                      <Money
                        amountMinor={remaining < 0n ? -remaining : remaining}
                        currency={budget.currency}
                      />
                    </Text>
                    <Typography variant="caption">{Math.round(progress)}% used</Typography>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
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
