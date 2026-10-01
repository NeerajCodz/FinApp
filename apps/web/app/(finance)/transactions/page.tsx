'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@finapp/ui/web';
import { ActivityTransactionList } from '@finapp/ui/activity';
import { formatTransactionDate, type TransactionType } from '@finapp/ui/finance';
import { formatMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, SignInGate } from '../_personal';

type Transaction = LocalRecord & {
  title?: string;
  merchant?: string;
  note?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
  groupId?: string;
};
type Entity = LocalRecord & { name?: string; icon?: string; currency?: string };
type Profile = LocalRecord & { timezone?: string; defaultCurrency?: string };
const validTypes: Record<TransactionType, true> = {
  expense: true,
  income: true,
  transfer: true,
  refund: true,
  adjustment: true,
};

export default function TransactionsPage() {
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<Entity>('account');
  const categoryState = useLocalRecords<Entity>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [rangeError, setRangeError] = React.useState('');
  const [month, setMonth] = React.useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, monthNumber] = month.split('-').map(Number);
  const startAt = new Date(year!, monthNumber! - 1, 1).getTime();
  const endAt = new Date(year!, monthNumber!, 1).getTime();

  React.useEffect(() => {
    if (!userId) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(startAt, endAt).catch((cause: unknown) => {
      if (active)
        setRangeError(
          !isConnected
            ? 'Offline: showing transactions already saved in this browser.'
            : cause instanceof Error
              ? cause.message
              : 'Could not refresh this date range.',
        );
    });
    return () => {
      active = false;
    };
  }, [endAt, fetchTransactionRange, isConnected, startAt, userId]);

  const accounts = accountState.records.filter((record) => userId && belongsToUser(record, userId));
  const categories = categoryState.records.filter(
    (record) => userId && belongsToUser(record, userId),
  );
  const transactions = transactionState.records
    .filter(
      (record) =>
        userId &&
        belongsToUser(record, userId) &&
        record.deletedAt === undefined &&
        record.status !== 'voided' &&
        Number.isFinite(Number(record.occurredAt)) &&
        Number(record.occurredAt) >= startAt &&
        Number(record.occurredAt) < endAt,
    )
    .sort((left, right) => Number(right.occurredAt) - Number(left.occurredAt));
  const profile = profileState.records[0];
  const items = transactions.flatMap((record) => {
    const id = idOf(record);
    const type = validTypes[record.type as TransactionType]
      ? (record.type as TransactionType)
      : null;
    if (!id || !type) return [];
    const account = accounts.find(
      (candidate) =>
        typeof record.accountId === 'string' && aliasesOf(candidate).includes(record.accountId),
    );
    const category = categories.find(
      (candidate) =>
        typeof record.categoryId === 'string' && aliasesOf(candidate).includes(record.categoryId),
    );
    const currency = String(
      record.currency ?? account?.currency ?? profile?.defaultCurrency ?? 'INR',
    );
    const searchText = [
      record.title,
      record.merchant,
      record.note,
      account?.name,
      category?.name,
      formatMinor(asMinor(record.amountMinor), currency),
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    if (query.trim() && !searchText.includes(query.trim().toLocaleLowerCase())) return [];
    if (typeFilter !== 'all' && type !== typeFilter) return [];
    return [
      {
        id,
        title: String(record.title ?? record.merchant ?? 'Transaction'),
        category: String(
          category?.name ??
            (record.groupId ? 'Split expense' : type === 'transfer' ? 'Transfer' : 'Uncategorized'),
        ),
        categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined,
        account: account?.name,
        merchant: typeof record.merchant === 'string' ? record.merchant : undefined,
        date: formatTransactionDate(Number(record.occurredAt), record.hasTime, profile?.timezone),
        amountMinor: asMinor(record.amountMinor),
        currency,
        type,
      },
    ];
  });
  const currency = String(profile?.defaultCurrency ?? transactions[0]?.currency ?? 'INR');
  const totalExpense = transactions.reduce(
    (sum, record) =>
      record.type === 'expense' &&
      record.status === 'posted' &&
      String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency
        ? sum + asMinor(record.amountMinor)
        : sum,
    0n,
  );
  const totalIncome = transactions.reduce(
    (sum, record) =>
      record.type === 'income' &&
      record.status === 'posted' &&
      String(record.currency ?? profile?.defaultCurrency ?? 'INR') === currency
        ? sum + asMinor(record.amountMinor)
        : sum,
    0n,
  );
  const loading =
    transactionState.loading ||
    accountState.loading ||
    categoryState.loading ||
    profileState.loading;
  const error =
    transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  if (!userId)
    return (
      <SignInGate eyebrow="TRANSACTIONS" title="Your ledger stays private.">
        Sign in to view personal transactions saved in your finance data.
      </SignInGate>
    );

  return (
    <main className="finance-page" style={{ display: 'grid', gap: 24 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Transactions</h1>
          <p className="finance-muted" style={{ margin: '6px 0 0' }}>
            {new Date(year!, monthNumber! - 1, 1).toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}{' '}
            activity.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            aria-label="Transaction month"
            type="month"
            value={month}
            onChange={(event) => {
              if (/^\d{4}-\d{2}$/.test(event.currentTarget.value))
                setMonth(event.currentTarget.value);
            }}
            className="finance-form-input"
          />
          <Input
            accessibilityLabel="Search transactions"
            placeholder="Search transactions…"
            value={query}
            onChangeText={setQuery}
          />
          <select
            aria-label="Filter transactions by type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="finance-form-input"
          >
            <option value="all">All types</option>
            <option value="expense">Expenses</option>
            <option value="income">Income</option>
            <option value="transfer">Transfers</option>
            <option value="refund">Refunds</option>
            <option value="adjustment">Adjustments</option>
          </select>
          <Button onPress={() => router.push('/transaction/new')}>New transaction</Button>
        </div>
      </header>
      <section
        aria-label="Transaction totals"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {[
          ['Expenses', formatMinor(totalExpense, currency)],
          ['Income', formatMinor(totalIncome, currency)],
          ['Transactions', String(transactions.length)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              border: '1px solid var(--finance-line)',
              background: 'var(--finapp-surface-raised)',
              borderRadius: 16,
              padding: 18,
            }}
          >
            <div className="finance-muted">{label}</div>
            <strong
              style={{
                display: 'block',
                marginTop: 8,
                fontSize: 22,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {value}
            </strong>
          </div>
        ))}
      </section>
      {error && (
        <p className="finance-form-error" role="alert">
          Transaction data could not be opened: {error}
        </p>
      )}
      {rangeError && (
        <p className="finance-muted" role="status">
          {rangeError}
        </p>
      )}
      <ActivityTransactionList
        items={items}
        loading={loading}
        query={query || (typeFilter !== 'all' ? typeFilter : '')}
        onSelect={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onPress={() => router.push('/transaction/new')}>Add transaction</Button>
      </div>
    </main>
  );
}
