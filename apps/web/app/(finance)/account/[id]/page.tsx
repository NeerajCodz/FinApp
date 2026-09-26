'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Landmark } from 'lucide-react';
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
  PageHeading,
  SignInGate,
  syncedId,
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
  isIncludedInTotal?: boolean;
};
type Transaction = LocalRecord & {
  accountId?: string;
  transferAccountId?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  title?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};

export default function PersonalAccountDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Account>('account');
  const { records: transactions } = useLocalRecords<Transaction>('transaction');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const account = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const [name, setName] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  React.useEffect(() => setName(account?.name ?? ''), [account?.name, routeId]);
  const ids = new Set(account ? aliasesOf(account) : []);
  const activity = transactions
    .filter(
      (item) =>
        item.status === 'posted' &&
        item.deletedAt === undefined &&
        (ids.has(String(item.accountId ?? '')) || ids.has(String(item.transferAccountId ?? ''))),
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const optimisticDelta = activity.reduce((delta, transaction) => {
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

  async function updateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !account || pending) return;
    const accountId = syncedId(account);
    const localId = idOf(account);
    if (!accountId) {
      setFormError(
        'This account is awaiting sync. Rename becomes available once it has a cloud ID.',
      );
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
    const accountId = syncedId(account);
    if (!accountId) {
      setFormError(
        'This account is awaiting sync. Archive becomes available once it has a cloud ID.',
      );
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
          recordId: idOf(account),
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      router.push('/account');
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
  if (loading)
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
              <dd>{account.isIncludedInTotal === false ? 'No' : 'Yes'}</dd>
            </div>
            <div>
              <dt className="finance-muted">Added</dt>
              <dd>
                {typeof account.createdAt === 'number'
                  ? new Date(account.createdAt).toLocaleDateString()
                  : 'Date unavailable'}
              </dd>
            </div>
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
            <Button type="submit" disabled={pending || !name.trim() || !syncedId(account)}>
              {pending ? 'Saving…' : 'Save name'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              Account type, currency, and recorded transactions are not editable.
            </p>
          </form>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !syncedId(account)}
            onPress={() => void archive()}
          >
            Archive account
          </Button>
          {!syncedId(account) && (
            <p className="finance-muted">
              Wait for this account to sync before renaming or archiving it.
            </p>
          )}
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
          title="Saved activity"
          action={<span>{activity.length} local records</span>}
        />
        {activity.length === 0 ? (
          <Empty
            title="No saved activity"
            description="Transactions linked to this account will appear here."
          />
        ) : (
          <ul className="finance-record-list">
            {activity.slice(0, 12).map((transaction) => (
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
          This list includes browser-cached records; older account history may not be downloaded
          yet.
        </p>
      </Card>
    </div>
  );
}
