'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Empty, RadioGroup, Tabs } from '@finapp/ui/web';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { CurrencyInput } from '@finapp/ui/finance';
import { FinanceInput } from '@/components/finance/FinanceInput';
import {
  belongsToUser,
  dateAtUtcStart,
  idOf,
  localDependency,
  PageHeading,
  SignInGate,
} from '../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string };
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; archivedAt?: number };
type Period = 'monthly' | 'category' | 'account' | 'custom';
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalBudgetPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
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
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [period, setPeriod] = React.useState<Period>('monthly');
  const [categoryId, setCategoryId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = React.useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      .toISOString()
      .slice(0, 10);
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const profile = profiles[0];
  const accounts = accountRecords.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const categories = categoryRecords
    .filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const account = accounts.find((item) => idOf(item) === accountId);
  const category = categories.find((item) => idOf(item) === categoryId);
  const currency = period === 'account' ? (account?.currency ?? profile?.defaultCurrency) : profile?.defaultCurrency;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter a budget name.');
      return;
    }
    if (period === 'category' && !category) {
      setError('Choose an available category.');
      return;
    }
    if (period === 'account' && !account) {
      setError('Choose an available account.');
      return;
    }
    if (!currency) {
      setError('A profile currency or account currency is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amountMinor = parseMinor(amount, currency);
      if (amountMinor <= 0n || amountMinor > maxInt64)
        throw new Error('Enter a positive valid budget limit.');
      const now = Date.now();
      let startAt: number | null;
      let endAt: number | null;
      if (period === 'custom') {
        startAt = dateAtUtcStart(startDate);
        endAt = dateAtUtcStart(endDate);
      } else {
        const currentUtcMonth = new Date(now);
        const year = currentUtcMonth.getUTCFullYear();
        const month = currentUtcMonth.getUTCMonth();
        startAt = Date.UTC(year, month, 1);
        endAt = Date.UTC(year, month + 1, 1);
      }
      if (startAt === null || endAt === null || endAt <= startAt)
        throw new Error('Choose a valid date range with an end after its start.');
      const record: LocalRecord = {
        ownerId: userId,
        name: trimmedName,
        amountMinor,
        currency,
        period,
        ...(period === 'category' && category ? { categoryId: idOf(category) } : {}),
        ...(period === 'account' && account ? { accountId: idOf(account) } : {}),
        startAt,
        endAt,
        createdAt: now,
        updatedAt: now,
      };
      const payload = {
        name: trimmedName,
        amountMinor,
        currency,
        period,
        ...(period === 'category' && category ? { categoryId: idOf(category) } : {}),
        ...(period === 'account' && account ? { accountId: idOf(account) } : {}),
        startAt,
        endAt,
      };
      const dependencies = [
        period === 'category' && category ? localDependency('category', category) : null,
        period === 'account' && account ? localDependency('account', account) : null,
      ].filter((value): value is string => value !== null);
      const id = await commitLocalWrite(userId, 'budget', 'budget.create', record, payload, {
        dependencies,
      });
      router.push(`/budget/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this budget.');
    } finally {
      setSaving(false);
    }
  }
  if (!userId)
    return (
      <SignInGate eyebrow="NEW BUDGET" title="Give spending a boundary.">
        Sign in to save a budget into your private, local-first finance data.
      </SignInGate>
    );
  const loading = profileLoading || accountLoading || categoryLoading;
  const dataError = profileError ?? accountError ?? categoryError;
  return (
    <div className="finance-page">
      <Link className="finance-secondary-action" href="/budget" aria-label="Go back">
        <ArrowLeft size={18} />
      </Link>
      <PageHeading eyebrow="NEW BUDGET" title="New budget" description="Give spending a boundary." />
      <p className="finance-muted">Track real expenses against a limit you choose.</p>
      <Card className="finance-form-panel">
        {loading ? (
          <p className="finance-muted" role="status">
            Loading available scopes…
          </p>
        ) : dataError ? (
          <p className="finance-form-error" role="alert">
            Budget options could not be opened: {dataError}
          </p>
        ) : (
          <form className="finance-form" onSubmit={create}>
            <FinanceInput
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Monthly spending"
              maxLength={80}
              required
            />
            {currency ? (
              <CurrencyInput currency={currency} value={amount} onChangeText={setAmount} />
            ) : profile === undefined ? (
              <p className="finance-muted" role="status">
                Loading your default currency…
              </p>
            ) : (
              <p className="finance-muted">
                Choose a default currency before creating this budget.{' '}
                <Link className="finance-inline-link" href="/settings/currency">
                  Set your default currency
                </Link>
              </p>
            )}
            <Tabs
              label="Period"
              value={period}
              onChange={(value) => setPeriod(value as Period)}
              tabs={[
                { label: 'Monthly', value: 'monthly' },
                { label: 'Category', value: 'category' },
                { label: 'Account', value: 'account' },
                { label: 'Custom', value: 'custom' },
              ]}
            />
            {period === 'category' && (
              <div className="finance-form-field">
                <span>Category</span>
                {categories.length ? (
                  <RadioGroup
                    options={categories.map((item) => ({
                      value: idOf(item),
                      label: item.name ?? 'Category',
                    }))}
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                ) : (
                  <Empty
                    title="No categories yet"
                    description="Create one before setting a category budget."
                    action={
                      <Link className="finance-inline-link" href="/category/new">
                        Create category
                      </Link>
                    }
                  />
                )}
              </div>
            )}
            {period === 'account' && (
              <div className="finance-form-field">
                <span>Account</span>
                {accounts.length ? (
                  <RadioGroup
                    options={accounts.map((item) => ({
                      value: idOf(item),
                      label: `${item.name ?? 'Account'} · ${item.currency ?? 'INR'}`,
                    }))}
                    value={accountId}
                    onChange={setAccountId}
                  />
                ) : (
                  <p className="finance-muted">
                    Create an account first.{' '}
                    <Link className="finance-inline-link" href="/account/new">
                      Create account
                    </Link>
                  </p>
                )}
              </div>
            )}
            {period === 'custom' && (
              <div className="finance-form-row">
                <FinanceInput
                  label="Starts (YYYY-MM-DD)"
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-01-01"
                  required
                />
                <FinanceInput
                  label="Ends (exclusive, YYYY-MM-DD)"
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-02-01"
                  required
                />
              </div>
            )}
            {error && (
              <p className="finance-form-error" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                saving ||
                loading ||
                !name.trim() ||
                !amount ||
                !currency ||
                (period === 'category' && !category) ||
                (period === 'account' && !account)
              }
            >
              {saving ? 'Saving…' : 'Save budget'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
