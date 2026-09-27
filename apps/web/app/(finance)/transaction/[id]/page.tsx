'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Copy, ReceiptText } from 'lucide-react';
import { Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  asMinor,
  belongsToUser,
  matchesId,
  minorToInput,
  PageHeading,
  SignInGate,
} from '../../_personal';

type Transaction = LocalRecord & {
  title?: string;
  note?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  transferAccountId?: string;
  groupId?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
  merchant?: string;
};
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & { timezone?: string };

export default function PersonalTransactionDetailPage() {
  const params = useParams<{ id: string }>();
  const { userId } = useBrowserSync();
  const {
    records: transactionRecords,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const {
    records: accountRecords,
    loading: accountLoading,
    error: accountError,
  } = useLocalRecords<Account>('account');
  const {
    records: categoryRecords,
    loading: categoryLoading,
    error: categoryError,
  } = useLocalRecords<Category>('category');
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transaction = transactionRecords.find(
    (item) => userId && belongsToUser(item, userId) && matchesId(item, routeId),
  );
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId));
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId));
  const profile = profiles[0];
  const timeZone = typeof profile?.timezone === 'string' ? profile.timezone : 'UTC';
  function findAlias<T extends LocalRecord>(records: T[], id: string | undefined): T | undefined {
    return records.find((record) => typeof id === 'string' && aliasesOf(record).includes(id));
  }
  const account = findAlias(accounts, transaction?.accountId);
  const category = findAlias(categories, transaction?.categoryId);
  const destination = findAlias(accounts, transaction?.transferAccountId);
  const type = transaction?.type;
  const duplicable =
    !!transaction &&
    (type === 'expense' || type === 'income' || type === 'transfer') &&
    asMinor(transaction.amountMinor) > 0n &&
    !!account &&
    account.archivedAt === undefined &&
    account.currency === transaction.currency &&
    (type === 'transfer'
      ? !!destination && destination.archivedAt === undefined
      : !!category && category.archivedAt === undefined);
  let duplicateHref = '';
  if (transaction && duplicable) {
    const query = new URLSearchParams({
      type: transaction.type!,
      amount: minorToInput(transaction.amountMinor, transaction.currency ?? 'INR'),
      accountId: transaction.accountId ?? '',
      occurredAt: String(transaction.occurredAt ?? Date.now()),
      note: transaction.note ?? '',
    });
    if (transaction.categoryId) query.set('categoryId', transaction.categoryId);
    if (transaction.transferAccountId) query.set('destinationId', transaction.transferAccountId);
    duplicateHref = `/transaction/new?${query.toString()}`;
  }
  if (!userId)
    return (
      <SignInGate eyebrow="TRANSACTION DETAIL" title="Your ledger stays private.">
        Sign in to review a transaction from this browser’s local finance data.
      </SignInGate>
    );
  if (transactionLoading || accountLoading || categoryLoading || profileLoading)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening transaction…
        </p>
      </div>
    );
  if (transactionError || accountError || categoryError || profileError)
    return (
      <div className="finance-page">
        <p className="finance-form-error" role="alert">
          Transaction data could not be opened:{' '}
          {transactionError ?? accountError ?? categoryError ?? profileError}
        </p>
      </div>
    );
  if (!transaction || transaction.deletedAt !== undefined)
    return (
      <div className="finance-page">
        <Empty
          title="Transaction unavailable"
          description="This transaction was removed or is no longer saved on this device."
          action={
            <Link className="finance-inline-link" href="/activity">
              Back to activity
            </Link>
          }
        />
      </div>
    );
  const currency = transaction.currency ?? 'INR';
  const isIncome = transaction.type === 'income' || transaction.type === 'refund';
  return (
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/activity">
        <ArrowLeft size={15} /> Back to activity
      </Link>
      <PageHeading
        eyebrow="TRANSACTION DETAIL"
        title={transaction.title || 'Transaction'}
        description={`${transaction.groupId ? 'Split · ' : ''}${transaction.type ?? 'Activity'} · ${transaction.occurredAt ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(transaction.occurredAt) : 'Date unavailable'}${transaction.status ? ` · ${transaction.status.toUpperCase()}` : ''}`}
      />
      <Card className="finance-metric-card finance-balance-card">
        <span className="finance-metric-label">
          {currency} · {transaction.type ?? 'TRANSACTION'}
        </span>
        <strong>
          {isIncome ? '+' : transaction.type === 'transfer' ? '↔ ' : '−'}
          {formatMinor(asMinor(transaction.amountMinor), currency)}
        </strong>
        <span className="finance-metric-foot">
          {transaction.clientUpdatedAt
            ? 'Stored in this browser; sync status may change'
            : 'Saved transaction record'}
        </span>
      </Card>
      <Card className="finance-record-panel">
        <SectionHeader title="Transaction details" action={<ReceiptText size={17} />} />
        <dl
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 14,
            margin: 0,
          }}
        >
          <div>
            <dt className="finance-muted">Account</dt>
            <dd>{account?.name ?? 'Unassigned account'}</dd>
          </div>
          <div>
            <dt className="finance-muted">Category</dt>
            <dd>
              {category?.icon && (
                <span aria-hidden="true" style={{ marginRight: 8 }}>
                  {category.icon}
                </span>
              )}
              {category?.name ??
                (transaction.categoryId ? 'Unavailable in local category data' : 'Uncategorized')}
            </dd>
          </div>
          {transaction.type === 'transfer' && (
            <div>
              <dt className="finance-muted">Destination</dt>
              <dd>{destination?.name ?? 'Unassigned account'}</dd>
            </div>
          )}
          <div>
            <dt className="finance-muted">Currency</dt>
            <dd>{currency}</dd>
          </div>
          {transaction.merchant && (
            <div>
              <dt className="finance-muted">Merchant</dt>
              <dd>{transaction.merchant}</dd>
            </div>
          )}
          <div>
            <dt className="finance-muted">Note</dt>
            <dd>{transaction.note?.trim() || 'None'}</dd>
          </div>
        </dl>
      </Card>
      {duplicable ? (
        <Card className="finance-form-panel">
          <SectionHeader title="Create a copy" action={<Copy size={17} />} />
          <p className="finance-muted">
            A duplicate opens a new transaction form with the original values. It will not change
            this saved record.
          </p>
          <Link className="finance-primary-link" href={duplicateHref}>
            Duplicate transaction <Copy size={15} />
          </Link>
        </Card>
      ) : (
        <Card className="finance-record-panel">
          <p className="finance-muted">
            This transaction cannot be duplicated because its type or linked account/category is
            unavailable or archived.
          </p>
        </Card>
      )}
      <p className="finance-form-note">
        Transaction details are read-only. There are no edit or delete actions.
      </p>
    </div>
  );
}
