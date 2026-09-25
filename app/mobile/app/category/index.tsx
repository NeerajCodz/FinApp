import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, CaretRight, Plus } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon } from '@/components/finance';
import { Money } from '@/components/finance';
import { Button, Empty, IconButton, Separator, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  name: string;
  icon?: string;
  sortOrder: number;
  archivedAt?: number;
  monthlyLimitMinor?: bigint;
  limitCurrency?: string;
};
type ProfileRecord = LocalRecord & { defaultCurrency?: string };
type TransactionRecord = LocalRecord & {
  categoryId?: string;
  occurredAt: number;
  amountMinor: bigint;
  currency: string;
  type: string;
  status: string;
  deletedAt?: number;
};

export default function CategoriesScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const now = new Date();
  const startAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const endAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const transactionState = useLocalTransactionRange<TransactionRecord>(
    userId,
    startAt,
    endAt,
    fetchTransactionRange,
  );

  if (categoryState.error) throw categoryState.error;
  if (profileState.error) throw profileState.error;
  if (transactionState.error) throw transactionState.error;

  const categoriesInStore = categoryState.data;
  const profile = profileState.data?.[0];
  const activeCategories = (categoriesInStore ?? [])
    .filter((category) => category.archivedAt === undefined)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        (left._id ?? left.id ?? '').localeCompare(right._id ?? right.id ?? ''),
    );
  const categoryById = new Map<string, CategoryRecord>();
  for (const category of activeCategories) {
    if (category.id) categoryById.set(category.id, category);
    if (category._id) categoryById.set(category._id, category);
  }
  const totals = new Map<CategoryRecord, { spentMinor: bigint; receivedMinor: bigint }>();
  for (const transaction of transactionState.data ?? []) {
    if (
      transaction.status !== 'posted' ||
      transaction.deletedAt !== undefined ||
      !transaction.categoryId ||
      (transaction.type !== 'expense' && transaction.type !== 'income')
    )
      continue;
    const category = categoryById.get(transaction.categoryId);
    const currency = category?.limitCurrency ?? profile?.defaultCurrency;
    if (!category || !currency || transaction.currency !== currency) continue;
    const total = totals.get(category) ?? { spentMinor: 0n, receivedMinor: 0n };
    if (transaction.type === 'expense') total.spentMinor += transaction.amountMinor;
    else total.receivedMinor += transaction.amountMinor;
    totals.set(category, total);
  }
  const categories = activeCategories.map((category) => {
    const total = totals.get(category);
    return {
      ...category,
      monthSpentMinor: total?.spentMinor ?? 0n,
      monthReceivedMinor: total?.receivedMinor ?? 0n,
      monthCurrency: category.limitCurrency ?? profile?.defaultCurrency ?? null,
    };
  });
  const loading =
    categoryState.loading || profileState.loading || transactionState.loading;

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
        <Typography variant="title" style={{ flex: 1 }}>
          Categories
        </Typography>
        <IconButton
          label="Add category"
          variant="ghost"
          onPress={() => router.push('/category/new' as never)}
        >
          <Plus size={22} color={tokens.foreground} />
        </IconButton>
      </View>

      {loading ? (
        <Typography variant="small">Loading categories…</Typography>
      ) : categories.length === 0 ? (
        <Empty
          title="No categories yet."
          description="Create a category to organize your income and spending."
          action={
            <Button
              size="sm"
              variant="outline"
              onPress={() => router.push('/category/new' as never)}
            >
              Add category
            </Button>
          }
        />
      ) : (
        <View style={{ gap: 12 }}>
          <Typography variant="label">Categories</Typography>
          <View>
            {categories.map((category, index) => (
              <React.Fragment key={category.id ?? category._id}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${category.name} category`}
                  onPress={() =>
                    router.push(`/category/${category.id ?? category._id}` as never)
                  }
                  activeOpacity={0.7}
                  style={{
                    minHeight: 72,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <CategoryIcon label={category.name} icon={category.icon} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Typography variant="bodyLarge" numberOfLines={1} style={{ fontSize: 15 }}>
                      {category.name}
                    </Typography>
                    <Typography variant="caption">Monthly activity</Typography>
                  </View>
                  {category.monthCurrency && (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Typography variant="caption">Spent</Typography>
                        <Money
                          amountMinor={category.monthSpentMinor}
                          currency={category.monthCurrency}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Typography variant="caption">Received</Typography>
                        <Money
                          amountMinor={category.monthReceivedMinor}
                          currency={category.monthCurrency}
                        />
                      </View>
                      {category.monthlyLimitMinor !== undefined && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Typography variant="caption">Limit</Typography>
                          <Money
                            amountMinor={category.monthlyLimitMinor}
                            currency={category.monthCurrency}
                          />
                        </View>
                      )}
                    </View>
                  )}
                  <CaretRight size={18} color={tokens.foregroundSubtle} />
                </TouchableOpacity>
                {index < categories.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </View>
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
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        gap: 24,
      }}
    >
      <IconButton label="Go back" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Empty
        title="Could not load categories."
        description={error.message}
        action={
          <Button size="sm" variant="outline" onPress={retry}>
            Try again
          </Button>
        }
      />
    </View>
  );
}
