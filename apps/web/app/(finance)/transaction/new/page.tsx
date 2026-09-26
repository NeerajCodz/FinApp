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
import { aliasesOf, belongsToUser, dateAtUtcStart, idOf, localDependency, matchesId, PageHeading, SignInGate } from '../../_personal';

type TransactionType = 'expense' | 'income' | 'transfer';
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; archivedAt?: number };
type Profile = LocalRecord & { defaultCurrency?: string; defaultAccountId?: string; defaultExpenseCategoryId?: string; defaultIncomeCategoryId?: string };
const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalTransactionPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const { records: accountRecords, loading: accountLoading, error: accountError } = useLocalRecords<Account>('account');
  const { records: categoryRecords, loading: categoryLoading, error: categoryError } = useLocalRecords<Category>('category');
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const [type, setType] = React.useState<TransactionType>('expense');
  const [accountId, setAccountId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [occurredOn, setOccurredOn] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const appliedQuery = React.useRef(false);
  const queryOverrides = React.useRef({ account: false, category: false });
  const accounts = accountRecords.filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined);
  const categories = categoryRecords.filter((item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined);
  const profile = profiles[0];
  const source = accounts.find((item) => matchesId(item, accountId));
  const destination = accounts.find((item) => matchesId(item, destinationId));
  const category = categories.find((item) => matchesId(item, categoryId));

  React.useEffect(() => {
    if (appliedQuery.current || typeof window === 'undefined') return;
    appliedQuery.current = true;
    const query = new URLSearchParams(window.location.search);
    const queryType = query.get('type');
    if (queryType && transactionTypes.includes(queryType as TransactionType)) setType(queryType as TransactionType);
    const queryAmount = query.get('amount');
    if (queryAmount) setAmount(queryAmount);
    queryOverrides.current.account = query.has('accountId');
    queryOverrides.current.category = query.has('categoryId');
    const queryAccount = query.get('accountId');
    if (queryAccount) setAccountId(queryAccount);
    const queryCategory = query.get('categoryId');
    if (queryCategory) setCategoryId(queryCategory);
    const queryDestination = query.get('destinationId');
    if (queryDestination) setDestinationId(queryDestination);
    const queryAt = Number(query.get('occurredAt'));
    if (Number.isSafeInteger(queryAt) && queryAt > 0) setOccurredOn(new Date(queryAt).toISOString().slice(0, 10));
    const queryNote = query.get('note');
    if (queryNote) setDescription(queryNote);
  }, []);
  React.useEffect(() => { if (!accountId && accounts.length && !queryOverrides.current.account) setAccountId(profile?.defaultAccountId && accounts.some((item) => matchesId(item, profile.defaultAccountId!)) ? profile.defaultAccountId : idOf(accounts[0]!)); }, [accountId, accounts, profile?.defaultAccountId]);
  React.useEffect(() => { const defaultId = type === 'income' ? profile?.defaultIncomeCategoryId : profile?.defaultExpenseCategoryId; if (!categoryId && categories.length && !queryOverrides.current.category) setCategoryId(defaultId && categories.some((item) => matchesId(item, defaultId)) ? defaultId : idOf(categories[0]!)); }, [categories, categoryId, profile?.defaultExpenseCategoryId, profile?.defaultIncomeCategoryId, type]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) {
      setError('Sign in before creating a transaction.');
      return;
    }
    if (!source) { setError('Choose an available account.'); return; }
    if (type === 'transfer') {
      if (!destination || aliasesOf(source).some((alias) => aliasesOf(destination).includes(alias))) { setError('Choose a different destination account.'); return; }
      if (destination.currency !== source.currency) { setError('Transfers need accounts with the same currency.'); return; }
      if (destination.name === source.name) { setError('Choose a destination account with a different name.'); return; }
    }
    if (type !== 'transfer' && !category) { setError('Choose an available category.'); return; }
    const dateStart = dateAtUtcStart(occurredOn);
    if (dateStart === null) { setError('Choose a valid transaction date.'); return; }
    setSaving(true); setError(null);
    try {
      const amountMinor = parseMinor(amount, source.currency ?? 'INR');
      if (amountMinor <= 0n || amountMinor > maxInt64) throw new Error('Enter a positive valid amount.');
      const occurredAt = new Date(`${occurredOn}T12:00:00`).getTime();
      if (!Number.isFinite(occurredAt)) throw new Error('Choose a valid transaction date.');
      const note = description.trim();
      const title = type === 'transfer' ? `Transfer to ${destination!.name ?? 'account'}` : note || category!.name || 'Transaction';
      const record: LocalRecord = {
        ownerId: userId,
        accountId: idOf(source),
        ...(type === 'transfer' ? { transferAccountId: idOf(destination!) } : { categoryId: idOf(category!) }),
        type,
        amountMinor,
        currency: source.currency ?? 'INR',
        title,
        ...(note ? { note } : {}),
        occurredAt,
        status: 'posted',
        createdAt: Date.now(),
      };
      const payload = {
        accountId: idOf(source), type, amountMinor, currency: source.currency ?? 'INR',
        ...(type === 'transfer' ? { transferAccountId: idOf(destination!) } : { categoryId: idOf(category!) }),
        title, ...(note ? { note } : {}), occurredAt,
      };
      const dependencies = [localDependency('account', source), type === 'transfer' ? localDependency('account', destination!) : localDependency('category', category!)].filter((value): value is string => value !== null);
      const id = await commitLocalWrite(userId, 'transaction', 'transaction.create', record, payload, { dependencies });
      router.push(`/transaction/${encodeURIComponent(id)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create this transaction.'); }
    finally { setSaving(false); }
  }

  if (!userId) return <SignInGate eyebrow="NEW TRANSACTION" title="Record a move, locally first.">Sign in to create a transaction in your user-scoped browser ledger.</SignInGate>;
  const loading = accountLoading || categoryLoading;
  const dataError = accountError ?? categoryError;
  return <div className="finance-page"><Link className="finance-secondary-action" href="/transactions"><ArrowLeft size={15} /> Back to activity</Link><PageHeading eyebrow="NEW TRANSACTION" title="Record a transaction" description="Choose an expense, income, or transfer. Saved transactions stay in the local ledger and sync through the outbox." /><Card className="finance-form-panel">{loading ? <p className="finance-muted" role="status">Loading available accounts and categories…</p> : dataError ? <p className="finance-form-error" role="alert">Transaction options could not be opened: {dataError}</p> : accounts.length === 0 ? <div className="finance-form"><p className="finance-muted">Create an account before recording activity.</p><Link className="finance-primary-link" href="/account/new">Add account <ArrowRight size={15} /></Link></div> : <form className="finance-form" onSubmit={create}><label className="finance-form-field"><span>Type</span><select value={type} onChange={(event) => setType(event.currentTarget.value as TransactionType)}><option value="expense">Expense</option><option value="income">Income</option><option value="transfer">Transfer</option></select></label><FinanceInput label={`Amount (${source?.currency ?? 'INR'})`} type="number" min="0.01" step={source?.currency === 'JPY' || source?.currency === 'KRW' ? '1' : '0.01'} value={amount} onChangeText={setAmount} required /><label className="finance-form-field"><span>{type === 'transfer' ? 'From account' : 'Account'}</span><select value={accountId} onChange={(event) => { setAccountId(event.currentTarget.value); setDestinationId(''); }} required><option value="">Choose an account</option>{accounts.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name ?? 'Account'} · {item.currency ?? 'INR'}</option>)}</select></label>{type === 'transfer' ? <label className="finance-form-field"><span>To account</span><select value={destinationId} onChange={(event) => setDestinationId(event.currentTarget.value)} required><option value="">Choose destination</option>{accounts.filter((item) => idOf(item) !== idOf(source ?? {})).map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name ?? 'Account'} · {item.currency ?? 'INR'}</option>)}</select></label> : <label className="finance-form-field"><span>Category</span><select value={categoryId} onChange={(event) => setCategoryId(event.currentTarget.value)} required><option value="">Choose a category</option>{categories.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.name ?? 'Category'}</option>)}</select>{categories.length === 0 && <small><Link className="finance-inline-link" href="/category/new">Create a category first</Link></small>}</label>}<FinanceInput label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Groceries, salary, or transfer note" maxLength={120} /><FinanceInput label="Date" type="date" value={occurredOn} onChangeText={setOccurredOn} required />{error && <p className="finance-form-error" role="alert">{error}</p>}<Button type="submit" disabled={saving || !amount || !source || (type === 'transfer' ? !destination : !category)}>{saving ? 'Saving locally…' : 'Save transaction'} <ArrowRight size={15} /></Button><p className="finance-form-note">This form creates only expenses, income, and transfers. It does not edit or remove existing transactions.</p></form>}</Card></div>;
}
