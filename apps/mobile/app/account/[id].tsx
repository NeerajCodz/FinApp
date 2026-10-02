import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AccountDetailView } from '@finapp/ui/finance';
import type { AccountActivityEntry } from '@finapp/ui/finance';
import { formatTransactionDate } from '@finapp/ui/finance';
import type { TransactionType } from '@finapp/ui/finance';
import { Button, Empty, Typography, useTheme } from '@finapp/ui/native';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recordIndex } from '@/lib/ledger';

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
  createdAt?: number;
  updatedAt?: number;
  isIncludedInTotal?: boolean;
  icon?: string;
  color?: string;
};
type TransactionRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  accountId: string;
  transferAccountId?: string;
  categoryId?: string;
  groupId?: string;
  type: 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
  amountMinor: bigint;
  currency: string;
  title: string;
  occurredAt: number;
  hasTime?: boolean;
  status: string;
  deletedAt?: number;
  clientUpdatedAt?: number;
};

export default function AccountDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, fetchTransactionRange } = useLocalSync();
  const [timelineRange] = useState(() => {
    const endAt = Date.now() + 1;
    return { startAt: endAt - 30 * 86_400_000, endAt };
  });
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
  const profileState = useLocalRecords<LocalRecord & { timezone?: string }>(userId, 'profile');
  const timeZone = profileState.data?.[0]?.timezone;
  const localTransactions = useLocalRecords<TransactionRecord>(userId, 'transaction');
  const transactionRange = useLocalTransactionRange<TransactionRecord>(
    userId,
    timelineRange.startAt,
    timelineRange.endAt,
    fetchTransactionRange,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const account = accountState.data?.find(
    (record) =>
      record.archivedAt === undefined &&
      (record.id === id || record._id === id || record.cloudId === id),
  );
  const accountIds = useMemo(
    () =>
      new Set(
        [id, account?.id, account?._id, account?.cloudId].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
      ),
    [id, account],
  );
  const accountTransactions = useMemo(
    () =>
      (transactionRange.data ?? [])
        .filter(
          (transaction) =>
            transaction.status === 'posted' &&
            transaction.deletedAt === undefined &&
            (accountIds.has(transaction.accountId) ||
              (transaction.type === 'transfer' &&
                !!transaction.transferAccountId &&
                accountIds.has(transaction.transferAccountId))),
        )
        .sort((left, right) => right.occurredAt - left.occurredAt),
    [transactionRange.data, accountIds],
  );
  const flowActivity = accountTransactions.map((transaction) => {
    const isOutgoing = accountIds.has(transaction.accountId);
    return {
      occurredAt: transaction.occurredAt,
      cashFlowMinor:
        transaction.type === 'transfer'
          ? isOutgoing
            ? -transaction.amountMinor
            : transaction.amountMinor
          : transaction.type === 'expense'
            ? -transaction.amountMinor
            : transaction.amountMinor,
    };
  });
  const balanceMinor =
    (account?.balanceMinor ?? account?.openingBalanceMinor ?? 0n) +
    (localTransactions.data ?? []).reduce((delta, transaction) => {
      if (
        typeof transaction.clientUpdatedAt !== 'number' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined
      )
        return delta;
      const sourceDelta = accountIds.has(transaction.accountId)
        ? transaction.type === 'expense' || transaction.type === 'transfer'
          ? -transaction.amountMinor
          : transaction.amountMinor
        : 0n;
      const destinationDelta =
        transaction.type === 'transfer' &&
        transaction.transferAccountId &&
        accountIds.has(transaction.transferAccountId)
          ? transaction.amountMinor
          : 0n;
      return delta + sourceDelta + destinationDelta;
    }, 0n);
  const activity: AccountActivityEntry[] = accountTransactions.slice(0, 50).map((transaction) => {
    const isTransfer = transaction.type === 'transfer';
    const isOutgoing = accountIds.has(transaction.accountId);
    const category = categories.get(transaction.categoryId ?? '');
    const cashFlowMinor = isTransfer
      ? isOutgoing
        ? -transaction.amountMinor
        : transaction.amountMinor
      : transaction.type === 'expense'
        ? -transaction.amountMinor
        : transaction.amountMinor;
    const type: TransactionType = isTransfer
      ? isOutgoing
        ? 'expense'
        : 'income'
      : transaction.type;
    const transactionId = String(transaction._id ?? transaction.id ?? transaction.cloudId ?? '');
    return {
      id: transactionId,
      title: isTransfer
        ? `${isOutgoing ? 'Transfer out' : 'Transfer in'} · ${transaction.title}`
        : transaction.title,
      category: typeof category?.name === 'string' ? category.name : undefined,
      categoryIcon: typeof category?.icon === 'string' ? category.icon : undefined,
      date: formatTransactionDate(transaction.occurredAt, transaction.hasTime, timeZone),
      status: transaction.status,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      type,
      semanticType: transaction.groupId ? 'split' : isTransfer ? 'transfer' : undefined,
      occurredAt: transaction.occurredAt,
      cashFlowMinor,
    };
  });
  const accountLocalId = account?.id ?? account?._id ?? account?.cloudId;
  const operationAccountId = account?._id ?? account?.cloudId ?? account?.id;

  async function writeAccount(
    operation: 'account.rename' | 'account.setIcon' | 'account.setColor' | 'account.archive',
    record: LocalRecord,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    if (!account || !userId || !accountLocalId || !operationAccountId || pending) return false;
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'account',
        operation,
        record,
        { accountId: operationAccountId, ...payload },
        {
          recordId: accountLocalId,
          dependencies: account._id || account.cloudId ? [] : [`account:${operationAccountId}`],
          baseUpdatedAt: account.updatedAt,
        },
      );
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : `Could not save this account ${operation === 'account.setColor' ? 'color' : 'change'}.`,
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  async function renameAccount(name: string): Promise<boolean> {
    if (!account) return false;
    return writeAccount('account.rename', { ...account, name }, { name });
  }
  async function setAccountIcon(icon: string | null): Promise<void> {
    if (!account) return;
    await writeAccount('account.setIcon', { ...account, icon: icon ?? undefined }, { icon });
  }
  async function setAccountColor(color: string | null): Promise<void> {
    if (!account) return;
    await writeAccount('account.setColor', { ...account, color: color ?? undefined }, { color });
  }
  async function archiveAccount(): Promise<boolean> {
    if (!account) return false;
    const didArchive = await writeAccount(
      'account.archive',
      { ...account, archivedAt: Date.now() },
      {},
    );
    if (didArchive) router.replace('/accounts' as never);
    return didArchive;
  }

  if (accountState.error) throw accountState.error;
  if (localTransactions.error) throw localTransactions.error;
  if (transactionRange.error && !transactionRange.data) throw transactionRange.error;
  const isLoading = accountState.loading || localTransactions.loading || transactionRange.loading;

  if (!id) {
    return <Empty title="Account unavailable." description="This account could not be found." />;
  }
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: tokens.background,
        }}
      >
        <Typography variant="small">Loading account…</Typography>
      </View>
    );
  }
  if (!account) {
    return (
      <Empty
        title="Account unavailable."
        description="This account could not be found or is no longer available."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      {account.archivedAt === undefined ? (
        <Button
          variant="outline"
          onPress={() =>
            router.push(`/account/${encodeURIComponent(String(accountLocalId))}/edit` as never)
          }
        >
          Edit details
        </Button>
      ) : null}
      <AccountDetailView
        account={{
          id: String(accountLocalId),
          name: account.name,
          type: account.type,
          customType: account.customType,
          currency: account.currency,
          balanceMinor,
          icon: account.icon,
          color: account.color,
          isIncludedInTotal: account.isIncludedInTotal === true,
          archivedAt: account.archivedAt,
        }}
        activity={activity}
        flowActivity={flowActivity}
        isBusy={pending}
        error={error}
        rangeNotice={transactionRange.error?.message}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onRename={renameAccount}
        onArchive={archiveAccount}
        onSetIcon={(icon) => void setAccountIcon(icon)}
        onSetColor={(color) => void setAccountColor(color)}
        onBack={() => router.back()}
        onAddTransaction={() =>
          router.push({ pathname: '/transaction/new', params: { accountId: id } } as never)
        }
        onOpenTransaction={(transactionId) =>
          router.push(`/transaction/${encodeURIComponent(transactionId)}` as never)
        }
      />
    </View>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        gap: 12,
        padding: 24,
        backgroundColor: tokens.background,
      }}
    >
      <Typography variant="heading">Could not load this account.</Typography>
      <Typography variant="small">{error.message}</Typography>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
