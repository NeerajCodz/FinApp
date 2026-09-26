'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Tags } from 'lucide-react';
import { Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import {
  asMinor,
  belongsToUser,
  idOf,
  matchesId,
  minorToInput,
  PageHeading,
  SignInGate,
  syncedId,
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
};
type Transaction = LocalRecord & {
  categoryId?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  title?: string;
  occurredAt?: number;
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

  const aliases = new Set(
    [category?.id, category?._id, category?.cloudId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ),
  );
  const matching = transactions
    .filter(
      (transaction) =>
        aliases.has(String(transaction.categoryId ?? '')) &&
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
  const categoryIdentifiers = new Set(
    [category?.id, category?._id, category?.cloudId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ),
  );
  const isDefaultExpense =
    typeof profile?.defaultExpenseCategoryId === 'string' &&
    categoryIdentifiers.has(profile.defaultExpenseCategoryId);
  const isDefaultIncome =
    typeof profile?.defaultIncomeCategoryId === 'string' &&
    categoryIdentifiers.has(profile.defaultIncomeCategoryId);
  const categoryCloudId = category ? syncedId(category) : null;

  async function mutate(
    operation: 'category.rename' | 'category.setIcon' | 'category.setLimit' | 'category.archive',
    patch: LocalRecord,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!userId || !category || !categoryCloudId || pending) return false;
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'category',
        operation,
        { ...category, ...patch },
        { categoryId: categoryCloudId, ...payload },
        {
          recordId: idOf(category),
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
    if (!userId || !profile || !category || !categoryCloudId || pending) return;
    const field =
      transactionType === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId';
    const currentId = profile[field];
    const nextCategoryId =
      typeof currentId === 'string' && categoryIdentifiers.has(currentId) ? null : categoryCloudId;
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'profile',
        'user.defaultCategory',
        { ...profile, [field]: nextCategoryId ?? undefined },
        { transactionType, categoryId: nextCategoryId },
        { recordId: idOf(profile) },
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
    await mutate('category.rename', { name: trimmed }, { name: trimmed });
  }
  async function saveIcon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = icon.trim();
    if (trimmed.length > 32) {
      setFormError('Choose an icon no longer than 32 characters.');
      return;
    }
    await mutate('category.setIcon', { icon: trimmed || undefined }, { icon: trimmed || null });
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
    if (!categoryCloudId) {
      setFormError(
        'This category is awaiting sync. Archive becomes available once it has a cloud ID.',
      );
      return;
    }
    if (!window.confirm('Archive this category? Existing transactions remain unchanged.')) return;
    if (await mutate('category.archive', { archivedAt: Date.now() }, {})) router.push('/category');
  }

  if (!userId)
    return (
      <SignInGate eyebrow="CATEGORY DETAIL" title="Keep your categories close.">
        Sign in to view and update categories in this browser workspace.
      </SignInGate>
    );
  if (loading || profileLoading)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening category…
        </p>
      </div>
    );
  if (error || profileError)
    return (
      <div className="finance-page">
        <p className="finance-form-error" role="alert">
          Category data could not be opened: {error ?? profileError}
        </p>
      </div>
    );
  if (!category)
    return (
      <div className="finance-page">
        <Empty
          title="Category unavailable"
          description="This category is not in the current user's local records."
          action={
            <Link className="finance-inline-link" href="/category">
              Back to categories
            </Link>
          }
        />
      </div>
    );
  return (
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/category">
        <ArrowLeft size={15} /> Back to categories
      </Link>
      <PageHeading
        eyebrow="CATEGORY DETAIL"
        title={`${category.icon ? `${category.icon} ` : ''}${category.name ?? 'Category'}`}
        description={`${category.isSystem ? 'System category' : 'Personal category'}${category.archivedAt !== undefined ? ' · Archived' : ''}`}
      />
      {category.archivedAt === undefined && (
        <div
          className="finance-form-actions"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}
        >
          <Card className="finance-form-panel">
            <SectionHeader title="Rename category" />
            <form className="finance-form" onSubmit={saveName}>
              <FinanceInput
                label="Name"
                value={name}
                onChangeText={setName}
                maxLength={80}
                required
                disabled={category.isSystem}
              />
              {!category.isSystem && (
                <Button type="submit" disabled={pending || !name.trim() || !categoryCloudId}>
                  {pending ? 'Saving…' : 'Save name'} <ArrowRight size={15} />
                </Button>
              )}
            </form>
          </Card>
          <Card className="finance-form-panel">
            <SectionHeader title="Category icon" action={<Tags size={17} />} />
            <form className="finance-form" onSubmit={saveIcon}>
              <FinanceInput
                label="Text or emoji icon"
                value={icon}
                onChangeText={setIcon}
                maxLength={32}
                placeholder="Optional"
              />
              <Button type="submit" disabled={pending || !categoryCloudId}>
                {pending ? 'Saving…' : 'Save icon'}
              </Button>
            </form>
          </Card>
          <Card className="finance-form-panel">
            <SectionHeader title="Monthly limit" action={<span>{currency}</span>} />
            <p className="finance-muted">
              Posted expenses this month: {formatMinor(spent, currency)} · income:{' '}
              {formatMinor(income, currency)}
            </p>
            <form className="finance-form" onSubmit={saveLimit}>
              <FinanceInput
                label={`Limit (${currency})`}
                type="number"
                min="0.01"
                step={currency === 'JPY' || currency === 'KRW' ? '1' : '0.01'}
                value={limitInput}
                onChangeText={setLimitInput}
              />
              <Button type="submit" disabled={pending || !limitInput || !categoryCloudId}>
                {pending
                  ? 'Saving…'
                  : category.monthlyLimitMinor === undefined
                    ? 'Set limit'
                    : 'Update limit'}
              </Button>
            </form>
            {category.monthlyLimitMinor !== undefined && (
              <Button
                type="button"
                variant="outline"
                disabled={pending || !categoryCloudId}
                onPress={() => void clearLimit()}
              >
                Clear monthly limit
              </Button>
            )}
          </Card>
          <Card className="finance-form-panel">
            <SectionHeader title="Default category" />
            <p className="finance-muted">
              Choose this category automatically for new expenses or income.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Button
                type="button"
                variant={isDefaultExpense ? 'secondary' : 'outline'}
                disabled={pending || !categoryCloudId || !profile}
                onPress={() => void toggleDefault('expense')}
              >
                {isDefaultExpense ? 'Default for expenses' : 'Set as expense default'}
              </Button>
              <Button
                type="button"
                variant={isDefaultIncome ? 'secondary' : 'outline'}
                disabled={pending || !categoryCloudId || !profile}
                onPress={() => void toggleDefault('income')}
              >
                {isDefaultIncome ? 'Default for income' : 'Set as income default'}
              </Button>
            </div>
            {!categoryCloudId && (
              <p className="finance-form-note">
                This category must sync before it can be set as a default.
              </p>
            )}
          </Card>
        </div>
      )}
      {formError && (
        <p className="finance-form-error" role="alert">
          {formError}
        </p>
      )}
      {category.archivedAt === undefined ? (
        <Card className="finance-record-panel">
          <SectionHeader title="Archive category" />
          <p className="finance-muted">
            Archiving keeps this category and its history; it will no longer be available for new
            transactions.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !categoryCloudId}
            onPress={() => void archive()}
          >
            Archive category
          </Button>
          {!categoryCloudId && (
            <p className="finance-form-note">
              This category is waiting to sync before it can be updated.
            </p>
          )}
        </Card>
      ) : (
        <Card className="finance-record-panel">
          <p className="finance-muted">
            This category is archived and remains available to explain older transactions.
          </p>
        </Card>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Category activity"
          action={<span>{matching.length} saved records</span>}
        />
        {transactionLoading ? (
          <p className="finance-muted" role="status">
            Opening saved activity…
          </p>
        ) : transactionError ? (
          <p className="finance-form-error" role="alert">
            Activity could not be opened: {transactionError}
          </p>
        ) : matching.length === 0 ? (
          <Empty
            title="No saved activity"
            description="Transactions assigned to this category will appear here."
          />
        ) : (
          <ul className="finance-record-list">
            {matching.slice(0, 12).map((transaction) => (
              <li key={idOf(transaction)}>
                <span className="finance-record-copy">
                  <strong>{transaction.title ?? transaction.type ?? 'Transaction'}</strong>
                  <small>
                    {transaction.occurredAt
                      ? new Date(transaction.occurredAt).toLocaleDateString()
                      : 'Date unavailable'}{' '}
                    · {transaction.type ?? 'activity'}
                  </small>
                </span>
                <strong>
                  {formatMinor(asMinor(transaction.amountMinor), transaction.currency ?? currency)}
                </strong>
              </li>
            ))}
          </ul>
        )}
        <p className="finance-form-note">
          This history is limited to transactions currently cached in this browser.
        </p>
        {rangeError && (
          <p className="finance-muted" role="status">
            Range refresh unavailable: {rangeError}
          </p>
        )}
      </Card>
    </div>
  );
}
