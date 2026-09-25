import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BudgetProgress, CategoryIcon, Money, TransactionRow } from '@/components/finance';
import { parseMinor } from '@/lib/money';
import { CategoryEmojiPicker } from '@/components/finance/CategoryEmojiPicker';
import {
  Button,
  Empty,
  IconButton,
  Input,
  Label,
  Separator,
  Sheet,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';

type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  name: string;
  icon?: string;
  isSystem?: boolean;
  archivedAt?: number;
  limitCurrency?: string;
  monthlyLimitMinor?: bigint;
};
type ProfileRecord = LocalRecord & {
  defaultCurrency?: string;
  defaultExpenseCategoryId?: string;
  defaultIncomeCategoryId?: string;
};
type TransactionRecord = LocalRecord & {
  id?: string;
  _id?: string;
  categoryId?: string;
  occurredAt: number;
  amountMinor: bigint;
  currency: string;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  title: string;
  status: string;
  groupId?: string;
  deletedAt?: number;
};

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const transactionRecordsState = useLocalRecords<TransactionRecord>(userId, 'transaction');
  const now = new Date();
  const startAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const endAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const transactionState = useLocalTransactionRange<TransactionRecord>(
    userId,
    startAt,
    endAt,
    fetchTransactionRange,
  );
  const [limitInput, setLimitInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  if (categoryState.error) throw categoryState.error;
  if (profileState.error) throw profileState.error;
  if (transactionState.error) throw transactionState.error;
  if (transactionRecordsState.error) throw transactionRecordsState.error;

  const selectedCategory = categoryState.data?.find(
    (item) =>
      item.archivedAt === undefined && (item.id === id || item._id === id),
  );
  const categoryLocalId = selectedCategory?.id ?? selectedCategory?._id;
  const categoryPayloadId = selectedCategory?._id ?? selectedCategory?.id;
  const categoryIdentifiers = new Set(
    [selectedCategory?.id, selectedCategory?._id].filter(
      (value): value is string => typeof value === 'string',
    ),
  );
  const profile =
    profileState.data === undefined ? undefined : (profileState.data[0] ?? null);
  const currency = selectedCategory?.limitCurrency ?? profile?.defaultCurrency ?? 'INR';
  const categoryTransactions = (transactionRecordsState.data ?? [])
    .filter(
      (transaction) =>
        transaction.status === 'posted' &&
        transaction.deletedAt === undefined &&
        transaction.categoryId !== undefined &&
        categoryIdentifiers.has(transaction.categoryId),
    )
    .sort(
      (left, right) =>
        right.occurredAt - left.occurredAt ||
        (right._id ?? right.id ?? '').localeCompare(left._id ?? left.id ?? ''),
    );
  const monthlyTransactions = (transactionState.data ?? []).filter(
    (transaction) =>
      transaction.status === 'posted' &&
      transaction.deletedAt === undefined &&
      transaction.categoryId !== undefined &&
      categoryIdentifiers.has(transaction.categoryId),
  );
  const reportingCurrency = selectedCategory?.limitCurrency ?? profile?.defaultCurrency;
  const monthTotals = monthlyTransactions.reduce(
    (totals, transaction) => {
      if (!reportingCurrency || transaction.currency !== reportingCurrency) return totals;
      if (transaction.type === 'expense') totals.spentMinor += transaction.amountMinor;
      if (transaction.type === 'income') totals.receivedMinor += transaction.amountMinor;
      return totals;
    },
    { spentMinor: 0n, receivedMinor: 0n },
  );
  const detail =
    categoryState.data === undefined ||
    profileState.data === undefined ||
    transactionState.data === undefined ||
    transactionRecordsState.data === undefined
      ? undefined
      : selectedCategory
        ? {
            category: selectedCategory,
            monthSpentMinor: monthTotals.spentMinor,
            monthReceivedMinor: monthTotals.receivedMinor,
            transactions: categoryTransactions,
          }
        : null;
  const category = selectedCategory;

  async function saveIcon(icon?: string) {
    if (!userId || !category || !categoryLocalId || !categoryPayloadId) return;
    if (icon !== undefined && (icon.length === 0 || icon.length > 32)) {
      setError('Choose a valid category emoji.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'category',
        'category.setIcon',
        { ...category, icon: icon ?? undefined },
        { categoryId: categoryPayloadId, icon: icon ?? null },
        {
          recordId: categoryLocalId,
          dependencies: categoryPayloadId.startsWith('local-')
            ? [`category:${categoryPayloadId}`]
            : [],
        },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the category emoji.');
    } finally {
      setPending(false);
    }
  }

  async function saveLimit() {
    if (!userId || !category || !categoryLocalId || !categoryPayloadId) return;
    setError('');
    let amountMinor: bigint;
    try {
      amountMinor = parseMinor(limitInput, currency);
      if (amountMinor <= 0n) throw new Error('Enter a limit greater than zero.');
    } catch {
      setError('Enter a valid amount greater than zero.');
      return;
    }
    setPending(true);
    try {
      await commitLocalWrite(
        userId,
        'category',
        'category.setLimit',
        { ...category, monthlyLimitMinor: amountMinor, limitCurrency: currency },
        { categoryId: categoryPayloadId, amountMinor, currency },
        {
          recordId: categoryLocalId,
          dependencies: categoryPayloadId.startsWith('local-')
            ? [`category:${categoryPayloadId}`]
            : [],
        },
      );
      setLimitInput('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the limit.');
    } finally {
      setPending(false);
    }
  }

  async function clearLimit() {
    if (!userId || !category || !categoryLocalId || !categoryPayloadId) return;
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'category',
        'category.setLimit',
        { ...category, monthlyLimitMinor: undefined, limitCurrency: undefined },
        { categoryId: categoryPayloadId, amountMinor: null },
        {
          recordId: categoryLocalId,
          dependencies: categoryPayloadId.startsWith('local-')
            ? [`category:${categoryPayloadId}`]
            : [],
        },
      );
      setLimitInput('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not clear the limit.');
    } finally {
      setPending(false);
    }
  }

  async function toggleDefault(transactionType: 'expense' | 'income') {
    if (!userId || !category || !categoryPayloadId || !profile) return;
    const previousId =
      transactionType === 'expense'
        ? profile.defaultExpenseCategoryId
        : profile.defaultIncomeCategoryId;
    const isDefault = previousId !== undefined && categoryIdentifiers.has(previousId);
    const nextCategoryId = isDefault ? null : categoryPayloadId;
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'profile',
        'user.defaultCategory',
        {
          ...profile,
          ...(transactionType === 'expense'
            ? { defaultExpenseCategoryId: nextCategoryId ?? undefined }
            : { defaultIncomeCategoryId: nextCategoryId ?? undefined }),
        },
        { transactionType, categoryId: nextCategoryId },
        {
          recordId: profile.id ?? profile._id,
          dependencies:
            nextCategoryId?.startsWith('local-') ? [`category:${nextCategoryId}`] : [],
        },
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the default category.');
    } finally {
      setPending(false);
    }
  }

  async function saveName() {
    const name = nameInput.trim();
    if (!userId || !category || !categoryLocalId || !categoryPayloadId || !name) return;
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'category',
        'category.rename',
        { ...category, name },
        { categoryId: categoryPayloadId, name },
        {
          recordId: categoryLocalId,
          dependencies: categoryPayloadId.startsWith('local-')
            ? [`category:${categoryPayloadId}`]
            : [],
        },
      );
      setEditingName(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename category.');
    } finally {
      setPending(false);
    }
  }

  async function archive() {
    if (!userId || !category || !categoryLocalId || !categoryPayloadId) return;
    setPending(true);
    setError('');
    try {
      const defaultExpenseCategoryId =
        profile?.defaultExpenseCategoryId !== undefined &&
        categoryIdentifiers.has(profile.defaultExpenseCategoryId);
      const defaultIncomeCategoryId =
        profile?.defaultIncomeCategoryId !== undefined &&
        categoryIdentifiers.has(profile.defaultIncomeCategoryId);
      await commitLocalWrite(
        userId,
        'category',
        'category.archive',
        { ...category, archivedAt: Date.now() },
        { categoryId: categoryPayloadId },
        {
          recordId: categoryLocalId,
          dependencies: categoryPayloadId.startsWith('local-')
            ? [`category:${categoryPayloadId}`]
            : [],
          relatedRecords:
            profile && (defaultExpenseCategoryId || defaultIncomeCategoryId)
              ? [
                  {
                    entityType: 'profile',
                    record: {
                      ...profile,
                      ...(defaultExpenseCategoryId
                        ? { defaultExpenseCategoryId: undefined }
                        : {}),
                      ...(defaultIncomeCategoryId
                        ? { defaultIncomeCategoryId: undefined }
                        : {}),
                    },
                  },
                ]
              : [],
        },
      );
      setConfirmingArchive(false);
      router.replace('/category' as never);
    } catch (cause) {
      setConfirmingArchive(false);
      setError(cause instanceof Error ? cause.message : 'Could not archive category.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
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
          {category && <CategoryIcon label={category.name} icon={category.icon} />}
          <Typography variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {category?.name ?? 'Category'}
          </Typography>
          {category && !category.isSystem && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setNameInput(category.name);
                setEditingName(true);
              }}
            >
              Edit
            </Button>
          )}
        </View>
        {category && (
          <CategoryEmojiPicker value={category.icon} onChange={(icon) => void saveIcon(icon)} />
        )}

        {editingName && (
          <View style={{ gap: 10 }}>
            <Label>Category name</Label>
            <Input
              accessibilityLabel="Category name"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveName}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button size="sm" disabled={pending || !nameInput.trim()} onPress={saveName}>
                Save name
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setEditingName(false)}>
                Cancel
              </Button>
            </View>
          </View>
        )}
        {!id ? (
          <Empty title="Category unavailable." description="Open a category from your list." />
        ) : detail === undefined ? (
          <Typography variant="small">Loading category…</Typography>
        ) : detail === null ? (
          <Empty
            title="Category unavailable."
            description="This category could not be found or is no longer available."
          />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 }}>
              <View style={{ gap: 8 }}>
                <Typography variant="label">Spent this month</Typography>
                <Money amountMinor={detail.monthSpentMinor} currency={currency} size="display" />
              </View>
              <View style={{ gap: 8 }}>
                <Typography variant="label">Received this month</Typography>
                <Money amountMinor={detail.monthReceivedMinor} currency={currency} size="display" />
              </View>
            </View>

            <View style={{ gap: 18 }}>
              <View style={{ gap: 8 }}>
                <Typography variant="heading">Monthly limit</Typography>
                {detail.category.monthlyLimitMinor !== undefined ? (
                  <BudgetProgress
                    spentMinor={detail.monthSpentMinor}
                    limitMinor={detail.category.monthlyLimitMinor}
                    currency={currency}
                    title="This month"
                  />
                ) : (
                  <Typography variant="small">No monthly limit set.</Typography>
                )}
              </View>
              <View>
                <Label>
                  {detail.category.monthlyLimitMinor === undefined
                    ? 'Set a monthly limit'
                    : 'Change monthly limit'}{' '}
                  · {currency}
                </Label>
                <Input
                  accessibilityLabel={`Monthly limit in ${currency}`}
                  keyboardType="decimal-pad"
                  value={limitInput}
                  onChangeText={setLimitInput}
                  placeholder="Amount"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button size="sm" disabled={pending || !limitInput.trim()} onPress={saveLimit}>
                  Save limit
                </Button>
                {detail.category.monthlyLimitMinor !== undefined && (
                  <Button size="sm" variant="outline" disabled={pending} onPress={clearLimit}>
                    Clear limit
                  </Button>
                )}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Separator />
              <Typography variant="heading">Default category</Typography>
              {profile === undefined ? (
                <Typography variant="small">Loading preferences…</Typography>
              ) : profile === null ? (
                <Typography variant="small">Sign in to change your default category.</Typography>
              ) : (
                <>
                  <Typography variant="small">
                    Choose separate defaults for expenses and income.
                  </Typography>
                  {(['expense', 'income'] as const).map((transactionType) => {
                    const isDefault =
                      (transactionType === 'expense'
                        ? profile.defaultExpenseCategoryId
                        : profile.defaultIncomeCategoryId) !== undefined &&
                      categoryIdentifiers.has(
                        transactionType === 'expense'
                          ? profile.defaultExpenseCategoryId!
                          : profile.defaultIncomeCategoryId!,
                      );
                    return (
                      <View
                        key={transactionType}
                        style={{
                          minHeight: 52,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: tokens.borderSubtle,
                        }}
                      >
                        <Typography variant="bodyLarge">
                          {transactionType === 'expense' ? 'Expenses' : 'Income'}
                        </Typography>
                        <Button
                          accessibilityLabel={
                            isDefault
                              ? `Remove ${transactionType} default category`
                              : `Set ${category?.name ?? 'category'} as default for ${transactionType}`
                          }
                          accessibilityState={{ selected: isDefault, disabled: pending }}
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onPress={() => toggleDefault(transactionType)}
                          style={{ minHeight: 36, paddingHorizontal: 8 }}
                        >
                          {isDefault ? 'Default' : 'Set default'}
                        </Button>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}

            <View style={{ gap: 12 }}>
              <Typography variant="heading">Transactions</Typography>
              {detail.transactions.length === 0 ? (
                <Empty
                  title="No transactions in this category."
                  description="Choose this category when you add an expense or income to see it here."
                  action={
                    <Button size="sm" variant="outline" onPress={() => router.push('/transaction/new' as never)}>
                      Add transaction
                    </Button>
                  }
                />
              ) : (
                <View>
                  {detail.transactions.map((transaction, index) => (
                    <React.Fragment key={transaction.id ?? transaction._id}>
                      <TransactionRow
                        title={transaction.title}
                        category={category?.name}
                        categoryIcon={category?.icon}
                        amountMinor={transaction.amountMinor}
                        currency={transaction.currency}
                        type={transaction.type}
                        date={new Date(transaction.occurredAt).toLocaleDateString()}
                        semanticType={transaction.groupId ? 'split' : undefined}
                        onPress={() =>
                          router.push(`/transaction/${transaction._id ?? transaction.id}` as never)
                        }
                      />
                      {index < detail.transactions.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
            {!category?.isSystem && (
              <Button
                variant="destructive"
                onPress={() => setConfirmingArchive(true)}
                style={{ alignSelf: 'flex-start' }}
              >
                Archive category
              </Button>
            )}
          </>
        )}
      </ScrollView>
      <Sheet
        visible={confirmingArchive}
        title="Archive category?"
        onClose={() => setConfirmingArchive(false)}
      >
        <Typography variant="small">
          Past transactions remain in your history. This category will no longer appear in new
          transactions.
        </Typography>
        <Button variant="destructive" disabled={pending} onPress={archive}>
          Archive {category?.name}
        </Button>
        <Button variant="outline" onPress={() => setConfirmingArchive(false)}>
          Cancel
        </Button>
      </Sheet>
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
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        gap: 24,
      }}
    >
      <IconButton label="Go back" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <Empty
        title="Could not load category."
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
