import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ReceiptText } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useLocalRecords, useLocalTransactionRange } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import { displayAccountName, recordIndex } from '@/lib/ledger';
import {
  Button,
  Empty,
  IconButton,
  Input,
  Label,
  Separator,
  Sheet,
  Typography,
} from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';

const ACCOUNT_TYPES = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  wallet: 'Wallet',
  loan: 'Loan',
  other: 'Other',
} as const;
type AccountRecord = LocalRecord & {
  id?: string;
  _id?: string;
  cloudId?: string;
  name: string;
  type: keyof typeof ACCOUNT_TYPES;
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
  const localTransactions = useLocalRecords<TransactionRecord>(userId, 'transaction');
  const transactionRange = useLocalTransactionRange<TransactionRecord>(
    userId,
    timelineRange.startAt,
    timelineRange.endAt,
    fetchTransactionRange,
  );
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
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
        .sort((left, right) => right.occurredAt - left.occurredAt)
        .slice(0, 50),
    [transactionRange.data, accountIds],
  );
  const balanceMinor =
    (account?.balanceMinor ?? account?.openingBalanceMinor ?? 0n) +
    (localTransactions.data ?? []).reduce((delta, transaction) => {
      if (
        typeof transaction.clientUpdatedAt !== 'number' ||
        transaction.status !== 'posted' ||
        transaction.deletedAt !== undefined
      )
        return delta;
      const amount = transaction.amountMinor;
      const sourceDelta = accountIds.has(transaction.accountId)
        ? transaction.type === 'expense' || transaction.type === 'transfer'
          ? -amount
          : amount
        : 0n;
      const destinationDelta =
        transaction.type === 'transfer' &&
        transaction.transferAccountId &&
        accountIds.has(transaction.transferAccountId)
          ? amount
          : 0n;
      return delta + sourceDelta + destinationDelta;
    }, 0n);

  async function saveName() {
    if (!account || !userId || !name.trim() || pending) return;
    const localRecordId = account.id ?? account._id ?? account.cloudId;
    const operationAccountId = account._id ?? account.cloudId ?? account.id;
    if (!localRecordId || !operationAccountId) return;
    const trimmedName = name.trim();
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.rename',
        { ...account, name: trimmedName },
        { accountId: operationAccountId, name: trimmedName },
        {
          recordId: localRecordId,
          dependencies: account._id || account.cloudId ? [] : [`account:${operationAccountId}`],
          baseUpdatedAt: account.updatedAt,
        },
      );
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename account.');
    } finally {
      setPending(false);
    }
  }

  async function archiveAccount() {
    if (!account || !userId || pending) return;
    const localRecordId = account.id ?? account._id ?? account.cloudId;
    const operationAccountId = account._id ?? account.cloudId ?? account.id;
    if (!localRecordId || !operationAccountId) return;
    setPending(true);
    setError('');
    try {
      await commitLocalWrite(
        userId,
        'account',
        'account.archive',
        { ...account, archivedAt: Date.now() },
        { accountId: operationAccountId },
        {
          recordId: localRecordId,
          dependencies: account._id || account.cloudId ? [] : [`account:${operationAccountId}`],
          baseUpdatedAt: account.updatedAt,
        },
      );
      router.replace('/account' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive account.');
      setConfirmingArchive(false);
    } finally {
      setPending(false);
    }
  }
  if (accountState.error) throw accountState.error;
  if (localTransactions.error) throw localTransactions.error;
  if (transactionRange.error && !transactionRange.data) throw transactionRange.error;
  const isLoading = accountState.loading || localTransactions.loading || transactionRange.loading;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: tokens.background }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <Typography variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {account ? displayAccountName(account.name) : 'Account'}
          </Typography>
        </View>

        {!id ? (
          <Empty title="Account unavailable." description="This account could not be found." />
        ) : isLoading ? (
          <Typography variant="small">Loading account…</Typography>
        ) : !account ? (
          <Empty
            title="Account unavailable."
            description="This account could not be found or is no longer available."
          />
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Money amountMinor={balanceMinor} currency={account.currency} size="display" />
              <Typography variant="caption">Current balance · {account.currency}</Typography>
            </View>

            <View style={{ gap: 8 }}>
              <Typography variant="heading">{displayAccountName(account.name)}</Typography>
              <Typography variant="small">
                {account.type === 'other' && account.customType
                  ? account.customType
                  : (ACCOUNT_TYPES[account.type] ?? 'Account')}{' '}
                · {account.currency}
              </Typography>
              <Typography variant="caption">
                {account.isIncludedInTotal
                  ? 'Included in total balance'
                  : 'Excluded from total balance'}
              </Typography>
              {account.icon ? (
                <Typography variant="caption">Icon: {account.icon}</Typography>
              ) : null}
              {account.color ? (
                <Typography variant="caption">Color: {account.color}</Typography>
              ) : null}
              {typeof account.createdAt === 'number' && Number.isFinite(account.createdAt) ? (
                <Typography variant="caption">
                  Added {new Date(account.createdAt).toLocaleDateString()}
                </Typography>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setName(displayAccountName(account.name));
                    setEditing(true);
                  }}
                >
                  Rename
                </Button>
                <Button size="sm" variant="destructive" onPress={() => setConfirmingArchive(true)}>
                  Archive
                </Button>
              </View>
            </View>

            {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}

            <View style={{ gap: 10 }}>
              <Typography variant="heading">Recent activity</Typography>
              {accountTransactions.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 24, gap: 10 }}>
                  <ReceiptText size={28} color={tokens.foregroundMuted} />
                  <Typography variant="bodyLarge">No posted activity yet</Typography>
                  <Typography variant="small" style={{ textAlign: 'center' }}>
                    Record a transaction to see it here.
                  </Typography>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() =>
                      router.push({
                        pathname: '/transaction/new',
                        params: { accountId: id },
                      } as never)
                    }
                  >
                    Add transaction
                  </Button>
                </View>
              ) : (
                <View>
                  {accountTransactions.map((transaction, index) => {
                    const category = categories.get(transaction.categoryId ?? '');
                    return (
                      <React.Fragment
                        key={transaction._id ?? transaction.id ?? transaction.cloudId}
                      >
                        <TransactionRow
                          title={
                            transaction.type === 'transfer'
                              ? `${accountIds.has(transaction.accountId) ? 'Transfer out' : 'Transfer in'} · ${transaction.title}`
                              : transaction.title
                          }
                          category={typeof category?.name === 'string' ? category.name : undefined}
                          categoryIcon={
                            typeof category?.icon === 'string' ? category.icon : undefined
                          }
                          amountMinor={transaction.amountMinor}
                          currency={transaction.currency}
                          type={
                            transaction.type === 'transfer'
                              ? accountIds.has(transaction.accountId)
                                ? 'expense'
                                : 'income'
                              : transaction.type
                          }
                          semanticType={
                            transaction.groupId
                              ? 'split'
                              : transaction.type === 'transfer'
                                ? 'transfer'
                                : undefined
                          }
                          date={new Date(transaction.occurredAt).toLocaleDateString()}
                          onPress={() =>
                            router.push(
                              `/transaction/${transaction._id ?? transaction.id ?? transaction.cloudId}` as never,
                            )
                          }
                        />
                        {index < accountTransactions.length - 1 && <Separator />}
                      </React.Fragment>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Sheet visible={editing} title="Rename account" onClose={() => setEditing(false)}>
        <Label>Account name</Label>
        <Input accessibilityLabel="Account name" value={name} onChangeText={setName} autoFocus />
        <Button disabled={pending || !name.trim()} onPress={saveName}>
          {pending ? 'Saving…' : 'Save name'}
        </Button>
        <Button variant="outline" onPress={() => setEditing(false)}>
          Cancel
        </Button>
      </Sheet>
      <Sheet
        visible={confirmingArchive}
        title="Archive account?"
        onClose={() => setConfirmingArchive(false)}
      >
        <Typography variant="small">
          Past transactions and balances remain in your history. This account will no longer be
          available for new activity.
        </Typography>
        <Button variant="destructive" disabled={pending} onPress={archiveAccount}>
          {pending
            ? 'Archiving…'
            : `Archive ${account ? displayAccountName(account.name) : 'account'}`}
        </Button>
        <Button variant="outline" onPress={() => setConfirmingArchive(false)}>
          Cancel
        </Button>
      </Sheet>
    </>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        gap: 12,
        backgroundColor: tokens.background,
      }}
    >
      <Typography variant="heading">Could not load this account.</Typography>
      <Typography variant="small">{error.message}</Typography>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
