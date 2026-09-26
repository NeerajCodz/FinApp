'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Plus } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader, Select } from '@finapp/ui/web';
import { formatMinor, parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';

type Account = LocalRecord & {
  name?: string;
  currency?: string;
  archivedAt?: number;
  cloudId?: string;
};
type Category = LocalRecord & { name?: string; archivedAt?: number; cloudId?: string };
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
};
type Transaction = LocalRecord & {
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  categoryId?: string;
  accountId?: string;
  occurredAt?: number;
  deletedAt?: number;
  status?: string;
};
const toMinor = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value);
  return 0n;
};
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function BudgetsPage() {
  const { userId } = useBrowserSync();
  const { records: budgets, loading } = useLocalRecords<Budget>('budget');
  const { records: accounts } = useLocalRecords<Account>('account');
  const { records: categories } = useLocalRecords<Category>('category');
  const { records: transactions } = useLocalRecords<Transaction>('transaction');
  const activeAccounts = accounts.filter((account) => account.archivedAt === undefined);
  const activeCategories = categories.filter((category) => category.archivedAt === undefined);
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [period, setPeriod] = React.useState<'monthly' | 'category' | 'account'>('monthly');
  const [categoryId, setCategoryId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [month, setMonth] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!month) setMonth(new Date().toISOString().slice(0, 7));
  }, [month]);
  React.useEffect(() => {
    if (!accountId && activeAccounts[0]) setAccountId(idOf(activeAccounts[0]));
  }, [accountId, activeAccounts]);
  React.useEffect(() => {
    if (!categoryId && activeCategories[0]) setCategoryId(idOf(activeCategories[0]));
  }, [categoryId, activeCategories]);

  const activeBudgets = budgets.filter((budget) => budget.archivedAt === undefined);
  const currency =
    activeAccounts.find((account) => idOf(account) === accountId)?.currency ??
    activeAccounts[0]?.currency ??
    'INR';

  async function createBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError('Sign in while online before creating a budget.');
      return;
    }
    if ((period === 'category' && !categoryId) || (period === 'account' && !accountId)) {
      setError('Choose a category or account for this budget.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const [year, monthNumber] = month.split('-').map(Number);
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(monthNumber) ||
        monthNumber! < 1 ||
        monthNumber! > 12
      ) {
        throw new Error('Choose a valid month.');
      }
      const startAt = new Date(year!, monthNumber! - 1, 1).getTime();
      const endAt = new Date(year!, monthNumber!, 1).getTime();
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt)
        throw new Error('INVALID_BUDGET_PERIOD');
      const amountMinor = parseMinor(amount, currency);
      const now = Date.now();
      const category = activeCategories.find((record) => idOf(record) === categoryId);
      const account = activeAccounts.find((record) => idOf(record) === accountId);
      if (period === 'category' && !category) throw new Error('Choose an available category.');
      if (period === 'account' && !account) throw new Error('Choose an available account.');
      const record: LocalRecord = {
        ownerId: userId,
        name: name.trim(),
        amountMinor,
        currency,
        period,
        ...(period === 'category' ? { categoryId } : {}),
        ...(period === 'account' ? { accountId } : {}),
        startAt,
        endAt,
        createdAt: now,
        updatedAt: now,
      };
      const dependencies = [
        period === 'category' && category && !category.cloudId && !category._id
          ? `category:${categoryId}`
          : null,
        period === 'account' && account && !account.cloudId && !account._id
          ? `account:${accountId}`
          : null,
      ].filter((value): value is string => value !== null);
      await commitLocalWrite(
        userId,
        'budget',
        'budget.create',
        record,
        {
          name: name.trim(),
          amountMinor,
          currency,
          period,
          ...(period === 'category' ? { categoryId } : {}),
          ...(period === 'account' ? { accountId } : {}),
          startAt,
          endAt,
        },
        { dependencies },
      );
      setName('');
      setAmount('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this budget.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">BUDGETS</p>
        <h1>Spend with intention.</h1>
        <p>
          Sign in online once to keep budgets and purchases in a private, user-scoped browser
          workspace.
        </p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">MAKE ROOM FOR WHAT MATTERS</p>
          <h1>Budgets</h1>
          <p className="finance-muted">
            A limit is a guide, not a judgement. Your totals update from saved activity.
          </p>
        </div>
        <Badge variant="neutral">{activeBudgets.length} active</Badge>
      </header>
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader title="Your budgets" action={<span>{activeBudgets.length} total</span>} />
          {loading ? (
            <p className="finance-muted">Opening your local budgets…</p>
          ) : activeBudgets.length === 0 ? (
            <Empty
              title="No budgets yet"
              description="Give one part of your month a clear boundary. It will track your saved activity automatically."
              icon={<CalendarDays size={20} />}
            />
          ) : (
            <ul className="finance-plan-cards">
              {activeBudgets.map((budget) => {
                const spent = transactions
                  .filter(
                    (transaction) =>
                      transaction.type === 'expense' &&
                      (transaction.status === undefined || transaction.status === 'posted') &&
                      transaction.deletedAt === undefined &&
                      Number(transaction.occurredAt ?? 0) >= Number(budget.startAt ?? 0) &&
                      Number(transaction.occurredAt ?? 0) <
                        Number(budget.endAt ?? Number.MAX_SAFE_INTEGER) &&
                      transaction.currency === (budget.currency ?? currency) &&
                      (budget.period !== 'category' ||
                        transaction.categoryId === budget.categoryId) &&
                      (budget.period !== 'account' || transaction.accountId === budget.accountId),
                  )
                  .reduce((sum, transaction) => sum + toMinor(transaction.amountMinor), 0n);
                const limit = toMinor(budget.amountMinor);
                const progress = limit > 0n ? Math.min(100, Number((spent * 100n) / limit)) : 0;
                return (
                  <li key={idOf(budget)} className="finance-plan-card">
                    <div className="finance-budget-heading">
                      <span>
                        <strong>{budget.name ?? 'Budget'}</strong>
                        <small>
                          {budget.period ?? 'monthly'} · {budget.currency ?? currency}
                        </small>
                      </span>
                      <strong>
                        {formatMinor(spent, budget.currency ?? currency)}{' '}
                        <small>of {formatMinor(limit, budget.currency ?? currency)}</small>
                      </strong>
                    </div>
                    <div className="finance-plan-track">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <small className="finance-plan-dates">
                      {budget.startAt
                        ? new Date(budget.startAt).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}{' '}
                      –{' '}
                      {budget.endAt
                        ? new Date(budget.endAt).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card className="finance-form-panel">
          <SectionHeader title="Set a budget" action={<Plus size={17} />} />
          <form className="finance-form" onSubmit={createBudget}>
            <FinanceInput
              label="Budget name"
              value={name}
              onChangeText={setName}
              placeholder="Everyday spending"
              required
              maxLength={80}
            />
            <FinanceInput
              label={`Monthly limit (${currency})`}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChangeText={setAmount}
              required
            />
            <Select
              label="Scope"
              options={['monthly', 'category', 'account']}
              value={period}
              onChange={(value) => setPeriod(value as typeof period)}
            />
            {period === 'category' && (
              <label className="finance-form-field">
                <span>Category</span>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.currentTarget.value)}
                  required
                >
                  <option value="">Choose category</option>
                  {activeCategories.map((category) => (
                    <option key={idOf(category)} value={idOf(category)}>
                      {category.name ?? 'Category'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {period === 'account' && (
              <label className="finance-form-field">
                <span>Account</span>
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.currentTarget.value)}
                  required
                >
                  <option value="">Choose account</option>
                  {activeAccounts.map((account) => (
                    <option key={idOf(account)} value={idOf(account)}>
                      {account.name ?? 'Account'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <FinanceInput
              label="Month"
              type="month"
              value={month}
              onChangeText={setMonth}
              required
            />
            {error && (
              <p className="finance-form-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={saving || !name.trim() || !amount}>
              {saving ? 'Saving locally…' : 'Save budget'} <ArrowRight size={15} />
            </Button>
            <p className="finance-form-note">
              New budgets are stored locally first and sync when a connection is available.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
