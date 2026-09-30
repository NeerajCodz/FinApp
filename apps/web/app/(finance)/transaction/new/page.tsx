'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, ReceiptText, UsersRound } from 'lucide-react';
import { Button, Input, Sheet, Typography } from '@finapp/ui/web';
import {
  CategoryIcon,
  CurrencyInput,
  DateTimePicker,
  SettingsRow,
  formatTransactionDate,
} from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  belongsToUser,
  idOf,
  localDependency,
  matchesId,
  SignInGate,
} from '../../_personal';

type TransactionType = 'expense' | 'income' | 'transfer';
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & {
  defaultCurrency?: string;
  defaultAccountId?: string | null;
  defaultExpenseCategoryId?: string | null;
  defaultIncomeCategoryId?: string | null;
  updatedAt?: number;
};
const transactionTypes: TransactionType[] = ['expense', 'income', 'transfer'];
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalTransactionPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
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
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const [type, setType] = React.useState<TransactionType>('expense');
  const [accountId, setAccountId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState(() => {
    const initial = new Date();
    initial.setHours(12, 0, 0, 0);
    return initial.getTime();
  });
  const [showTime, setShowTime] = React.useState(false);
  const [savingDefault, setSavingDefault] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [picker, setPicker] = React.useState<
    'category' | 'account' | 'destination' | 'date' | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const appliedQuery = React.useRef(false);
  const queryOverrides = React.useRef({ account: false, category: false });
  const accounts = accountRecords.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const categories = categoryRecords.filter(
    (item) => userId && belongsToUser(item, userId) && item.archivedAt === undefined,
  );
  const profile = profiles[0];
  const source = accounts.find((item) => matchesId(item, accountId));
  const destination = accounts.find((item) => matchesId(item, destinationId));
  const category = categories.find((item) => matchesId(item, categoryId));
  const defaultCategoryField =
    type === 'income' ? 'defaultIncomeCategoryId' : 'defaultExpenseCategoryId';
  const isDefaultAccount = Boolean(
    source &&
    typeof profile?.defaultAccountId === 'string' &&
    aliasesOf(source).includes(profile.defaultAccountId),
  );
  const isDefaultCategory = Boolean(
    type !== 'transfer' &&
    category &&
    typeof profile?.[defaultCategoryField] === 'string' &&
    aliasesOf(category).includes(profile[defaultCategoryField]!),
  );

  React.useEffect(() => {
    if (appliedQuery.current || typeof window === 'undefined') return;
    appliedQuery.current = true;
    const query = new URLSearchParams(window.location.search);
    const queryType = query.get('type');
    if (queryType && transactionTypes.includes(queryType as TransactionType))
      setType(queryType as TransactionType);
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
    if (Number.isSafeInteger(queryAt) && queryAt > 0) {
      setOccurredAt(queryAt);
      setShowTime(query.get('hasTime') === 'true');
    }
    const queryNote = query.get('note');
    if (queryNote) setDescription(queryNote);
  }, []);
  React.useEffect(() => {
    if (!accountId && accounts.length && !queryOverrides.current.account)
      setAccountId(
        profile?.defaultAccountId &&
          accounts.some((item) => matchesId(item, profile.defaultAccountId!))
          ? profile.defaultAccountId
          : idOf(accounts[0]!),
      );
  }, [accountId, accounts, profile?.defaultAccountId]);
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
      if (selection === 'account') {
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
      } else {
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
    if (!userId) {
      setError('Sign in before creating a transaction.');
      return;
    }
    if (!source) {
      setError('Choose an available account.');
      return;
    }
    if (type === 'transfer') {
      if (
        !destination ||
        aliasesOf(source).some((alias) => aliasesOf(destination).includes(alias))
      ) {
        setError('Choose a different destination account.');
        return;
      }
      if (destination.currency !== source.currency) {
        setError('Transfers need accounts with the same currency.');
        return;
      }
    }
    if (type !== 'transfer' && !category) {
      setError('Choose an available category.');
      return;
    }
    if (!Number.isFinite(occurredAt)) {
      setError('Choose a valid transaction date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const amountMinor = parseMinor(amount, source.currency ?? 'INR');
      if (amountMinor <= 0n || amountMinor > maxInt64)
        throw new Error('Enter a positive valid amount.');
      const note = description.trim();
      const title =
        type === 'transfer'
          ? `Transfer to ${destination!.name ?? 'account'}`
          : note || category!.name || 'Transaction';
      const record: LocalRecord = {
        ownerId: userId,
        accountId: idOf(source),
        ...(type === 'transfer'
          ? { transferAccountId: idOf(destination!) }
          : { categoryId: idOf(category!) }),
        type,
        amountMinor,
        currency: source.currency ?? 'INR',
        title,
        ...(note ? { note } : {}),
        occurredAt,
        hasTime: showTime,
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
        title,
        ...(note ? { note } : {}),
        hasTime: showTime,
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
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="NEW TRANSACTION" title="Record a move, locally first.">
        Sign in to create a transaction in your user-scoped browser ledger.
      </SignInGate>
    );
  const dataError = accountError ?? categoryError;
  let amountValid: boolean;
  try {
    const amountMinor = parseMinor(amount, source?.currency ?? profile?.defaultCurrency ?? 'INR');
    amountValid = amountMinor > 0n && amountMinor <= maxInt64;
  } catch {
    amountValid = false;
  }
  return (
    <div
      className="finance-page"
      style={{ gap: 20, maxWidth: 760, marginInline: 'auto', width: '100%' }}
    >
      <header style={{ display: 'flex', alignItems: 'center', minHeight: 44 }}>
        <Link className="finance-secondary-action" href="/activity" aria-label="Cancel">
          <ArrowLeft size={21} aria-hidden="true" />
        </Link>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <Typography variant="bodyLarge" style={{ fontWeight: 600, letterSpacing: '-0.02em' }}>
            New transaction
          </Typography>
          <Typography variant="small" style={{ color: 'var(--finapp-foreground-muted)' }}>
            Record it locally, sync when ready
          </Typography>
        </div>
        <span aria-hidden="true" style={{ width: 44 }} />
      </header>
      <form className="finance-form" onSubmit={create} style={{ display: 'grid', gap: 20 }}>
        <section
          aria-label="Transaction amount"
          style={{
            minHeight: 180,
            display: 'grid',
            alignContent: 'center',
            justifyItems: 'center',
            gap: 10,
            borderRadius: 20,
            border: '1px solid var(--finance-line)',
            background: 'var(--finapp-surface-raised)',
            padding: '20px 16px',
          }}
        >
          <span
            style={{
              color: 'var(--finapp-foreground-muted)',
              fontSize: 12,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
            }}
          >
            {type} amount
          </span>
          <CurrencyInput
            currency={source?.currency ?? profile?.defaultCurrency ?? 'INR'}
            value={amount}
            onChangeText={setAmount}
          />
        </section>
        <div>
          <Typography
            variant="small"
            style={{ display: 'block', marginBottom: 8, color: 'var(--finapp-foreground-muted)' }}
          >
            Transaction type
          </Typography>
          <div
            role="group"
            aria-label="Transaction type"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 4,
              padding: 4,
              borderRadius: 12,
              background: 'var(--finapp-surface-raised)',
            }}
          >
            {transactionTypes.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={type === item ? 'primary' : 'ghost'}
                aria-pressed={type === item}
                onPress={() => {
                  setType(item);
                  setCategoryId('');
                }}
                style={{
                  minHeight: 42,
                  borderRadius: 10,
                  backgroundColor:
                    type === item
                      ? `var(--finapp-${item === 'transfer' ? 'warning' : item})`
                      : 'transparent',
                  color: type === item ? '#000' : undefined,
                }}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <section
          aria-label="Transaction details"
          style={{
            padding: '4px 16px',
            border: '1px solid var(--finance-line)',
            borderRadius: 16,
            background: 'var(--finapp-surface-raised)',
          }}
        >
          <div>
            {type !== 'transfer' && (
              <>
                <SettingsRow
                  label="Category"
                  leadingIcon={
                    <CategoryIcon label={category?.name ?? 'Category'} icon={category?.icon} />
                  }
                  value={
                    category?.name ??
                    (categoryLoading ? 'Loading categories…' : 'Choose a category')
                  }
                  onPress={() => setPicker('category')}
                />
                <div style={{ borderTop: '1px solid var(--finance-line)' }} />
              </>
            )}
            <SettingsRow
              label={type === 'transfer' ? 'From account' : 'Account'}
              value={source?.name ?? (accountLoading ? 'Loading accounts…' : 'Choose an account')}
              onPress={() => setPicker('account')}
            />
            {type === 'transfer' && (
              <>
                <div style={{ borderTop: '1px solid var(--finance-line)' }} />
                <SettingsRow
                  label="To account"
                  value={destination?.name ?? 'Choose destination'}
                  onPress={() => setPicker('destination')}
                />
              </>
            )}
            <div style={{ borderTop: '1px solid var(--finance-line)' }} />
            <Typography
              variant="small"
              style={{ display: 'block', paddingTop: 10, color: 'var(--finapp-foreground-muted)' }}
            >
              Timing
            </Typography>
            <SettingsRow
              label="Date"
              value={formatTransactionDate(occurredAt, showTime)}
              onPress={() => setPicker('date')}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
              <input
                type="checkbox"
                checked={showTime}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked;
                  setShowTime(enabled);
                  if (enabled) {
                    const date = new Date(occurredAt);
                    const now = new Date();
                    date.setHours(now.getHours(), now.getMinutes(), 0, 0);
                    setOccurredAt(date.getTime());
                  } else {
                    const date = new Date(occurredAt);
                    date.setHours(12, 0, 0, 0);
                    setOccurredAt(date.getTime());
                  }
                }}
              />
              <span>Include time</span>
            </label>
          </div>
        </section>
        <section
          style={{
            display: 'grid',
            gap: 12,
            padding: 16,
            border: '1px solid var(--finance-line)',
            borderRadius: 16,
          }}
        >
          <Typography variant="small" style={{ color: 'var(--finapp-foreground-muted)' }}>
            Note and sharing
          </Typography>
          <label className="finance-form-field">
            <span>Note</span>
            <Input
              accessibilityLabel="Transaction note"
              placeholder="What was this for?"
              value={description}
              onChangeText={setDescription}
              maxLength={120}
            />
          </label>
          {type === 'expense' && (
            <Link
              className="finance-secondary-action"
              href="/split/new"
              style={{ justifyContent: 'space-between', minHeight: 68, paddingInline: 16 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                  }}
                >
                  <UsersRound size={19} />
                </span>
                <span style={{ display: 'grid', gap: 2 }}>
                  <strong>Split this expense</strong>
                  <span className="finance-muted">Choose people and shares</span>
                </span>
              </span>
              <ArrowRight size={18} />
            </Link>
          )}
        </section>
        {!accountLoading && accounts.length === 0 && (
          <p className="finance-muted">
            <Link className="finance-inline-link" href="/account/new">
              Add an account before recording a transaction.
            </Link>
          </p>
        )}
        {!categoryLoading && type !== 'transfer' && categories.length === 0 && (
          <p className="finance-muted">
            <Link className="finance-inline-link" href="/category/new">
              Add a category before recording a transaction.
            </Link>
          </p>
        )}
        {dataError && (
          <p className="finance-form-error" role="alert">
            Transaction options could not be opened: {dataError}
          </p>
        )}
        {error && (
          <p className="finance-form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={
            saving || !amountValid || !source || (type === 'transfer' ? !destination : !category)
          }
        >
          <ReceiptText size={18} /> {saving ? 'Saving…' : `Save ${type}`}
        </Button>
      </form>
      <Sheet
        visible={picker !== null}
        onClose={() => setPicker(null)}
        title={
          picker === 'date'
            ? 'Choose date'
            : picker === 'category'
              ? 'Choose category'
              : picker === 'destination'
                ? 'Choose destination'
                : 'Choose account'
        }
      >
        {picker === 'date' ? (
          <DateTimePicker value={occurredAt} showTime={showTime} onChange={setOccurredAt} />
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {picker === 'category'
                ? categories.map((item) => (
                    <React.Fragment key={idOf(item)}>
                      <SettingsRow
                        label={item.name ?? 'Category'}
                        leadingIcon={
                          <CategoryIcon label={item.name ?? 'Category'} icon={item.icon} />
                        }
                        value={
                          category && aliasesOf(category).some((id) => aliasesOf(item).includes(id))
                            ? 'Selected'
                            : undefined
                        }
                        onPress={() => {
                          setCategoryId(idOf(item));
                          setPicker(null);
                        }}
                      />
                      <div style={{ borderTop: '1px solid var(--finance-line)' }} />
                    </React.Fragment>
                  ))
                : accounts
                    .filter(
                      (item) =>
                        picker !== 'destination' ||
                        (!!source &&
                          item.currency === source.currency &&
                          !aliasesOf(item).some((alias) => aliasesOf(source).includes(alias))),
                    )
                    .map((item) => (
                      <React.Fragment key={idOf(item)}>
                        <SettingsRow
                          label={item.name ?? 'Account'}
                          value={`${item.currency ?? 'INR'}${
                            (picker === 'destination' ? destination : source) &&
                            aliasesOf(picker === 'destination' ? destination! : source!).some(
                              (id) => aliasesOf(item).includes(id),
                            )
                              ? ' · Selected'
                              : ''
                          }`}
                          onPress={() => {
                            if (picker === 'destination') setDestinationId(idOf(item));
                            else {
                              setAccountId(idOf(item));
                              setDestinationId('');
                            }
                            setPicker(null);
                          }}
                        />
                        <div style={{ borderTop: '1px solid var(--finance-line)' }} />
                      </React.Fragment>
                    ))}
              {(picker === 'category' ? categoryLoading : accountLoading) && (
                <Typography variant="small">
                  Loading {picker === 'category' ? 'categories' : 'accounts'}…
                </Typography>
              )}
              {picker === 'category' && !categoryLoading && categories.length === 0 && (
                <div style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: 18 }}>
                  <CategoryIcon label="Category" />
                  <Typography variant="bodyLarge">No categories yet</Typography>
                  <Typography variant="small">
                    Create a category to organize this transaction.
                  </Typography>
                </div>
              )}
              {picker !== 'category' &&
                !accountLoading &&
                (picker === 'destination'
                  ? accounts.filter(
                      (item) =>
                        !!source &&
                        item.currency === source.currency &&
                        !aliasesOf(item).some((alias) => aliasesOf(source).includes(alias)),
                    ).length === 0
                  : accounts.length === 0) && (
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: 18 }}>
                    <Typography variant="bodyLarge">No accounts yet</Typography>
                    <Typography variant="small">
                      Add an account before recording this transaction.
                    </Typography>
                  </div>
                )}
            </div>
            {picker === 'category' && (
              <Button
                variant="outline"
                onPress={() => {
                  setPicker(null);
                  router.push(categories.length === 0 ? '/category/new' : '/category');
                }}
              >
                {categories.length === 0 ? 'Create category' : 'Manage categories'}
              </Button>
            )}
            {picker === 'account' && (
              <Button
                variant="outline"
                onPress={() => {
                  setPicker(null);
                  router.push('/account/new');
                }}
              >
                Add account
              </Button>
            )}
            {(picker === 'category' || picker === 'account') && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(picker === 'account' ? source : category) &&
                  !(picker === 'account' ? isDefaultAccount : isDefaultCategory) && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingDefault || !profile}
                      onPress={() => void toggleDefault(picker)}
                    >
                      {savingDefault ? 'Saving…' : 'Set as default'}
                    </Button>
                  )}
                {(picker === 'account' ? isDefaultAccount : isDefaultCategory) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={savingDefault || !profile}
                    onPress={() => void toggleDefault(picker)}
                  >
                    Clear default
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
