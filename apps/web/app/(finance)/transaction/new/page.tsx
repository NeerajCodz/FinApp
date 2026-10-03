'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { TransactionFormScreen, type TransactionFormType } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, belongsToUser, idOf, localDependency, matchesId } from '../../_personal';

type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & {
  defaultCurrency?: string;
  defaultAccountId?: string | null;
  defaultExpenseCategoryId?: string | null;
  defaultIncomeCategoryId?: string | null;
  updatedAt?: number;
};
const transactionTypes: TransactionFormType[] = ['expense', 'income', 'transfer'];
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalTransactionPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const accountState = useLocalRecords<Account>('account');
  const categoryState = useLocalRecords<Category>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const [type, setType] = React.useState<TransactionFormType>('expense');
  const [accountId, setAccountId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [merchant, setMerchant] = React.useState('');
  const [note, setNote] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState(() => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return now.getTime();
  });
  const [hasTime, setHasTime] = React.useState(false);
  const [savingDefault, setSavingDefault] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const createLock = React.useRef(false);
  const appliedQuery = React.useRef(false);
  const queryOverrides = React.useRef({ account: false, category: false });
  const accounts = accountState.records.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const categories = categoryState.records.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const profile = profileState.records.find((item) => userId && belongsToUser(item, userId));
  const source =
    accounts.find((item) => matchesId(item, accountId)) ??
    (!queryOverrides.current.account
      ? profile?.defaultAccountId &&
        accounts.some(
          (item) =>
            matchesId(item, profile.defaultAccountId!) &&
            (!profile.defaultCurrency || item.currency === profile.defaultCurrency),
        )
        ? accounts.find((item) => matchesId(item, profile.defaultAccountId!))
        : (accounts.find((item) => item.currency === profile?.defaultCurrency) ?? accounts[0])
      : undefined);
  const destination = accounts.find((item) => matchesId(item, destinationId));
  const category = categories.find((item) => matchesId(item, categoryId));
  const defaultCategoryField =
    type === 'income' ? 'defaultIncomeCategoryId' : 'defaultExpenseCategoryId';
  const isDefaultAccount = Boolean(
    source && profile?.defaultAccountId && aliasesOf(source).includes(profile.defaultAccountId),
  );
  const isDefaultCategory = Boolean(
    type !== 'transfer' &&
    category &&
    profile?.[defaultCategoryField] &&
    aliasesOf(category).includes(profile[defaultCategoryField]!),
  );

  React.useEffect(() => {
    if (appliedQuery.current || typeof window === 'undefined') return;
    appliedQuery.current = true;
    const query = new URLSearchParams(window.location.search);
    const queryType = query.get('type');
    if (queryType && transactionTypes.includes(queryType as TransactionFormType))
      setType(queryType as TransactionFormType);
    const queryAmount = query.get('amount');
    if (queryAmount) setAmount(queryAmount);
    queryOverrides.current.account = query.has('accountId');
    queryOverrides.current.category = query.has('categoryId');
    if (query.get('accountId')) setAccountId(query.get('accountId')!);
    if (query.get('categoryId')) setCategoryId(query.get('categoryId')!);
    if (query.get('destinationId')) setDestinationId(query.get('destinationId')!);
    const queryAt = Number(query.get('occurredAt'));
    if (Number.isSafeInteger(queryAt) && queryAt > 0) {
      setOccurredAt(queryAt);
      setHasTime(query.get('hasTime') === 'true');
    }
    if (query.get('note')) setNote(query.get('note')!);
    if (query.get('title')) setTitle(query.get('title')!);
    if (query.get('merchant')) setMerchant(query.get('merchant')!);
  }, []);
  React.useEffect(() => {
    const defaultId =
      type === 'income' ? profile?.defaultIncomeCategoryId : profile?.defaultExpenseCategoryId;
    if (!categoryId && categories.length && !queryOverrides.current.category)
      setCategoryId(
        defaultId && categories.some((item) => matchesId(item, defaultId))
          ? defaultId
          : idOf(categories[0]!),
      );
  }, [
    categories,
    categoryId,
    profile?.defaultExpenseCategoryId,
    profile?.defaultIncomeCategoryId,
    type,
  ]);

  async function toggleDefault(selection: 'account' | 'category') {
    if (!userId || !profile || savingDefault) return;
    const selected = selection === 'account' ? source : category;
    if (!selected || (selection === 'category' && type === 'transfer')) return;
    const isDefault = selection === 'account' ? isDefaultAccount : isDefaultCategory;
    const id = isDefault ? null : idOf(selected);
    const dependency = localDependency(selection, selected);
    setSavingDefault(true);
    setError(null);
    try {
      if (selection === 'account')
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultAccount',
          { ...profile, defaultAccountId: id },
          { accountId: id },
          {
            recordId: idOf(profile),
            dependencies: id && dependency ? [dependency] : [],
            baseUpdatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : undefined,
          },
        );
      else {
        const transactionType = type as 'expense' | 'income';
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultCategory',
          { ...profile, [defaultCategoryField]: id },
          { transactionType, categoryId: id },
          {
            recordId: idOf(profile),
            dependencies: id && dependency ? [dependency] : [],
            baseUpdatedAt: typeof profile.updatedAt === 'number' ? profile.updatedAt : undefined,
          },
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this default.');
    } finally {
      setSavingDefault(false);
    }
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createLock.current) return;
    if (!userId) {
      setError('Sign in before creating a transaction.');
      return;
    }
    if (!source) {
      setError('Choose an available account.');
      return;
    }
    if (
      type === 'transfer' &&
      (!destination ||
        aliasesOf(source).some((alias) => aliasesOf(destination).includes(alias)) ||
        destination.currency !== source.currency)
    ) {
      setError('Choose a different destination account with the same currency.');
      return;
    }
    if (type !== 'transfer' && !category) {
      setError('Choose an available category.');
      return;
    }
    if (!Number.isFinite(occurredAt)) {
      setError('Choose a valid transaction date.');
      return;
    }
    createLock.current = true;
    setSaving(true);
    setError(null);
    try {
      const amountMinor = parseMinor(amount, source.currency ?? 'INR');
      if (amountMinor <= 0n || amountMinor > maxInt64)
        throw new Error('Enter a positive valid amount.');
      const trimmedNote = note.trim();
      const transactionTitle =
        type === 'transfer'
          ? `Transfer to ${destination!.name ?? 'account'}`
          : title.trim() || trimmedNote || category!.name || 'Transaction';
      const record: LocalRecord = {
        ownerId: userId,
        accountId: idOf(source),
        ...(type === 'transfer'
          ? { transferAccountId: idOf(destination!) }
          : { categoryId: idOf(category!) }),
        type,
        amountMinor,
        currency: source.currency ?? 'INR',
        title: transactionTitle,
        ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
        occurredAt,
        hasTime,
        status: 'posted',
        createdAt: Date.now(),
      };
      const payload = {
        accountId: idOf(source),
        type,
        amountMinor,
        currency: source.currency ?? 'INR',
        ...(type === 'transfer'
          ? { transferAccountId: idOf(destination!) }
          : { categoryId: idOf(category!) }),
        title: transactionTitle,
        ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
        hasTime,
        occurredAt,
      };
      const dependencies = [
        localDependency('account', source),
        type === 'transfer'
          ? localDependency('account', destination!)
          : localDependency('category', category!),
      ].filter((value): value is string => value !== null);
      const id = await commitLocalWrite(
        userId,
        'transaction',
        'transaction.create',
        record,
        payload,
        { dependencies },
      );
      router.push(`/transaction/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this transaction.');
    } finally {
      createLock.current = false;
      setSaving(false);
    }
  }

  let amountValid: boolean;
  try {
    const amountMinor = source ? parseMinor(amount, source.currency ?? 'INR') : 0n;
    amountValid = amountMinor > 0n && amountMinor <= maxInt64;
  } catch {
    amountValid = false;
  }
  return (
    <TransactionFormScreen
      mode="create"
      signedIn={Boolean(userId)}
      type={type}
      title={title}
      amount={amount}
      merchant={merchant}
      note={note}
      occurredAt={occurredAt}
      hasTime={hasTime}
      currency={source?.currency ?? profile?.defaultCurrency ?? 'INR'}
      accounts={accounts.map((item) => ({
        id: idOf(item),
        name: item.name ?? 'Account',
        currency: item.currency,
      }))}
      categories={categories.map((item) => ({
        id: idOf(item),
        name: item.name ?? 'Category',
        icon: item.icon,
      }))}
      accountId={source ? idOf(source) : ''}
      categoryId={category ? idOf(category) : ''}
      destinationId={destination ? idOf(destination) : ''}
      loading={accountState.loading || categoryState.loading || profileState.loading}
      dataError={accountState.error ?? categoryState.error ?? profileState.error}
      submitDisabled={
        accountState.loading ||
        categoryState.loading ||
        profileState.loading ||
        Boolean(accountState.error || categoryState.error || profileState.error) ||
        !source ||
        !amountValid ||
        (type !== 'transfer' && !category) ||
        (type === 'transfer' &&
          (!destination ||
            aliasesOf(source).some((alias) => aliasesOf(destination).includes(alias)) ||
            destination.currency !== source.currency))
      }
      saving={saving}
      error={error}
      savingDefault={savingDefault}
      isDefaultAccount={isDefaultAccount}
      isDefaultCategory={isDefaultCategory}
      onTypeChange={(value) => {
        setType(value);
        setCategoryId('');
      }}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onMerchantChange={setMerchant}
      onNoteChange={setNote}
      onAccountChange={(id) => {
        setAccountId(id);
        setDestinationId('');
      }}
      onCategoryChange={setCategoryId}
      onDestinationChange={setDestinationId}
      onDateChange={setOccurredAt}
      onHasTimeChange={(enabled) => {
        setHasTime(enabled);
        const date = new Date(occurredAt);
        if (enabled) {
          const now = new Date();
          date.setHours(now.getHours(), now.getMinutes(), 0, 0);
        } else date.setHours(12, 0, 0, 0);
        setOccurredAt(date.getTime());
      }}
      onSubmit={create}
      onBack={() => router.push('/transactions')}
      onToggleDefault={toggleDefault}
      onAddAccount={() => router.push('/accounts/new')}
      onManageCategories={() => router.push(categories.length ? '/categories' : '/categories/new')}
      onSplitExpense={() => router.push('/split/new')}
    />
  );
}
