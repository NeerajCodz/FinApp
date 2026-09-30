'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Empty, Typography } from '@finapp/ui/web';
import { AccountDetailView } from '@finapp/ui/finance';
import type { AccountActivityEntry } from '@finapp/ui/finance';
import { formatTransactionDate } from '@finapp/ui/finance';
import type { TransactionType } from '@finapp/ui/finance';
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
type Profile = LocalRecord & { timezone?: string };
type Transaction = LocalRecord & {
  accountId?: string;
  transferAccountId?: string;
  categoryId?: string;
  groupId?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  title?: string;
  type?: string;
  status?: string;
  occurredAt?: number;
  hasTime?: boolean;
  deletedAt?: number;
  clientUpdatedAt?: number;
};

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
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const timeZone = profiles[0]?.timezone;
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const account = records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [rangeError, setRangeError] = React.useState('');
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

  const accountAliases = new Set(account ? aliasesOf(account) : []);
  const matchingActivity = transactions
    .filter(
      (item) =>
        item.status === 'posted' &&
        item.deletedAt === undefined &&
        (accountAliases.has(String(item.accountId ?? '')) ||
          accountAliases.has(String(item.transferAccountId ?? ''))),
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  const rangeTransactions = matchingActivity.filter((item) => {
    const occurredAt = Number(item.occurredAt ?? 0);
    return occurredAt >= timelineRange.startAt && occurredAt < timelineRange.endAt;
  });
  const flowActivity = rangeTransactions.map((item) => {
    const isTransfer = item.type === 'transfer';
    const isOutgoing = accountAliases.has(String(item.accountId ?? ''));
    const amountMinor = asMinor(item.amountMinor);
    return {
      occurredAt: Number(item.occurredAt ?? 0),
      cashFlowMinor: isTransfer
        ? isOutgoing
          ? -amountMinor
          : amountMinor
        : item.type === 'expense'
          ? -amountMinor
          : amountMinor,
    };
  });
  const activity: AccountActivityEntry[] = rangeTransactions.slice(0, 50).map((item) => {
    const isTransfer = item.type === 'transfer';
    const isOutgoing = accountAliases.has(String(item.accountId ?? ''));
    const category = categories.find((candidate) =>
      aliasesOf(candidate).includes(String(item.categoryId ?? '')),
    );
    const amountMinor = asMinor(item.amountMinor);
    const cashFlowMinor = isTransfer
      ? isOutgoing
        ? -amountMinor
        : amountMinor
      : item.type === 'expense'
        ? -amountMinor
        : amountMinor;
    const rowType: TransactionType = isTransfer
      ? isOutgoing
        ? 'expense'
        : 'income'
      : (item.type as TransactionType);
    const id = idOf(item);
    return {
      id,
      title: isTransfer
        ? `${isOutgoing ? 'Transfer out' : 'Transfer in'} · ${item.title ?? 'Transfer'}`
        : (item.title ?? item.type ?? 'Transaction'),
      category: category?.name,
      categoryIcon: category?.icon,
      date: item.occurredAt
        ? formatTransactionDate(item.occurredAt, item.hasTime, timeZone)
        : 'Date unavailable',
      status: item.status,
      amountMinor,
      currency: item.currency ?? account?.currency ?? 'INR',
      type: rowType,
      semanticType: item.groupId ? 'split' : isTransfer ? 'transfer' : undefined,
      occurredAt: Number(item.occurredAt ?? 0),
      cashFlowMinor,
    };
  });

  const localId = account ? idOf(account) : '';
  const accountId = account ? String(account._id ?? account.cloudId ?? account.id ?? '') : '';
  const accountDependency = account ? localDependency('account', account) : null;

  async function updateName(name: string): Promise<boolean> {
    if (!userId || !account || pending) return false;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot be renamed.');
      return false;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.rename',
        { ...account, name },
        { accountId, name },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
      return true;
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not rename this account.');
      return false;
    } finally {
      setPending(false);
    }
  }

  async function updateIcon(icon: string | null): Promise<void> {
    if (!userId || !account || pending) return;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot update its icon.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.setIcon',
        { ...account, icon: icon ?? undefined },
        { accountId, icon },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this account icon.');
    } finally {
      setPending(false);
    }
  }

  async function updateColor(color: string | null): Promise<void> {
    if (!userId || !account || pending) return;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot update its color.');
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.setColor',
        { ...account, color: color ?? undefined },
        { accountId, color },
        {
          recordId: localId,
          dependencies: accountDependency ? [accountDependency] : [],
          baseUpdatedAt: typeof account.updatedAt === 'number' ? account.updatedAt : undefined,
        },
      );
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not update this account color.');
    } finally {
      setPending(false);
    }
  }

  async function archive(): Promise<boolean> {
    if (!userId || !account || pending) return false;
    if (!accountId) {
      setFormError('This account has no saved identifier and cannot be archived.');
      return false;
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
      router.replace('/accounts');
      return true;
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not archive this account.');
      return false;
    } finally {
      setPending(false);
    }
  }

  if (!userId) {
    return (
      <SignInGate eyebrow="ACCOUNT DETAIL" title="Your account stays private.">
        Sign in to open account details in this browser workspace.
      </SignInGate>
    );
  }
  if (loading || transactionLoading) {
    return (
      <div className="finance-page" style={{ gap: 28 }}>
        <Typography variant="small">Loading account…</Typography>
      </div>
    );
  }
  if (error) {
    return (
      <div className="finance-page" style={{ gap: 28 }}>
        <p className="finance-form-error" role="alert">
          Account data could not be opened: {error}
        </p>
      </div>
    );
  }
  if (!account) {
    return (
      <div className="finance-page" style={{ gap: 28 }}>
        <Empty
          title="Account unavailable."
          description="This account could not be found or is no longer available."
        />
      </div>
    );
  }

  const currency = account.currency ?? 'INR';
  const optimisticDelta = matchingActivity.reduce((delta, transaction) => {
    if (typeof transaction.clientUpdatedAt !== 'number') return delta;
    const amount = asMinor(transaction.amountMinor);
    const source = accountAliases.has(String(transaction.accountId ?? ''))
      ? transaction.type === 'expense' || transaction.type === 'transfer'
        ? -amount
        : amount
      : 0n;
    const destination =
      transaction.type === 'transfer' &&
      accountAliases.has(String(transaction.transferAccountId ?? ''))
        ? amount
        : 0n;
    return delta + source + destination;
  }, 0n);

  return (
    <AccountDetailView
      account={{
        id: idOf(account),
        name: account.name ?? 'Account',
        type: account.type ?? 'other',
        customType: account.customType,
        currency,
        balanceMinor:
          asMinor(account.balanceMinor ?? account.openingBalanceMinor) + optimisticDelta,
        icon: account.icon,
        color: account.color,
        isIncludedInTotal: account.isIncludedInTotal === true,
        createdAt: account.createdAt,
        archivedAt: account.archivedAt,
      }}
      activity={activity}
      flowActivity={flowActivity}
      isBusy={pending}
      error={
        formError ??
        (transactionError ? `Saved activity could not be refreshed: ${transactionError}` : null)
      }
      rangeNotice={
        rangeError
          ? 'Recent activity refresh unavailable. Showing records already saved in this browser.'
          : null
      }
      onRename={updateName}
      onArchive={archive}
      onSetIcon={(icon) => void updateIcon(icon)}
      onSetColor={(color) => void updateColor(color)}
      onAddTransaction={() =>
        router.push(`/transaction/new?accountId=${encodeURIComponent(routeId ?? '')}`)
      }
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
    />
  );
}
