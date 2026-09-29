'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { CategoryIcon, Money, TransactionRow, formatTransactionDate } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { asMinor, belongsToUser, idOf, matchesId, SignInGate } from '../../_personal';

type Budget = LocalRecord & {
  name?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  period?: string;
  categoryId?: string;
  accountId?: string;
  startAt?: number;
  endAt?: number;
  archivedAt?: number;
  updatedAt?: number;
};
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  accountId?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
  title?: string;
  merchant?: string;
};
type Account = LocalRecord & { name?: string };
type Category = LocalRecord & { name?: string; icon?: string };

export default function PersonalBudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, fetchTransactionRange, isConnected } = useBrowserSync();
  const { records: budgets, loading, error } = useLocalRecords<Budget>('budget');
  const {
    records: transactions,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: categories } = useLocalRecords<Category>('category');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const budget = budgets.find(
    (item) =>
      userId &&
      belongsToUser(item, userId) &&
      matchesId(item, routeId) &&
      item.archivedAt === undefined,
  );
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [rangeError, setRangeError] = React.useState('');
  const startAt = Number(budget?.startAt ?? 0);
  const endAt = Number(budget?.endAt ?? 1);
  React.useEffect(() => {
    if (
      !userId ||
      !budget ||
      !isConnected ||
      !Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      endAt <= startAt
    )
      return;
    let live = true;
    setRangeError('');
    void fetchTransactionRange(startAt, endAt).catch((cause: unknown) => {
      if (live)
        setRangeError(
          cause instanceof Error ? cause.message : 'Could not refresh this budget range.',
        );
    });
    return () => {
      live = false;
    };
  }, [budget?.id, budget?._id, endAt, fetchTransactionRange, isConnected, startAt, userId]);
  const aliases = (record: LocalRecord | undefined) =>
    new Set(
      [record?.id, record?._id, record?.cloudId].filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      ),
    );
  const category = categories.find((item) => aliases(item).has(String(budget?.categoryId ?? '')));
  const account = accounts.find((item) => aliases(item).has(String(budget?.accountId ?? '')));
  const categoryAliases = aliases(category);
  const accountAliases = aliases(account);
  const currency = budget?.currency ?? 'INR';
  const matching = transactions
    .filter((item) => {
      if (
        item.type !== 'expense' ||
        item.status !== 'posted' ||
        item.deletedAt !== undefined ||
        Number(item.occurredAt ?? 0) < startAt ||
        Number(item.occurredAt ?? 0) >= endAt ||
        item.currency !== currency
      )
        return false;
      if (
        budget?.period === 'category' &&
        item.categoryId !== budget.categoryId &&
        !categoryAliases.has(String(item.categoryId ?? ''))
      )
        return false;
      if (
        budget?.period === 'account' &&
        item.accountId !== budget.accountId &&
        !accountAliases.has(String(item.accountId ?? ''))
      )
        return false;
      return true;
    })
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const spent = matching.reduce((sum, item) => sum + asMinor(item.amountMinor), 0n);
  const limit = asMinor(budget?.amountMinor);
  const remaining = limit - spent;
  const progress = limit > 0n ? Math.min(100, Number((spent * 10_000n) / limit) / 100) : 0;

  async function archive() {
    if (!userId || !budget || pending) return;
    const budgetId = String(budget._id ?? budget.cloudId ?? budget.id ?? '');
    if (!budgetId) {
      setFormError('This budget has no saved identifier and cannot be archived.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'budget',
        'budget.archive',
        { ...budget, archivedAt: Date.now() },
        { budgetId },
        {
          recordId: String(budget.id ?? budget._id ?? budget.cloudId ?? ''),
          dependencies: budget.cloudId || budget._id ? [] : [`budget:${budgetId}`],
          baseUpdatedAt: typeof budget.updatedAt === 'number' ? budget.updatedAt : undefined,
        },
      );
      router.push('/budget');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not archive this budget.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="BUDGET DETAIL" title="Your budget stays private.">
        Sign in to review the selected budget and its local activity.
      </SignInGate>
    );
  if (loading)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening budget…
        </p>
      </div>
    );
  if (error)
    return (
      <div className="finance-page">
        <p className="finance-form-error" role="alert">
          Budget data could not be opened: {error}
        </p>
      </div>
    );
  if (!budget)
    return (
      <div className="finance-page">
        <Empty
          title="Budget unavailable"
          description="It may have been archived or removed. Your other budgets are still available."
          action={
            <Link className="finance-inline-link" href="/budget">
              Back to budgets
            </Link>
          }
        />
      </div>
    );
  const scope =
    budget.period === 'category'
      ? (category?.name ?? 'Category budget')
      : budget.period === 'account'
        ? (account?.name ?? 'Account budget')
        : budget.period === 'custom'
          ? 'Custom period'
          : 'Monthly';
  const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const dateRange = `${new Date(startAt).toLocaleDateString(undefined, dateOptions)} – ${new Date(
    endAt,
  ).toLocaleDateString(undefined, dateOptions)}`;
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <Link className="finance-secondary-action" href="/budget" aria-label="Go back">
          <ArrowLeft size={18} />
        </Link>
        <div style={{ minWidth: 0 }}>
          <h1>{budget.name ?? 'Budget'}</h1>
          <p className="finance-muted">
            {scope} · {dateRange}
          </p>
        </div>
      </header>
      <Card className="finance-metric-card finance-balance-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {category && <CategoryIcon label={category.name ?? 'Category'} icon={category.icon} />}
          <span style={{ display: 'grid', flex: 1, gap: 3 }}>
            <strong>Budget progress</strong>
            <small>{Math.round(progress)}% used</small>
          </span>
          <small>{currency}</small>
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <span className="finance-metric-foot">Spent this period</span>
          <Money amountMinor={spent} currency={currency} size="display" />
          <span className="finance-metric-foot">
            of <Money amountMinor={limit} currency={currency} />
          </span>
        </div>
        <div
          className="finance-plan-track"
          role="progressbar"
          aria-label="Budget usage"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            <small className="finance-metric-label">Limit</small>
            <br />
            <Money amountMinor={limit} currency={currency} />
          </span>
          <span style={{ textAlign: 'right' }}>
            <small className="finance-metric-label">
              {remaining < 0n ? 'Over limit' : 'Still available'}
            </small>
            <br />
            <Money amountMinor={remaining < 0n ? -remaining : remaining} currency={currency} />
          </span>
        </div>
      </Card>
      <Card className="finance-record-panel">
        <SectionHeader
          title="Recent expenses"
          action={<span>Posted transactions counted toward this budget</span>}
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
            title="No expenses counted yet"
            description="Matching posted expenses will appear here."
          />
        ) : (
          <ul className="finance-record-list">
            {matching.slice(0, 5).map((item) => {
              const transactionId = idOf(item);
              const expenseCategory = categories.find((entry) =>
                aliases(entry).has(String(item.categoryId ?? '')),
              );
              const expenseAccount = accounts.find((entry) =>
                aliases(entry).has(String(item.accountId ?? '')),
              );
              return (
                <li key={transactionId}>
                  <TransactionRow
                    title={item.title ?? item.merchant ?? 'Expense'}
                    merchant={item.merchant}
                    category={expenseCategory?.name ?? 'Expense'}
                    account={expenseAccount?.name}
                    amountMinor={asMinor(item.amountMinor)}
                    currency={item.currency ?? currency}
                    type="expense"
                    date={
                      item.occurredAt
                        ? formatTransactionDate(
                            item.occurredAt,
                            typeof item.hasTime === 'boolean' ? item.hasTime : undefined,
                          )
                        : 'Date unavailable'
                    }
                    onPress={() => router.push(`/transaction/${encodeURIComponent(transactionId)}`)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <p className="finance-form-note">
          Totals use locally cached transactions. A previously uncached period may be incomplete.
        </p>
        {rangeError && (
          <p className="finance-muted" role="status">
            Range refresh unavailable: {rangeError}
          </p>
        )}
      </Card>
      {formError && (
        <p className="finance-form-error" role="alert">
          {formError}
        </p>
      )}
      <Button type="button" variant="outline" disabled={pending} onPress={() => void archive()}>
        {pending ? 'Archiving…' : 'Archive budget'}
      </Button>
    </div>
  );
}
