'use client';

import { useRouter } from 'next/navigation';
import { AccountsIndexView } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { aliasesOf, asMinor, belongsToUser, idOf, SignInGate } from '../_personal';

type Account = LocalRecord & {
  name?: string;
  type?: string;
  customType?: string;
  currency?: string;
  balanceMinor?: bigint | number | string;
  openingBalanceMinor?: bigint | number | string;
  archivedAt?: number;
  icon?: string;
  color?: string;
  isIncludedInTotal?: boolean;
};

type Transaction = LocalRecord & {
  accountId?: string;
  transferAccountId?: string;
  amountMinor?: bigint | number | string;
  type?: string;
  status?: string;
  deletedAt?: number;
  clientUpdatedAt?: number;
};

export default function AccountsPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const {
    records: accountRecords,
    loading: accountLoading,
    error: accountError,
  } = useLocalRecords<Account>('account');
  const {
    records: transactionRecords,
    loading: transactionLoading,
    error: transactionError,
  } = useLocalRecords<Transaction>('transaction');
  const error = accountError ?? transactionError;

  if (!userId) {
    return (
      <SignInGate eyebrow="ACCOUNTS" title="Your money, organized.">
        Sign in to see accounts saved in your private browser workspace.
      </SignInGate>
    );
  }

  const accounts = accountRecords
    .filter((record) => belongsToUser(record, userId) && record.archivedAt === undefined)
    .map((record) => {
      const accountId = idOf(record);
      const ids = new Set(aliasesOf(record));
      const optimisticDelta = transactionRecords.reduce((delta, transaction) => {
        if (
          !ids.size ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined ||
          typeof transaction.clientUpdatedAt !== 'number'
        )
          return delta;
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
      return {
        id: accountId,
        name: record.name ?? 'Account',
        type: record.type ?? 'other',
        customType: record.customType,
        currency: record.currency ?? 'INR',
        balanceMinor: asMinor(record.balanceMinor ?? record.openingBalanceMinor) + optimisticDelta,
        icon: record.icon,
        color: record.color,
        isIncludedInTotal: record.isIncludedInTotal === true,
      };
    })
    .filter((account) => account.id.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
  const totalsByCurrency = new Map<string, bigint>();
  for (const account of accounts) {
    if (!account.isIncludedInTotal) continue;
    totalsByCurrency.set(
      account.currency,
      (totalsByCurrency.get(account.currency) ?? 0n) + account.balanceMinor,
    );
  }
  const totals = [...totalsByCurrency]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amountMinor]) => ({ currency, amountMinor }));

  return (
    <AccountsIndexView
      accounts={accounts}
      totals={totals}
      loading={accountLoading || (accounts.length > 0 && transactionLoading)}
      error={error}
      onRetry={() => window.location.reload()}
      onAddAccount={() => router.push('/account/new')}
      onOpenAccount={(id) => router.push(`/account/${encodeURIComponent(id)}`)}
    />
  );
}
