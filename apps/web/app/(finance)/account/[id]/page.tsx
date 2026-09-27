'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, ReceiptText } from 'lucide-react';
import { Button, Empty, IconButton, Input, Label, Separator, Sheet, Typography } from '@finapp/ui/web';
import { Money, TransactionRow, type TransactionType } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  asMinor,
  belongsToUser,
  idOf,
  matchesId,
  localDependency,
  SignInGate,
} from '../../_personal';

type Account = LocalRecord & {
  name?: string;
  type?: string;
  customType?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
  archivedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  icon?: string;
  color?: string;
  isIncludedInTotal?: boolean;
};
type Category = LocalRecord & { name?: string; icon?: string };
type Transaction = LocalRecord & {
  accountId?: string;
  transferAccountId?: string;
  categoryId?: string;
  groupId?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  title?: string;
  note?: string;
  occurredAt?: number;
  status?: string;
  deletedAt?: number;
};

const ACCOUNT_TYPES = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  wallet: 'Wallet',
  loan: 'Loan',
  other: 'Other',
} as const;
export default function PersonalAccountDetailPage() {

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, isConnected, fetchTransactionRange } = useBrowserSync();
  const timelineRange = React.useMemo(() => {
    const endAt = Date.now() + 1;
    return { startAt: endAt - 30 * 86_400_000, endAt };
  }, []);
  const { records, loading, error } = useLocalRecords<Account>('account');
  const {
    records: transactions,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const { records: categories } = useLocalRecords<Category>('category');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const account = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const [name, setName] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [rangeError, setRangeError] = React.useState('');
  React.useEffect(() => setName(account?.name ?? ''), [account?.name, routeId]);
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    let active = true;
    setRangeError('');
    void fetchTransactionRange(timelineRange.startAt, timelineRange.endAt).catch(
      (cause: unknown) => {
        if (active)
          setRangeError(
            cause instanceof Error ? cause.message : 'Could not refresh recent activity.',
          );
      },
    );
    return () => {
      active = false;
    };
  }, [fetchTransactionRange, isConnected, timelineRange, userId]);
  const ids = new Set(account ? aliasesOf(account) : []);
  const matchingActivity = transactions
    .filter(
      (item) =>
        item.status === 'posted' &&
        item.deletedAt === undefined &&
        (ids.has(String(item.accountId ?? '')) || ids.has(String(item.transferAccountId ?? ''))),
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const activity = matchingActivity
    .filter((item) => {
      const occurredAt = Number(item.occurredAt ?? 0);
      return occurredAt >= timelineRange.startAt && occurredAt < timelineRange.endAt;
    })
    .slice(0, 50);
  const optimisticDelta = matchingActivity.reduce((delta, transaction) => {
    if (typeof transaction.clientUpdatedAt !== 'number') return delta;
    const amount = asMinor(transaction.amountMinor);
    const source = ids.has(String(transaction.accountId ?? ''))
      ? transaction.type === 'expense' || transaction.type === 'transfer'
        ? -amount
        : amount
      : 0n;
    const destination =
      transaction.type === 'transfer' && ids.has(String(transaction.transferAccountId ?? ''))
        ? amount
        : 0n;
    return delta + source + destination;
  }, 0n);
  const localId = account ? idOf(account) : '';
  const accountId = account ? String(account._id ?? account.cloudId ?? account.id ?? '') : '';
  const accountDependency = account ? localDependency('account', account) : null;
  const pageHeader = (
    <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} aria-hidden="true" />
      </IconButton>
      <Typography variant="heading" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {account?.name ?? 'Account'}
      </Typography>
    </header>
  );

  async function updateName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !account || pending) return;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot be renamed.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setFormError('Enter an account name.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.rename',
        { ...account, name: trimmed },
        { accountId, name: trimmed },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      setEditing(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not rename this account.');
    } finally {
      setPending(false);
    }
  }

  async function archive() {
    if (!userId || !account || pending) return;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot be archived.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.archive',
        { ...account, archivedAt: Date.now() },
        { accountId },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      setConfirmingArchive(false);
      router.replace('/account');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not archive this account.');
    } finally {
      setPending(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="ACCOUNT DETAIL" title="Your account stays private.">
        Sign in to open account details in this browser workspace.
      </SignInGate>
    );
  if (loading || transactionLoading)
    return (
      <div className="finance-page" style={{ gap: 28 }}>
        {pageHeader}
        <Typography variant="small">Loading account…</Typography>
      </div>
    );
  if (error)
    return (
      <div className="finance-page" style={{ gap: 28 }}>
        {pageHeader}
        <p className="finance-form-error" role="alert">
          Account data could not be opened: {error}
        </p>
      </div>
    );
  if (!account)
    return (
      <div className="finance-page" style={{ gap: 28 }}>
        {pageHeader}
        <Empty
          title="Account unavailable."
          description="This account could not be found or is no longer available."
        />
      </div>
    );
  const currency = account.currency ?? 'INR';
  const balance = asMinor(account.balanceMinor ?? account.openingBalanceMinor) + optimisticDelta;
  const accountType =
    account.type === 'other' && account.customType
      ? account.customType
      : account.type && account.type in ACCOUNT_TYPES
        ? ACCOUNT_TYPES[account.type as keyof typeof ACCOUNT_TYPES]
        : 'Account';

  return (
    <div className="finance-page" style={{ gap: 28 }}>
      {pageHeader}

      <section style={{ display: 'grid', gap: 8 }}>
        <Money amountMinor={balance} currency={currency} size="display" />
        <Typography variant="caption">Current balance · {currency}</Typography>
      </section>

      <section style={{ display: 'grid', gap: 8 }}>
        <Typography variant="title">{account.name ?? 'Account'}</Typography>
        <Typography variant="small">
          {accountType} · {currency}
        </Typography>
        <Typography variant="caption">
          {account.isIncludedInTotal
            ? 'Included in total balance'
            : 'Excluded from total balance'}
        </Typography>
        {account.icon ? <Typography variant="caption">Icon: {account.icon}</Typography> : null}
        {account.color ? <Typography variant="caption">Color: {account.color}</Typography> : null}
        {typeof account.createdAt === 'number' && Number.isFinite(account.createdAt) ? (
          <Typography variant="caption">
            Added {new Date(account.createdAt).toLocaleDateString()}
          </Typography>
        ) : null}
        {account.archivedAt === undefined ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            <Button
              size="sm"
              variant="outline"
              onPress={() => {
                setName(account.name ?? '');
                setFormError(null);
                setEditing(true);
              }}
            >
              Rename
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onPress={() => {
                setFormError(null);
                setConfirmingArchive(true);
              }}
            >
              Archive
            </Button>
          </div>
        ) : null}
      </section>

      {formError && (
        <p className="finance-form-error" role="alert">
          {formError}
        </p>
      )}

      {account.archivedAt !== undefined && (
        <Typography variant="small">
          Archived accounts remain available for reference and cannot receive new transactions.
        </Typography>
      )}

      <section style={{ display: 'grid', gap: 10 }}>
        <Typography variant="heading">Recent activity</Typography>
        {transactionError && (
          <p className="finance-form-error" role="alert">
            Saved activity could not be refreshed: {transactionError}
          </p>
        )}
        {rangeError && (
          <Typography variant="small" role="status">
            Recent activity refresh unavailable. Showing records already saved in this browser.
          </Typography>
        )}
        {activity.length === 0 ? (
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10, paddingBlock: 24 }}>
            <ReceiptText size={28} aria-hidden="true" />
            <Typography variant="bodyLarge">No posted activity yet</Typography>
            <Typography variant="small" style={{ textAlign: 'center' }}>
              Record a transaction to see it here.
            </Typography>
            <Button
              size="sm"
              variant="outline"
              onPress={() =>
                router.push(`/transaction/new?accountId=${encodeURIComponent(routeId ?? '')}`)
              }
            >
              Add transaction
            </Button>
          </div>
        ) : (
          <div>
            {activity.map((transaction, index) => {
              const isTransfer = transaction.type === 'transfer';
              const isOutgoing = ids.has(String(transaction.accountId ?? ''));
              const category = categories.find((item) =>
                aliasesOf(item).includes(String(transaction.categoryId ?? '')),
              );
              const id = idOf(transaction);
              const rowType = isTransfer
                ? isOutgoing
                  ? 'expense'
                  : 'income'
                : (transaction.type as TransactionType);
              const rowTitle = isTransfer
                ? `${isOutgoing ? 'Transfer out' : 'Transfer in'} · ${transaction.title ?? 'Transfer'}`
                : (transaction.title ?? transaction.type ?? 'Transaction');
              return (
                <React.Fragment key={id}>
                  <TransactionRow
                    title={rowTitle}
                    category={category?.name}
                    categoryIcon={category?.icon}
                    date={
                      transaction.occurredAt
                        ? new Date(transaction.occurredAt).toLocaleDateString()
                        : 'Date unavailable'
                    }
                    status={transaction.status}
                    amountMinor={asMinor(transaction.amountMinor)}
                    currency={transaction.currency ?? currency}
                    type={rowType}
                    semanticType={
                      transaction.groupId ? 'split' : isTransfer ? 'transfer' : undefined
                    }
                    onPress={() => router.push(`/transaction/${encodeURIComponent(id)}`)}
                  />
                  {index < activity.length - 1 && <Separator />}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>

      <Sheet visible={editing} title="Rename account" onClose={() => setEditing(false)}>
        <form onSubmit={updateName} style={{ display: 'grid', gap: 12 }}>
          <Label htmlFor="account-name">Account name</Label>
          <Input
            id="account-name"
            accessibilityLabel="Account name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            autoFocus
            required
          />
          {formError && (
            <p className="finance-form-error" role="alert">
              {formError}
            </p>
          )}
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? 'Saving…' : 'Save name'}
          </Button>
          <Button type="button" variant="outline" onPress={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </Sheet>

      <Sheet
        visible={confirmingArchive}
        title="Archive account?"
        onClose={() => setConfirmingArchive(false)}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <Typography variant="small">
            Past transactions and balances remain in your history. This account will no longer be
            available for new activity.
          </Typography>
          {formError && (
            <p className="finance-form-error" role="alert">
              {formError}
            </p>
          )}
          <Button variant="destructive" disabled={pending} onPress={() => void archive()}>
            {pending ? 'Archiving…' : `Archive ${account.name ?? 'account'}`}
          </Button>
          <Button variant="outline" onPress={() => setConfirmingArchive(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
