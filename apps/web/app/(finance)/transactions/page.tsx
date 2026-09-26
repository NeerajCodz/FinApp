'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, Repeat2 } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { transactionHistoryRange } from '@/lib/browser/history-window';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
type Category = LocalRecord & { name?: string; archivedAt?: number; cloudId?: string };
type Transaction = LocalRecord & {
  title?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};
const asMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');
const localDependency = (entity: 'account' | 'category', record: LocalRecord) =>
  record.cloudId || record._id ? null : `${entity}:${idOf(record)}`;

export default function TransactionsPage() {
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: categories } = useLocalRecords<Category>('category');
  const { records: transactions, loading } = useLocalRecords<Transaction>('transaction');
  const activeAccounts = accounts.filter((account) => account.archivedAt === undefined);
  const activeCategories = categories.filter((category) => category.archivedAt === undefined);
  const [type, setType] = React.useState<'expense' | 'income' | 'transfer'>('expense');
  const [accountId, setAccountId] = React.useState('');
  const [transferAccountId, setTransferAccountId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [occurredOn, setOccurredOn] = React.useState('');
  const [historyWindow, setHistoryWindow] = React.useState<
    '7' | '30' | '90' | '180' | '365' | 'all'
  >('30');
  const [rangeLoading, setRangeLoading] = React.useState(false);
  const [rangeError, setRangeError] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const range = React.useMemo(
    () => transactionHistoryRange(historyWindow, Date.now()),
    [historyWindow],
  );

  React.useEffect(() => {
    if (!accountId && activeAccounts[0]) setAccountId(idOf(activeAccounts[0]));
  }, [accountId, activeAccounts]);
  React.useEffect(() => {
    if (!occurredOn) setOccurredOn(new Date().toISOString().slice(0, 10));
  }, [occurredOn]);
  React.useEffect(() => {
    if (!userId || historyWindow === '30') return;
    let active = true;
    setRangeLoading(true);
    setRangeError('');
    void fetchTransactionRange(range.startAt, range.endAt)
      .catch((cause: unknown) => {
        if (active)
          setRangeError(
            !isConnected
              ? 'Connect to load this date range. Previously cached activity remains available.'
              : cause instanceof Error
                ? cause.message
                : 'Could not load this date range.',
          );
      })
      .finally(() => {
        if (active) setRangeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, historyWindow, isConnected, range, userId]);

  const visibleTransactions = [...transactions]
    .filter((transaction) => {
      const occurredAt = Number(transaction.occurredAt ?? 0);
      return (
        occurredAt >= range.startAt &&
        occurredAt < range.endAt &&
        transaction.deletedAt === undefined &&
        (transaction.status === undefined || transaction.status === 'posted')
      );
    })
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));

  async function createTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError('Sign in while online before saving financial records.');
      return;
    }
    const source = activeAccounts.find((account) => idOf(account) === accountId);
    const destination = activeAccounts.find((account) => idOf(account) === transferAccountId);
    const category = activeCategories.find((candidate) => idOf(candidate) === categoryId);
    if (!source) {
      setError('Add an account before creating a transaction.');
      return;
    }
    if (type === 'transfer' && (!destination || idOf(destination) === accountId)) {
      setError('Choose a different destination account.');
      return;
    }
    if (type === 'transfer' && destination?.currency !== source.currency) {
      setError('Transfers need accounts with the same currency.');
      return;
    }
    if (type !== 'transfer' && categoryId && !category) {
      setError('The selected category is no longer available. Choose another category.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amountMinor = parseMinor(amount, source.currency ?? 'INR');
      const occurredAt = new Date(`${occurredOn}T12:00:00`).getTime();
      if (!Number.isFinite(occurredAt)) throw new Error('INVALID_DATE');
      const mutationId = crypto.randomUUID();
      const record: LocalRecord = {
        ownerId: userId,
        accountId,
        ...(type === 'transfer' ? { transferAccountId } : {}),
        ...(type !== 'transfer' && categoryId ? { categoryId } : {}),
        type,
        amountMinor,
        currency: source.currency ?? 'INR',
        title: title.trim(),
        occurredAt,
        status: 'posted',
        createdAt: Date.now(),
      };
      const dependencies = [
        localDependency('account', source),
        ...(type === 'transfer' && destination ? [localDependency('account', destination)] : []),
        ...(type !== 'transfer' && category ? [localDependency('category', category)] : []),
      ].filter((dependency): dependency is string => dependency !== null);
      await commitLocalWrite(
        userId,
        'transaction',
        'transaction.create',
        record,
        {
          accountId,
          type,
          amountMinor,
          currency: source.currency ?? 'INR',
          ...(type === 'transfer' ? { transferAccountId } : {}),
          ...(type !== 'transfer' && categoryId ? { categoryId } : {}),
          title: title.trim(),
          occurredAt,
        },
        { clientMutationId: mutationId, dependencies },
      );
      setTitle('');
      setAmount('');
      setCategoryId('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this transaction.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">ACTIVITY</p>
        <h1>Keep the details close.</h1>
        <p>
          Sign in online once, then transactions you add in this browser are saved locally first and
          queued for sync.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">EVERY MOVE, CLEARLY</p>
          <h1>Activity</h1>
          <p className="finance-muted">
            Record it here. It stays on this device until the network returns.
          </p>
        </div>
        <Badge variant="neutral">{visibleTransactions.length} records</Badge>
      </header>
      <label className="finance-form-field finance-range-control">
        <span>Activity history</span>
        <select
          aria-label="Activity history window"
          value={historyWindow}
          onChange={(event) => setHistoryWindow(event.currentTarget.value as typeof historyWindow)}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 180 days</option>
          <option value="365">Last year</option>
          <option value="all">All history</option>
        </select>
      </label>
      {rangeLoading && (
        <p className="finance-muted" role="status">
          Loading this date range…
        </p>
      )}
      {rangeError && (
        <p className="finance-error" role="alert">
          {rangeError}
        </p>
      )}
      <div className="finance-transactions-layout">
        <Card className="finance-record-panel">
          <SectionHeader
            title="Recent activity"
            action={<span>{visibleTransactions.length} total</span>}
          />
          {loading ? (
            <p className="finance-muted">Opening your local activity…</p>
          ) : visibleTransactions.length === 0 ? (
            <Empty
              title="A quieter ledger"
              description="Your transactions appear here as soon as you save them or sync from another device."
              icon={<ArrowRight size={20} />}
            />
          ) : (
            <ul className="finance-record-list finance-activity-list">
              {visibleTransactions.map((transaction) => {
                const isIncome = transaction.type === 'income' || transaction.type === 'refund';
                const isTransfer = transaction.type === 'transfer';
                return (
                  <li key={idOf(transaction)}>
                    <span className={`finance-record-symbol${isIncome ? ' income' : ''}`}>
                      {isTransfer ? (
                        <Repeat2 size={17} />
                      ) : isIncome ? (
                        <ArrowDownLeft size={17} />
                      ) : (
                        <ArrowUpRight size={17} />
                      )}
                    </span>
                    <span className="finance-record-copy">
                      <strong>{transaction.title ?? 'Transaction'}</strong>
                      <small>
                        {transaction.occurredAt
                          ? new Date(transaction.occurredAt).toLocaleDateString('en', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Saved offline'}{' '}
                        · {transaction.type ?? 'expense'}
                      </small>
                    </span>
                    <strong
                      className={`finance-record-amount${isIncome ? ' finance-positive' : ''}`}
                    >
                      {isIncome ? '+' : isTransfer ? '↔ ' : '−'}
                      {formatMinor(asMinor(transaction.amountMinor), transaction.currency ?? 'INR')}
                    </strong>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="finance-form-panel">
          <SectionHeader title="Add transaction" action={<Plus size={17} />} />
          {activeAccounts.length === 0 ? (
            <Empty
              title="One account first"
              description="Choose where this money moves from by adding an account."
              action={
                <Link className="finance-inline-link" href="/accounts">
                  Set up an account
                </Link>
              }
            />
          ) : (
            <form className="finance-form" onSubmit={createTransaction}>
              <label className="finance-form-field">
                <span>Type</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.currentTarget.value as typeof type)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <FinanceInput
                label="Description"
                value={title}
                onChangeText={setTitle}
                placeholder="Groceries, salary, rent…"
                required
                maxLength={120}
              />
              <FinanceInput
                label={`Amount (${activeAccounts.find((account) => idOf(account) === accountId)?.currency ?? 'INR'})`}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChangeText={setAmount}
                required
              />
              <label className="finance-form-field">
                <span>{type === 'transfer' ? 'From account' : 'Account'}</span>
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.currentTarget.value)}
                  required
                >
                  {activeAccounts.map((account) => (
                    <option key={idOf(account)} value={idOf(account)}>
                      {account.name ?? 'Account'} · {account.currency ?? 'INR'}
                    </option>
                  ))}
                </select>
              </label>
              {type === 'transfer' ? (
                <label className="finance-form-field">
                  <span>To account</span>
                  <select
                    value={transferAccountId}
                    onChange={(event) => setTransferAccountId(event.currentTarget.value)}
                    required
                  >
                    <option value="">Choose destination</option>
                    {activeAccounts
                      .filter((account) => idOf(account) !== accountId)
                      .map((account) => (
                        <option key={idOf(account)} value={idOf(account)}>
                          {account.name ?? 'Account'} · {account.currency ?? 'INR'}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="finance-form-field">
                  <span>
                    Category <small>optional</small>
                  </span>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.currentTarget.value)}
                  >
                    <option value="">No category</option>
                    {activeCategories.map((category) => (
                      <option key={idOf(category)} value={idOf(category)}>
                        {category.name ?? 'Category'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <FinanceInput
                label="Date"
                type="date"
                value={occurredOn}
                onChangeText={setOccurredOn}
                required
              />
              {error && (
                <p className="finance-form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={saving || !title.trim() || !amount}>
                {saving ? 'Saving locally…' : 'Save transaction'} <ArrowRight size={15} />
              </Button>
              <p className="finance-form-note">
                Saved to this browser immediately. Sync is automatic when you’re online.
              </p>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
