'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Landmark, ReceiptText } from 'lucide-react';
import { Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import {
  aliasesOf,
  asMinor,
  belongsToUser,
  idOf,
  matchesId,
  localDependency,
  PageHeading,
  SignInGate,
} from '../../_personal';

type Account = LocalRecord & {
  name?: string;
  type?: string;
  customType?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  icon?: string;
  color?: string;
  isIncludedInTotal?: boolean;
};
type Category = LocalRecord & { name?: string; icon?: string };
type Transaction = LocalRecord & {
  accountId?: string;
  transferAccountId?: string;
  categoryId?: string;
  groupId?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  title?: string;
  note?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};

export default function PersonalAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const timelineRange = React.useMemo(() => {
    const endAt = Date.now() + 1;
    return { startAt: endAt - 30 * 86_400_000, endAt };
  }, []);
  const { records, loading, error } = useLocalRecords<Account>('account');
  const {
    records: transactions,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const { records: categories } = useLocalRecords<Category>('category');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const account = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const [name, setName] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [rangeError, setRangeError] = React.useState('');
  React.useEffect(() => setName(account?.name ?? ''), [account?.name, routeId]);
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(timelineRange.startAt, timelineRange.endAt).catch(
      (cause: unknown) => {
        if (active)
          setRangeError(
            cause instanceof Error ? cause.message : 'Could not refresh recent activity.',
          );
      },
    );
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, timelineRange, userId]);
  const ids = new Set(account ? aliasesOf(account) : []);
  const matchingActivity = transactions
    .filter(
      (item) =>
        item.status === 'posted' &&
        item.deletedAt === undefined &&
        (ids.has(String(item.accountId ?? '')) || ids.has(String(item.transferAccountId ?? ''))),
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const activity = matchingActivity
    .filter((item) => {
      const occurredAt = Number(item.occurredAt ?? 0);
      return occurredAt >= timelineRange.startAt && occurredAt < timelineRange.endAt;
    })
    .slice(0, 50);
  const optimisticDelta = matchingActivity.reduce((delta, transaction) => {
    if (typeof transaction.clientUpdatedAt !== 'number') return delta;
    const amount = asMinor(transaction.amountMinor);
    const source = ids.has(String(transaction.accountId ?? ''))
      ? transaction.type === 'expense' || transaction.type === 'transfer'
        ? -amount
        : amount
      : 0n;
    const destination =
      transaction.type === 'transfer' && ids.has(String(transaction.transferAccountId ?? ''))
        ? amount
        : 0n;
    return delta + source + destination;
  }, 0n);
  const localId = account ? idOf(account) : '';
  const accountId = account ? String(account._id ?? account.cloudId ?? account.id ?? '') : '';
  const accountDependency = account ? localDependency('account', account) : null;

  async function updateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !account || pending) return;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot be renamed.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter an account name.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.rename',
        { ...account, name: trimmed },
        { accountId, name: trimmed },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not rename this account.');
    } finally {
      setPending(false);
    }
  }

  async function archive() {
    if (!userId || !account || pending) return;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot be archived.');
      return;
    }
    if (!window.confirm('Archive this account? It will remain in your archived account list.'))
      return;
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.archive',
        { ...account, archivedAt: Date.now() },
        { accountId },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      router.replace('/account');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not archive this account.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="ACCOUNT DETAIL" title="Your account stays private.">
        Sign in to open account details in this browser workspace.
      </SignInGate>
    );
  if (loading || transactionLoading)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening account…
        </p>
      </div>
    );
  if (error)
    return (
      <div className="finance-page">
        <p className="finance-form-error" role="alert">
          Account data could not be opened: {error}
        </p>
      </div>
    );
  if (!account)
    return (
      <div className="finance-page">
        <Empty
          title="Account unavailable"
          description="This account is not in the current user's local records."
          action={
            <Link className="finance-inline-link" href="/account">
              Back to accounts
            </Link>
          }
        />
      </div>
    );
  const currency = account.currency ?? 'INR';
  const balance = asMinor(account.balanceMinor ?? account.openingBalanceMinor) + optimisticDelta;
  return (
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/account">
        <ArrowLeft size={15} /> Back to accounts
      </Link>
      <PageHeading
        eyebrow="ACCOUNT DETAIL"
        title={account.name ?? 'Account'}
        description={`${(account.customType ?? account.type ?? 'Account').replace(/^./, (value) => value.toUpperCase())} · ${currency}${account.archivedAt !== undefined ? ' · Archived' : ''}`}
      />
      <div className="finance-dashboard-grid">
        <Card className="finance-metric-card finance-balance-card">
          <span className="finance-metric-label">CURRENT BALANCE · {currency}</span>
          <strong>{formatMinor(balance, currency)}</strong>
          <span className="finance-metric-foot">Opening balance plus locally saved activity</span>
        </Card>
        <Card className="finance-form-panel">
          <SectionHeader title="Account details" action={<Landmark size={17} />} />
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 14,
              margin: 0,
            }}
          >
            <div>
              <dt className="finance-muted">Currency</dt>
              <dd>{currency}</dd>
            </div>
            <div>
              <dt className="finance-muted">Included in total</dt>
              <dd>{account.isIncludedInTotal === true ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="finance-muted">Added</dt>
              <dd>
                {typeof account.createdAt === 'number'
                  ? new Date(account.createdAt).toLocaleDateString()
                  : 'Date unavailable'}
              </dd>
            </div>
            {account.type === 'other' && account.customType && (
              <div>
                <dt className="finance-muted">Custom type</dt>
                <dd>{account.customType}</dd>
              </div>
            )}
            {account.icon && (
              <div>
                <dt className="finance-muted">Icon</dt>
                <dd>{account.icon}</dd>
              </div>
            )}
            {account.color && (
              <div>
                <dt className="finance-muted">Color</dt>
                <dd>{account.color}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>
      {account.archivedAt === undefined ? (
        <Card className="finance-form-panel">
          <SectionHeader title="Manage account" />
          <form className="finance-form" onSubmit={updateName}>
            <FinanceInput
              label="Account name"
              value={name}
              onChangeText={setName}
              maxLength={80}
              required
            />
            {formError && (
              <p className="finance-form-error" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? 'Saving…' : 'Save name'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              Account type, currency, and recorded transactions are not editable.
            </p>
          </form>
          <Button type="button" variant="outline" disabled={pending} onPress={() => void archive()}>
            Archive account
          </Button>
        </Card>
      ) : (
        <Card className="finance-record-panel">
          <p className="finance-muted">
            Archived accounts remain available for reference and cannot receive new transactions.
          </p>
        </Card>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Recent activity"
          action={<span>{activity.length} in the last 30 days</span>}
        />
        {transactionError && (
          <p className="finance-form-error" role="alert">
            Saved activity could not be refreshed: {transactionError}
          </p>
        )}
        {rangeError && (
          <p className="finance-muted" role="status">
            Recent activity refresh unavailable. Showing records already saved in this browser.
          </p>
        )}
        {activity.length === 0 ? (
          <Empty
            title={transactionLoading ? 'Loading recent activity' : 'No posted activity yet'}
            description={
              transactionLoading
                ? 'Opening transactions saved to this browser.'
                : 'Record a transaction to see it here.'
            }
            icon={<ReceiptText size={20} />}
            action={
              !transactionLoading ? (
                <Link
                  className="finance-inline-link"
                  href={`/transaction/new?accountId=${encodeURIComponent(routeId ?? '')}`}
                >
                  Add transaction
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="finance-record-list">
            {activity.map((transaction) => {
              const isTransfer = transaction.type === 'transfer';
              const isOutgoing = ids.has(String(transaction.accountId ?? ''));
              const category = categories.find((item) =>
                aliasesOf(item).includes(String(transaction.categoryId ?? '')),
              );
              const title = isTransfer
                ? `${isOutgoing ? 'Transfer out' : 'Transfer in'} · ${transaction.title ?? 'Transfer'}`
                : (transaction.title ?? transaction.type ?? 'Transaction');
              const amountPrefix = isTransfer
                ? isOutgoing
                  ? '−'
                  : '+'
                : transaction.type === 'income' || transaction.type === 'refund'
                  ? '+'
                  : '−';
              return (
                <li key={idOf(transaction)}>
                  <span className="finance-record-symbol">
                    {category?.icon || (category?.name ?? title).slice(0, 1)}
                  </span>
                  <Link
                    className="finance-record-copy"
                    href={`/transaction/${encodeURIComponent(idOf(transaction))}`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    <strong>{title}</strong>
                    <small>
                      {transaction.occurredAt
                        ? new Date(transaction.occurredAt).toLocaleDateString()
                        : 'Date unavailable'}{' '}
                      · {transaction.groupId ? 'Split' : (transaction.type ?? 'Activity')}
                      {category?.name ? ` · ${category.name}` : ''}
                    </small>
                  </Link>
                  <strong className="finance-record-amount">
                    {amountPrefix}
                    {formatMinor(
                      asMinor(transaction.amountMinor),
                      transaction.currency ?? currency,
                    )}
                  </strong>
                </li>
              );
            })}
          </ul>
        )}
        {activity.length === 50 && (
          <p className="finance-form-note">Showing the 50 most recent posted transactions.</p>
        )}
        <p className="finance-form-note">
          Recent activity covers the last 30 days. Saved transactions remain available in the
          browser when offline.
        </p>
      </Card>
    </div>
  );
}
