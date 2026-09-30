import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CategoryDetailScreen as CategoryDetailView,
  type CategoryDetailRecord,
  type CategoryDetailTransaction,
} from '@finapp/ui/finance';
import { parseMinor } from '@/lib/money';
import { Button, Empty, IconButton, useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';

type CategoryRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name: string;
  kind?: string;
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
  timezone?: string;
};
type AccountRecord = LocalRecord & { id?: string; _id?: string; cloudId?: string; name?: string; archivedAt?: number };
type TransactionRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  categoryId?: string;
  accountId?: string;
  merchant?: string;
  occurredAt: number;
  hasTime?: boolean;
  amountMinor: bigint;
  currency: string;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  title: string;
  status: string;
  groupId?: string;
  deletedAt?: number;
};
function recordAliases(record: LocalRecord) {
  return [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
}
function recordId(record: LocalRecord) {
  return String(record.id ?? record._id ?? record.cloudId ?? '');
}



export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, fetchTransactionRange } = useLocalSync();
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const transactionRecordsState = useLocalRecords<TransactionRecord>(userId, 'transaction');
  const now = new Date();
  const startAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1);
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
  if (accountState.error) throw accountState.error;
  if (transactionState.error) throw transactionState.error;
  if (transactionRecordsState.error) throw transactionRecordsState.error;

  const owns = (record: LocalRecord) => !!userId && (typeof record.ownerId !== 'string' || record.ownerId === userId);
  const selectedCategory = categoryState.data?.find(
    (item) => owns(item) && recordAliases(item).includes(id ?? ''),
  );
  const categoryLocalId = selectedCategory?.id ?? selectedCategory?._id;
  const categoryPayloadId = selectedCategory?._id ?? selectedCategory?.cloudId ?? selectedCategory?.id;
  const categoryIdentifiers = new Set(selectedCategory ? recordAliases(selectedCategory) : []);
  const profile = profileState.data === undefined ? undefined : (profileState.data.find(owns) ?? null);
  const accounts = (accountState.data ?? []).filter(owns);
  const accountByAlias = new Map<string, AccountRecord>();
  for (const account of accounts) for (const alias of recordAliases(account)) accountByAlias.set(alias, account);
  const currency = selectedCategory?.limitCurrency ?? profile?.defaultCurrency ?? 'INR';
  const categoryTransactions = (transactionRecordsState.data ?? [])
    .filter(
      (transaction) =>
        owns(transaction) &&
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
          dependencies: nextCategoryId?.startsWith('local-') ? [`category:${nextCategoryId}`] : [],
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
                      ...(defaultExpenseCategoryId ? { defaultExpenseCategoryId: undefined } : {}),
                      ...(defaultIncomeCategoryId ? { defaultIncomeCategoryId: undefined } : {}),
                    },
                  },
                ]
              : [],
        },
      );
      setConfirmingArchive(false);
      router.replace('/categories' as never);
    } catch (cause) {
      setConfirmingArchive(false);
      setError(cause instanceof Error ? cause.message : 'Could not archive category.');
    } finally {
      setPending(false);
    }
  }

  const detailTransactions: CategoryDetailTransaction[] = categoryTransactions.map((transaction) => ({
    id: recordId(transaction),
    type: transaction.type,
    title: transaction.title,
    merchant: transaction.merchant,
    account: accountByAlias.get(String(transaction.accountId ?? ''))?.name,
    amountMinor: transaction.amountMinor,
    currency: transaction.currency,
    occurredAt: transaction.occurredAt,
    hasTime: transaction.hasTime,
    status: transaction.status,
    deletedAt: transaction.deletedAt,
    groupId: transaction.groupId,
  }));
  const transactionKind = categoryTransactions.reduce(
    (types, transaction) => ({
      expense: types.expense || transaction.type === 'expense',
      income: types.income || transaction.type === 'income',
    }),
    { expense: false, income: false },
  );
  const detailCategory: CategoryDetailRecord | null = category
    ? {
        id: recordId(category),
        name: category.name,
        icon: category.icon,
        kind:
          category.kind === 'income' || category.kind === 'expense'
            ? category.kind
            : transactionKind.income && !transactionKind.expense
              ? 'income'
              : 'expense',
        isSystem: category.isSystem,
        archivedAt: category.archivedAt,
        monthlyLimitMinor: category.monthlyLimitMinor,
        limitCurrency: category.limitCurrency,
        updatedAt: typeof category.updatedAt === 'number' ? category.updatedAt : undefined,
      }
    : null;
  const isDefaultExpense =
    typeof profile?.defaultExpenseCategoryId === 'string' &&
    categoryIdentifiers.has(profile.defaultExpenseCategoryId);
  const isDefaultIncome =
    typeof profile?.defaultIncomeCategoryId === 'string' &&
    categoryIdentifiers.has(profile.defaultIncomeCategoryId);
  const loading =
    categoryState.loading ||
    profileState.loading ||
    accountState.loading ||
    transactionState.loading ||
    transactionRecordsState.loading;

  if (!userId)
    return (
      <Empty
        title="Sign in to view this category."
        description="Your categories and transactions are private to your account."
      />
    );

  return (
    <CategoryDetailView
      category={detailCategory}
      profile={profile ?? null}
      transactions={detailTransactions}
      currency={currency}
      loading={loading}
      pending={pending}
      formError={error}
      editingName={editingName}
      nameValue={nameInput}
      limitValue={limitInput}
      isDefaultExpense={isDefaultExpense}
      isDefaultIncome={isDefaultIncome}
      confirmingArchive={confirmingArchive}
      onBack={() => router.push('/categories' as never)}
      onAddTransaction={() =>
        router.push(`/transaction/new?categoryId=${encodeURIComponent(id ?? '')}` as never)
      }
      onOpenTransaction={(transactionId) =>
        router.push(`/transaction/${encodeURIComponent(transactionId)}` as never)
      }
      onEditName={() => {
        setNameInput(category?.name ?? '');
        setEditingName(true);
      }}
      onNameChange={setNameInput}
      onSaveName={() => void saveName()}
      onCancelName={() => setEditingName(false)}
      onIconChange={(emoji) => void saveIcon(emoji)}
      onLimitChange={setLimitInput}
      onSaveLimit={() => void saveLimit()}
      onClearLimit={() => void clearLimit()}
      onToggleDefault={(type) => void toggleDefault(type)}
      onRequestArchive={() => setConfirmingArchive(true)}
      onConfirmArchive={() => void archive()}
      onCancelArchive={() => setConfirmingArchive(false)}
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
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        gap: 24,
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
