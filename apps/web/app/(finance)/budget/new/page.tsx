'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Card } from '@finapp/ui/web';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { FinanceInput } from '@/components/finance/FinanceInput';
import { belongsToUser, dateAtUtcStart, idOf, localDependency, PageHeading, SignInGate } from '../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string };
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; archivedAt?: number };
type Period = 'monthly' | 'category' | 'account' | 'custom';
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalBudgetPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: profiles, loading: profileLoading, error: profileError } = useLocalRecords<Profile>('profile');
  const { records: accountRecords, loading: accountLoading, error: accountError } = useLocalRecords<Account>('account');
  const { records: categoryRecords, loading: categoryLoading, error: categoryError } = useLocalRecords<Category>('category');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [period, setPeriod] = React.useState<Period>('monthly');
  const [categoryId, setCategoryId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = React.useState(() => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10); });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const profile = profiles[0];
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined);
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const account = accounts.find((item) => idOf(item) === accountId);
  const category = categories.find((item) => idOf(item) === categoryId);
  const currency = period === 'account' ? account?.currency : profile?.defaultCurrency;

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Enter a budget name.'); return; }
    if (period === 'category' && !category) { setError('Choose an available category.'); return; }
    if (period === 'account' && !account) { setError('Choose an available account.'); return; }
    if (!currency) { setError('A profile currency or account currency is required.'); return; }
    setSaving(true); setError(null);
    try {
      const amountMinor = parseMinor(amount, currency);
      if (amountMinor <= 0n || amountMinor > maxInt64) throw new Error('Enter a positive valid budget limit.');
      let startAt: number | null;
      let endAt: number | null;
      if (period === 'custom') { startAt = dateAtUtcStart(startDate); endAt = dateAtUtcStart(endDate); }
      else {
        if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Choose a valid month.');
        const [year, monthNumber] = month.split('-').map(Number);
        if (!year || !monthNumber || monthNumber > 12) throw new Error('Choose a valid month.');
        startAt = Date.UTC(year, monthNumber - 1, 1);
        endAt = Date.UTC(year, monthNumber, 1);
      }
      if (startAt === null || endAt === null || endAt <= startAt) throw new Error('Choose a valid date range with an end after its start.');
      const now = Date.now();
      const record: LocalRecord = { ownerId: userId, name: trimmedName, amountMinor, currency, period, ...(period === 'category' && category ? { categoryId: idOf(category) } : {}), ...(period === 'account' && account ? { accountId: idOf(account) } : {}), startAt, endAt, createdAt: now, updatedAt: now };
      const payload = { name: trimmedName, amountMinor, currency, period, ...(period === 'category' && category ? { categoryId: idOf(category) } : {}), ...(period === 'account' && account ? { accountId: idOf(account) } : {}), startAt, endAt };
      const dependencies = [period === 'category' && category ? localDependency('category', category) : null, period === 'account' && account ? localDependency('account', account) : null].filter((value): value is string => value !== null);
      const id = await commitLocalWrite(userId, 'budget', 'budget.create', record, payload, { dependencies });
      router.push(`/budget/${encodeURIComponent(id)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create this budget.'); }
    finally { setSaving(false); }
  }

  if (!userId) return <SignInGate eyebrow="NEW BUDGET" title="Give spending a boundary.">Sign in to save a budget into your private, local-first finance data.</SignInGate>;
  const loading = profileLoading || accountLoading || categoryLoading;
  const dataError = profileError ?? accountError ?? categoryError;
  return <div className="finance-page"><Link className="finance-secondary-action" href="/budget"><ArrowLeft size={15} /> Back to budgets</Link><PageHeading eyebrow="NEW BUDGET" title="Set a spending limit" description="Choose the date range and optional category or account scope. The selected account determines its required currency." /><Card className="finance-form-panel">{loading ? <p className="finance-muted" role="status">Loading available scopes…</p> : dataError ? <p className="finance-form-error" role="alert">Budget options could not be opened: {dataError}</p> : <form className="finance-form" onSubmit={create}><FinanceInput label="Budget name" value={name} onChangeText={setName} placeholder="Everyday spending" maxLength={80} required /><label className="finance-form-field"><span>Scope</span><select value={period} onChange={(event) => setPeriod(event.currentTarget.value as Period)}><option value="monthly">Monthly</option><option value="category">Category</option><option value="account">Account</option><option value="custom">Custom date range</option></select></label>{period === 'category' && <label className="finance-form-field"><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.currentTarget.value)} required><option value="">Choose a category</option>{categories.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name ?? 'Category'}</option>)}</select></label>}{period === 'account' && <label className="finance-form-field"><span>Account</span><select value={accountId} onChange={(event) => setAccountId(event.currentTarget.value)} required><option value="">Choose an account</option>{accounts.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name ?? 'Account'} · {item.currency ?? 'INR'}</option>)}</select></label>}{currency && <FinanceInput label={`Limit (${currency})`} type="number" min="0.01" step={currency === 'JPY' || currency === 'KRW' ? '1' : '0.01'} value={amount} onChangeText={setAmount} required />}{period === 'custom' ? <div className="finance-form-row"><FinanceInput label="Starts on" type="date" value={startDate} onChangeText={setStartDate} required /><FinanceInput label="Ends (exclusive)" type="date" value={endDate} onChangeText={setEndDate} required /></div> : <FinanceInput label="Month" type="month" value={month} onChangeText={setMonth} required />}{error && <p className="finance-form-error" role="alert">{error}</p>}<Button type="submit" disabled={saving || loading || !name.trim() || !amount || !currency}>{saving ? 'Saving locally…' : 'Create budget'} <ArrowRight size={15} /></Button><p className="finance-form-note">Budgets compare posted expenses in this date range. They never move money between accounts.</p></form>}</Card></div>;
}
