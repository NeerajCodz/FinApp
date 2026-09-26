'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import { Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  asMinor,
  belongsToUser,
  idOf,
  matchesId,
  PageHeading,
  SignInGate,
  syncedId,
} from '../../_personal';

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
  status?: string;
  deletedAt?: number;
  title?: string;
};
type Account = LocalRecord & { name?: string };
type Category = LocalRecord & { name?: string };

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
    (item) => userId && belongsToUser(item, userId) && matchesId(item, routeId),
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
  const progress = limit > 0n ? Math.min(100, Number((spent * 100n) / limit)) : 0;

  async function archive() {
    if (!userId || !budget || pending) return;
    const budgetId = syncedId(budget);
    if (!budgetId) {
      setFormError(
        'This budget is awaiting sync. Archive becomes available once it has a cloud ID.',
      );
      return;
    }
    if (!window.confirm('Archive this budget? Its saved history will remain available.')) return;
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
          recordId: idOf(budget),
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
          description="This budget is not in the current user's local records."
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
      ? (category?.name ?? 'Category')
      : budget.period === 'account'
        ? (account?.name ?? 'Account')
        : budget.period === 'custom'
          ? 'Custom dates'
          : 'Monthly';
  return (
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/budget">
        <ArrowLeft size={15} /> Back to budgets
      </Link>
      <PageHeading
        eyebrow="BUDGET DETAIL"
        title={budget.name ?? 'Budget'}
        description={`${scope} · ${currency}${budget.archivedAt !== undefined ? ' · Archived' : ''}`}
      />
      <Card className="finance-metric-card finance-balance-card">
        <span className="finance-metric-label">POSTED EXPENSES · {currency}</span>
        <strong>{formatMinor(spent, currency)}</strong>
        <span className="finance-metric-foot">
          of {formatMinor(limit, currency)} · {progress}% used
        </span>
        <div className="finance-plan-track">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="finance-muted">
          {remaining >= 0n
            ? `${formatMinor(remaining, currency)} remaining`
            : `${formatMinor(-remaining, currency)} over limit`}
        </p>
        <p className="finance-plan-dates">
          {new Date(startAt).toLocaleDateString()} – {new Date(endAt).toLocaleDateString()}
        </p>
      </Card>
      <Card className="finance-record-panel">
        <SectionHeader title="Scope and dates" action={<CalendarDays size={17} />} />
        <ul className="finance-record-list">
          <li>
            <span className="finance-record-copy">
              <strong>Scope</strong>
              <small>{scope}</small>
            </span>
            <span>{budget.period ?? 'monthly'}</span>
          </li>
          <li>
            <span className="finance-record-copy">
              <strong>Date range</strong>
              <small>
                {new Date(startAt).toLocaleDateString()} through{' '}
                {new Date(endAt).toLocaleDateString()}
              </small>
            </span>
          </li>
          <li>
            <span className="finance-record-copy">
              <strong>Limit</strong>
              <small>{currency}</small>
            </span>
            <strong>{formatMinor(limit, currency)}</strong>
          </li>
        </ul>
      </Card>
      {budget.archivedAt === undefined ? (
        <Card className="finance-record-panel">
          <SectionHeader title="Archive budget" />
          <p className="finance-muted">
            Archiving removes this budget from active tracking without deleting its record.
          </p>
          {formError && (
            <p className="finance-form-error" role="alert">
              {formError}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={pending || !syncedId(budget)}
            onPress={() => void archive()}
          >
            {pending ? 'Archiving…' : 'Archive budget'} <ArrowRight size={15} />
          </Button>
          {!syncedId(budget) && (
            <p className="finance-form-note">
              This budget is waiting to sync before it can be archived.
            </p>
          )}
        </Card>
      ) : (
        <Card className="finance-record-panel">
          <p className="finance-muted">
            This budget is archived and will not be changed by new transactions.
          </p>
        </Card>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Matching expenses"
          action={<span>{matching.length} local records</span>}
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
            title="No matching expenses"
            description="Posted expenses in this scope and date range appear here."
          />
        ) : (
          <ul className="finance-record-list">
            {matching.slice(0, 12).map((item) => (
              <li key={idOf(item)}>
                <span className="finance-record-copy">
                  <strong>{item.title ?? 'Expense'}</strong>
                  <small>
                    {item.occurredAt
                      ? new Date(item.occurredAt).toLocaleDateString()
                      : 'Date unavailable'}
                  </small>
                </span>
                <strong>{formatMinor(asMinor(item.amountMinor), item.currency ?? currency)}</strong>
              </li>
            ))}
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
    </div>
  );
}
