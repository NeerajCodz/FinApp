'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, ReceiptText } from 'lucide-react';
import { Empty } from '@finapp/ui/web';
import {
  CategoryIcon,
  Money,
  SemanticMarker,
  SettingsRow,
  type SemanticType,
  type TransactionType,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  asMinor,
  belongsToUser,
  matchesId,
  minorToInput,
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
  if (!routeId)
    return (
      <div className="finance-page" style={{ display: 'grid', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/activity" aria-label="Go back">
            <ArrowLeft size={21} />
          </Link>
          <h1 style={{ margin: 0 }}>Transaction</h1>
        </div>
        <Empty
          title="Missing transaction ID"
          description="Open a transaction from Activity to view its details."
        />
      </div>
    );
  if (transactionLoading || accountLoading || categoryLoading || profileLoading)
    return (
      <div className="finance-page" style={{ display: 'grid', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/activity" aria-label="Go back">
            <ArrowLeft size={21} />
          </Link>
          <h1 style={{ margin: 0 }}>Transaction</h1>
        </div>
        <p className="finance-muted" role="status">
          Loading transaction…
        </p>
      </div>
    );
  if (transactionError || accountError || categoryError || profileError)
    return (
      <div className="finance-page" style={{ display: 'grid', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/activity" aria-label="Go back">
            <ArrowLeft size={21} />
          </Link>
          <h1 style={{ margin: 0 }}>Transaction</h1>
        </div>
        <p className="finance-form-error" role="alert">
          Transaction data could not be opened:{' '}
          {transactionError ?? accountError ?? categoryError ?? profileError}
        </p>
      </div>
    );
  if (!transaction || transaction.deletedAt !== undefined)
    return (
      <div className="finance-page" style={{ display: 'grid', gap: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link className="finance-secondary-action" href="/activity" aria-label="Go back">
            <ArrowLeft size={21} />
          </Link>
          <h1 style={{ margin: 0 }}>Transaction</h1>
        </div>
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
  const semanticType: SemanticType = transaction.groupId
    ? 'split'
    : transaction.type === 'income' ||
        transaction.type === 'expense' ||
        transaction.type === 'transfer' ||
        transaction.type === 'refund' ||
        transaction.type === 'settlement'
      ? transaction.type
      : 'expense';
  const amountType: TransactionType =
    transaction.type === 'income' ||
    transaction.type === 'expense' ||
    transaction.type === 'transfer' ||
    transaction.type === 'refund' ||
    transaction.type === 'adjustment'
      ? transaction.type
      : 'expense';
  return (
    <div className="finance-page" style={{ display: 'grid', gap: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link className="finance-secondary-action" href="/activity" aria-label="Go back">
          <ArrowLeft size={21} />
        </Link>
        <h1 style={{ margin: 0 }}>Transaction</h1>
      </div>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12, paddingBlock: 24 }}>
        <CategoryIcon
          label={category?.name ?? transaction.type ?? 'Transaction'}
          icon={category?.icon}
        />
        <Money
          amountMinor={asMinor(transaction.amountMinor)}
          currency={currency}
          type={amountType}
          size="display"
        />
        <h2 style={{ margin: 0, textAlign: 'center' }}>
          {transaction.title || 'Transaction'}
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <SemanticMarker type={semanticType} />
          {transaction.status && (
            <span className="finance-muted">{transaction.status.toUpperCase()}</span>
          )}
        </div>
      </div>
      <div>
        {transaction.merchant && (
          <>
            <SettingsRow label="Merchant" value={transaction.merchant} />
            <div style={{ borderTop: '1px solid var(--finance-line)' }} />
          </>
        )}
        <SettingsRow
          label="Category"
          leadingIcon={
            <CategoryIcon label={category?.name ?? 'Uncategorized'} icon={category?.icon} />
          }
          value={category?.name ?? 'Uncategorized'}
        />
        <div style={{ borderTop: '1px solid var(--finance-line)' }} />
        <SettingsRow label="Account" value={account?.name ?? 'Unassigned account'} />
        {transaction.type === 'transfer' && (
          <>
            <div style={{ borderTop: '1px solid var(--finance-line)' }} />
            <SettingsRow label="Destination" value={destination?.name ?? 'Unassigned account'} />
          </>
        )}
        <div style={{ borderTop: '1px solid var(--finance-line)' }} />
        <SettingsRow
          label="Date"
          value={
            transaction.occurredAt
              ? new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                  timeZone,
                }).format(transaction.occurredAt)
              : 'Date unavailable'
          }
        />
        <div style={{ borderTop: '1px solid var(--finance-line)' }} />
        <SettingsRow label="Note" value={transaction.note?.trim() || 'None'} />
      </div>
      {duplicable && (
        <Link
          className="finance-secondary-action"
          href={duplicateHref}
          style={{ justifyContent: 'space-between', minHeight: 56 }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ReceiptText size={19} /> Duplicate transaction
          </span>
          <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}
