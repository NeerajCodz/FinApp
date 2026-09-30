import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Typography, useTheme } from '@finapp/ui/native';
import { AccountsIndexView } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { displayAccountName } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type AccountRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name: string;
  type: string;
  customType?: string;
  currency: string;
  balanceMinor?: bigint;
  openingBalanceMinor?: bigint;
  archivedAt?: number;
  icon?: string;
  color?: string;
  isIncludedInTotal?: boolean;
};
type AccountTransaction = LocalRecord & {
  accountId: string;
  transferAccountId?: string;
  amountMinor: bigint;
  status: string;
  deletedAt?: number;
  clientUpdatedAt?: number;
  type: string;
};

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const transactionState = useLocalRecords<AccountTransaction>(userId, 'transaction');
  if (accountState.error) throw accountState.error;
  if (transactionState.error) throw transactionState.error;

  const accounts = (accountState.data ?? [])
    .filter((account) => account.archivedAt === undefined && (account.id ?? account._id ?? account.cloudId) !== undefined)
    .sort((left, right) => displayAccountName(left.name).localeCompare(displayAccountName(right.name)))
    .map((account) => {
      const id = account.id ?? account._id ?? account.cloudId!;
      const ids = new Set([account.id, account._id, account.cloudId].filter((value): value is string => typeof value === 'string' && value.length > 0));
      const optimisticDelta = (transactionState.data ?? []).reduce((delta, transaction) => {
        if (typeof transaction.clientUpdatedAt !== 'number' || transaction.status !== 'posted' || transaction.deletedAt !== undefined) return delta;
        const sourceDelta = ids.has(transaction.accountId)
          ? transaction.type === 'expense' || transaction.type === 'transfer' ? -transaction.amountMinor : transaction.amountMinor
          : 0n;
        const destinationDelta = transaction.type === 'transfer' && transaction.transferAccountId && ids.has(transaction.transferAccountId)
          ? transaction.amountMinor
          : 0n;
        return delta + sourceDelta + destinationDelta;
      }, 0n);
      return {
        id,
        name: displayAccountName(account.name),
        type: account.type,
        customType: account.customType,
        currency: account.currency,
        balanceMinor: (account.balanceMinor ?? account.openingBalanceMinor ?? 0n) + optimisticDelta,
        icon: account.icon,
        color: account.color,
        isIncludedInTotal: account.isIncludedInTotal === true,
      };
    });
  const totalsByCurrency = new Map<string, bigint>();
  for (const account of accounts) {
    if (!account.isIncludedInTotal) continue;
    totalsByCurrency.set(account.currency, (totalsByCurrency.get(account.currency) ?? 0n) + account.balanceMinor);
  }
  const totals = [...totalsByCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, amountMinor]) => ({ currency, amountMinor }));

  return (
    <AccountsIndexView
      accounts={accounts}
      totals={totals}
      loading={accountState.loading || (accounts.length > 0 && transactionState.loading)}
      topInset={insets.top}
      bottomInset={insets.bottom}
      onRetry={() => router.replace('/accounts' as never)}
      onAddAccount={() => router.push('/account/new' as never)}
      onOpenAccount={(id) => router.push({ pathname: '/account/[id]', params: { id } } as never)}
    />
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 12, padding: 24, backgroundColor: tokens.background }}>
      <Typography variant="heading">Could not load accounts.</Typography>
      <Typography variant="small">{error.message}</Typography>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
