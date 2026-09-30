'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CategoryDetailScreen,
  type CategoryDetailRecord,
  type CategoryDetailTransaction,
} from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  asMinor,
  belongsToUser,
  idOf,
  localDependency,
  matchesId,
  minorToInput,
  SignInGate,
} from '../../_personal';

type Category = LocalRecord & {
  name?: string;
  icon?: string;
  kind?: string;
  isSystem?: boolean;
  archivedAt?: number;
  limitCurrency?: string;
  monthlyLimitMinor?: bigint | number | string;
  updatedAt?: number;
};
type Profile = LocalRecord & {
  defaultCurrency?: string;
  defaultExpenseCategoryId?: string;
  defaultIncomeCategoryId?: string;
  timezone?: string;
};
type Account = LocalRecord & { name?: string; archivedAt?: number };
type Transaction = LocalRecord & {
  categoryId?: string;
  accountId?: string;
  merchant?: string;
  type?: string;
  groupId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  title?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
};
const maxInt64 = 9_223_372_036_854_775_807n;

export default function PersonalCategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Category>('category');
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const {
    records: transactions,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const {
    records: accountRecords,
    loading: accountLoading,
    error: accountError,
  } = useLocalRecords<Account>('account');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const category = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const profile = profiles.find((record) => userId && belongsToUser(record, userId));
  const accounts = accountRecords.filter((record) => userId && belongsToUser(record, userId));
  const accountByAlias = new Map<string, Account>();
  for (const account of accounts)
    for (const alias of aliasesOf(account)) accountByAlias.set(alias, account);
  const currency = category?.limitCurrency ?? profile?.defaultCurrency ?? 'INR';
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState('');
  const [limitInput, setLimitInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState(false);
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const historyRange = React.useMemo(() => {
    const now = new Date();
    return {
      startAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
      endAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    };
  }, []);
  React.useEffect(() => {
    setName(category?.name ?? '');
    setIcon(category?.icon ?? '');
    setLimitInput(
      category?.monthlyLimitMinor === undefined
        ? ''
        : minorToInput(category.monthlyLimitMinor, currency),
    );
  }, [
    category?.id,
    category?._id,
    category?.name,
    category?.icon,
    category?.monthlyLimitMinor,
    currency,
  ]);
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(historyRange.startAt, historyRange.endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          cause instanceof Error
            ? cause.message
            : 'Could not refresh this category’s activity range.',
        );
    });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, historyRange, isConnected, userId]);

  const categoryIdentifiers = new Set(category ? aliasesOf(category) : []);
  const isDefaultExpense =
    typeof profile?.defaultExpenseCategoryId === 'string' &&
    categoryIdentifiers.has(profile.defaultExpenseCategoryId);
  const isDefaultIncome =
    typeof profile?.defaultIncomeCategoryId === 'string' &&
    categoryIdentifiers.has(profile.defaultIncomeCategoryId);
  const matching = transactions
    .filter(
      (transaction) =>
        userId &&
        belongsToUser(transaction, userId) &&
        categoryIdentifiers.has(String(transaction.categoryId ?? '')) &&
        transaction.status === 'posted' &&
        transaction.deletedAt === undefined,
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const categoryMutationId = category
    ? String(category._id ?? category.cloudId ?? category.id ?? '')
    : '';
  const categoryDependency = category ? localDependency('category', category) : null;

  async function mutate(
    operation: 'category.rename' | 'category.setIcon' | 'category.setLimit',
    patch: LocalRecord,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!userId || !category || !categoryMutationId || pending) return false;
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'category',
        operation,
        { ...category, ...patch },
        { categoryId: categoryMutationId, ...payload },
        {
          recordId: idOf(category),
          dependencies: categoryDependency ? [categoryDependency] : [],
          baseUpdatedAt: typeof category.updatedAt === 'number' ? category.updatedAt : undefined,
        },
      );
      return true;
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this category.');
      return false;
    } finally {
      setPending(false);
    }
  }
  async function toggleDefault(transactionType: 'expense' | 'income') {
    if (!userId || !profile || !category || !categoryMutationId || pending) return;
    const field =
      transactionType === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId';
    const currentId = profile[field];
    const nextCategoryId =
      typeof currentId === 'string' && categoryIdentifiers.has(currentId)
        ? null
        : categoryMutationId;
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'profile',
        'user.defaultCategory',
        { ...profile, [field]: nextCategoryId ?? undefined },
        { transactionType, categoryId: nextCategoryId },
        {
          recordId: idOf(profile),
          dependencies: nextCategoryId && categoryDependency ? [categoryDependency] : [],
        },
      );
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : 'Could not update the default category.',
      );
    } finally {
      setPending(false);
    }
  }

  async function saveName(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter a category name.');
      return;
    }
    if (await mutate('category.rename', { name: trimmed }, { name: trimmed })) {
      setEditingName(false);
    }
  }
  async function saveLimit(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    try {
      const amountMinor = parseMinor(limitInput, currency);
      if (amountMinor > maxInt64) throw new Error('Enter a valid monthly limit.');
      if (amountMinor <= 0n) throw new Error('Enter a positive monthly limit.');
      await mutate(
        'category.setLimit',
        { monthlyLimitMinor: amountMinor, limitCurrency: currency },
        { amountMinor, currency },
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Enter a valid limit.');
    }
  }
  async function clearLimit() {
    await mutate(
      'category.setLimit',
      { monthlyLimitMinor: undefined, limitCurrency: undefined },
      { amountMinor: null },
    );
  }
  async function archive() {
    if (!userId || !category || !categoryMutationId || pending || category.isSystem) return;
    setFormError(null);
    try {
      const clearsExpenseDefault =
        profile?.defaultExpenseCategoryId !== undefined &&
        categoryIdentifiers.has(profile.defaultExpenseCategoryId);
      const clearsIncomeDefault =
        profile?.defaultIncomeCategoryId !== undefined &&
        categoryIdentifiers.has(profile.defaultIncomeCategoryId);
      await commitLocalWrite(
        userId,
        'category',
        'category.archive',
        { ...category, archivedAt: Date.now() },
        { categoryId: categoryMutationId },
        {
          recordId: idOf(category),
          dependencies: categoryDependency ? [categoryDependency] : [],
          baseUpdatedAt: typeof category.updatedAt === 'number' ? category.updatedAt : undefined,
        },
      );
      if (profile && clearsExpenseDefault) {
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultCategory',
          { ...profile, defaultExpenseCategoryId: undefined },
          { transactionType: 'expense', categoryId: null },
          { recordId: idOf(profile) },
        );
      }
      if (profile && clearsIncomeDefault) {
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultCategory',
          {
            ...profile,
            ...(clearsExpenseDefault ? { defaultExpenseCategoryId: undefined } : {}),
            defaultIncomeCategoryId: undefined,
          },
          { transactionType: 'income', categoryId: null },
          { recordId: idOf(profile) },
        );
      }
      router.replace('/categories');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not archive this category.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="CATEGORY DETAIL" title="Keep your categories close.">
        Sign in to view and update categories in this browser workspace.
      </SignInGate>
    );
  const detailTransactions: CategoryDetailTransaction[] = matching.map((transaction) => ({
    id: idOf(transaction),
    type: transaction.type ?? 'expense',
    title: transaction.title ?? transaction.type ?? 'Transaction',
    merchant: transaction.merchant,
    account: accountByAlias.get(String(transaction.accountId ?? ''))?.name,
    amountMinor: asMinor(transaction.amountMinor),
    currency: transaction.currency ?? currency,
    occurredAt: Number(transaction.occurredAt ?? 0),
    hasTime: transaction.hasTime,
    status: transaction.status ?? 'posted',
    deletedAt: transaction.deletedAt,
    groupId: transaction.groupId,
  }));
  const activity = matching.reduce(
    (value, transaction) => ({
      expense: value.expense || transaction.type === 'expense',
      income: value.income || transaction.type === 'income',
    }),
    { expense: false, income: false },
  );
  const detailCategory: CategoryDetailRecord | null = category
    ? {
        id: idOf(category),
        name: category.name ?? 'Category',
        icon: icon || undefined,
        kind:
          category.kind === 'income' || category.kind === 'expense'
            ? category.kind
            : activity.income && !activity.expense
              ? 'income'
              : 'expense',
        isSystem: category.isSystem,
        archivedAt: category.archivedAt,
        monthlyLimitMinor:
          category.monthlyLimitMinor === undefined
            ? undefined
            : asMinor(category.monthlyLimitMinor),
        limitCurrency: category.limitCurrency,
        updatedAt: category.updatedAt,
      }
    : null;
  const pageLoading = loading || profileLoading || transactionLoading || accountLoading;
  const pageError = error ?? profileError ?? transactionError ?? accountError;

  return (
    <CategoryDetailScreen
      category={detailCategory}
      profile={profile ?? null}
      transactions={detailTransactions}
      currency={currency}
      loading={pageLoading}
      error={pageError ? `Category data could not be opened: ${pageError}` : undefined}
      pending={pending}
      formError={formError ?? (rangeError ? `Activity refresh unavailable: ${rangeError}` : null)}
      editingName={editingName}
      nameValue={name}
      limitValue={limitInput}
      isDefaultExpense={isDefaultExpense}
      isDefaultIncome={isDefaultIncome}
      confirmingArchive={confirmingArchive}
      onBack={() => router.push('/categories')}
      onAddTransaction={() =>
        router.push(`/transaction/new?categoryId=${encodeURIComponent(routeId ?? '')}`)
      }
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
      onEditName={() => {
        setName(category?.name ?? '');
        setEditingName(true);
      }}
      onNameChange={setName}
      onSaveName={() => void saveName()}
      onCancelName={() => setEditingName(false)}
      onIconChange={(emoji) => {
        setIcon(emoji ?? '');
        void mutate('category.setIcon', { icon: emoji }, { icon: emoji ?? null });
      }}
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
