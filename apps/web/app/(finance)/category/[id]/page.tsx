'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Empty, SectionHeader, Separator, Sheet, Typography } from '@finapp/ui/web';
import {
  BudgetProgress,
  CategoryEmojiPicker,
  CategoryIcon,
  formatTransactionDate,
  TransactionRow,
} from '@finapp/ui/finance';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
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
type Transaction = LocalRecord & {
  categoryId?: string;
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
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const category = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const profile = profiles[0];
  const currency = category?.limitCurrency ?? profile?.defaultCurrency ?? 'INR';
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState('');
  const [limitInput, setLimitInput] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState(false);
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const monthRange = React.useMemo(() => {
    const now = new Date();
    return {
      startAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
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
    void fetchTransactionRange(monthRange.startAt, monthRange.endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh this month’s saved range.',
        );
    });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, monthRange, userId]);

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
        categoryIdentifiers.has(String(transaction.categoryId ?? '')) &&
        transaction.status === 'posted' &&
        transaction.deletedAt === undefined,
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const thisMonth = matching.filter(
    (transaction) =>
      Number(transaction.occurredAt ?? 0) >= monthRange.startAt &&
      Number(transaction.occurredAt ?? 0) < monthRange.endAt &&
      transaction.currency === currency,
  );
  const spent = thisMonth
    .filter((item) => item.type === 'expense')
    .reduce((total, item) => total + asMinor(item.amountMinor), 0n);
  const income = thisMonth
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + asMinor(item.amountMinor), 0n);
  const monthlyLimitMinor =
    category?.monthlyLimitMinor === undefined ? null : asMinor(category.monthlyLimitMinor);
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

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter a category name.');
      return;
    }
    if (await mutate('category.rename', { name: trimmed }, { name: trimmed })) {
      setEditingName(false);
    }
  }
  async function saveLimit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      router.replace('/category');
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
  if (loading || profileLoading || transactionLoading)
    return (
      <div className="finance-page">
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/category" aria-label="Go back">
            <ArrowLeft size={19} />
          </Link>
          <Typography variant="heading">Category</Typography>
        </header>
        <Typography variant="small" role="status">
          Loading category…
        </Typography>
      </div>
    );
  if (error || profileError || transactionError)
    return (
      <div className="finance-page">
        <p className="finance-form-error" role="alert">
          Category data could not be opened: {error ?? profileError ?? transactionError}
        </p>
      </div>
    );
  if (!category)
    return (
      <div className="finance-page">
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/category" aria-label="Go back">
            <ArrowLeft size={19} />
          </Link>
          <Typography variant="heading">Category</Typography>
        </header>
        <Empty
          title="Category unavailable."
          description="This category could not be found or is no longer available."
        />
      </div>
    );
  return (
    <div className="finance-page">
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link className="finance-secondary-action" href="/category" aria-label="Go back">
          <ArrowLeft size={19} />
        </Link>
        <CategoryIcon label={category.name ?? 'Category'} icon={category.icon} />
        <Typography variant="heading" style={{ minWidth: 0, flex: 1 }}>
          {category.name ?? 'Category'}
        </Typography>
        {!category.isSystem && category.archivedAt === undefined && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onPress={() => {
              setName(category.name ?? '');
              setEditingName(true);
            }}
          >
            Edit
          </Button>
        )}
      </header>
      {category.archivedAt !== undefined ? (
        <Typography variant="small">
          This category is archived and remains available to explain older transactions.
        </Typography>
      ) : (
        <>
          <section style={{ display: 'grid', gap: 12 }}>
            <CategoryEmojiPicker
              value={icon || undefined}
              onChange={(emoji) => {
                setIcon(emoji ?? '');
                void mutate('category.setIcon', { icon: emoji }, { icon: emoji ?? null });
              }}
            />
            {editingName && !category.isSystem && (
              <form className="finance-form" onSubmit={saveName}>
                <FinanceInput
                  label="Category name"
                  value={name}
                  onChangeText={setName}
                  maxLength={80}
                  required
                />
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button type="submit" disabled={pending || !name.trim()}>
                    {pending ? 'Saving…' : 'Save name'}
                  </Button>
                  <Button type="button" variant="ghost" onPress={() => setEditingName(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </section>
        </>
      )}
      {formError && (
        <p className="finance-form-error" role="alert">
          {formError}
        </p>
      )}
      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <Typography variant="label">Spent this month</Typography>
          <Typography variant="heading">{formatMinor(spent, currency)}</Typography>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <Typography variant="label">Received this month</Typography>
          <Typography variant="heading">{formatMinor(income, currency)}</Typography>
        </div>
      </section>
      <section style={{ display: 'grid', gap: 18 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <Typography variant="heading">Monthly limit</Typography>
          {monthlyLimitMinor !== null ? (
            <BudgetProgress
              spentMinor={spent}
              limitMinor={monthlyLimitMinor}
              currency={currency}
              title="This month"
            />
          ) : (
            <Typography variant="small">No monthly limit set.</Typography>
          )}
        </div>
        {category.archivedAt === undefined && (
          <>
            <form className="finance-form" onSubmit={saveLimit}>
              <FinanceInput
                label={`${monthlyLimitMinor === null ? 'Set a monthly limit' : 'Change monthly limit'} · ${currency}`}
                type="number"
                min="0.01"
                step={currency === 'JPY' || currency === 'KRW' ? '1' : '0.01'}
                value={limitInput}
                onChangeText={setLimitInput}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="submit" disabled={pending || !limitInput.trim()}>
                  Save limit
                </Button>
                {monthlyLimitMinor !== null && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onPress={() => void clearLimit()}
                  >
                    Clear limit
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        <SectionHeader title="Default category" />
        {profileLoading ? (
          <Typography variant="small">Loading preferences…</Typography>
        ) : !profile ? (
          <Typography variant="small">Sign in to change your default category.</Typography>
        ) : (
          <>
            <Typography variant="small">
              Choose separate defaults for expenses and income.
            </Typography>
            {(['expense', 'income'] as const).map((transactionType) => {
              const isDefault = transactionType === 'expense' ? isDefaultExpense : isDefaultIncome;
              return (
                <div
                  key={transactionType}
                  style={{
                    display: 'flex',
                    minHeight: 52,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderBottom: '1px solid var(--finance-line)',
                  }}
                >
                  <Typography variant="bodyLarge">
                    {transactionType === 'expense' ? 'Expenses' : 'Income'}
                  </Typography>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending || category.archivedAt !== undefined}
                    onPress={() => void toggleDefault(transactionType)}
                  >
                    {isDefault ? 'Default' : 'Set default'}
                  </Button>
                </div>
              );
            })}
          </>
        )}
      </section>
      <section style={{ display: 'grid', gap: 12 }}>
        <SectionHeader title="Transactions" />
        {transactionLoading ? (
          <Typography variant="small" role="status">
            Loading category…
          </Typography>
        ) : transactionError ? (
          <p className="finance-form-error" role="alert">
            Activity could not be opened: {transactionError}
          </p>
        ) : matching.length === 0 ? (
          <Empty
            title="No transactions in this category."
            description="Choose this category when you add an expense or income to see it here."
            action={
              <Link
                className="finance-inline-link"
                href={`/transaction/new?categoryId=${encodeURIComponent(routeId ?? '')}`}
              >
                Add transaction
              </Link>
            }
          />
        ) : (
          <div>
            {matching.map((transaction, index) => (
              <React.Fragment key={idOf(transaction)}>
                <TransactionRow
                  title={transaction.title ?? transaction.type ?? 'Transaction'}
                  category={category.name}
                  categoryIcon={category.icon}
                  amountMinor={asMinor(transaction.amountMinor)}
                  currency={transaction.currency ?? currency}
                  type={
                    (transaction.type ?? 'expense') as
                      'expense' | 'income' | 'transfer' | 'refund' | 'adjustment'
                  }
                  date={
                    transaction.occurredAt
                      ? formatTransactionDate(
                          transaction.occurredAt,
                          transaction.hasTime,
                          profile?.timezone,
                        )
                      : 'Date unavailable'
                  }
                  semanticType={transaction.groupId ? 'split' : undefined}
                  onPress={() =>
                    router.push(`/transaction/${encodeURIComponent(idOf(transaction))}`)
                  }
                />
                {index < matching.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </div>
        )}
        {rangeError && (
          <p className="finance-muted" role="status">
            Range refresh unavailable: {rangeError}
          </p>
        )}
      </section>
      {category.archivedAt === undefined && !category.isSystem && (
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onPress={() => setConfirmingArchive(true)}
        >
          Archive category
        </Button>
      )}
      <Sheet
        visible={confirmingArchive}
        title="Archive category?"
        onClose={() => setConfirmingArchive(false)}
      >
        <Typography variant="small">
          Past transactions remain in your history. This category will no longer appear in new
          transactions.
        </Typography>
        <Button variant="destructive" disabled={pending} onPress={() => void archive()}>
          Archive {category.name}
        </Button>
        <Button variant="outline" onPress={() => setConfirmingArchive(false)}>
          Cancel
        </Button>
      </Sheet>
    </div>
  );
}
