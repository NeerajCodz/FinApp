import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money, TransactionRow } from '@/components/finance';
import {
  Button,
  Empty,
  IconButton,
  Input,
  Label,
  Separator,
  Sheet,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const ACCOUNT_TYPES = {
  cash: 'Cash',
  bank: 'Bank',
  card: 'Card',
  wallet: 'Wallet',
  loan: 'Loan',
  other: 'Other',
} as const;

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const detail = useQuery(
    api.accounts.queries.detail,
    id ? { accountId: id as Id<'accounts'> } : 'skip',
  );
  const rename = useMutation(api.accounts.mutations.rename);
  const archive = useMutation(api.accounts.mutations.archive);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [error, setError] = useState('');
  const account = detail?.account;

  async function saveName() {
    if (!account || !name.trim() || pending) return;
    setPending(true);
    setError('');
    try {
      await rename({ accountId: account._id, name });
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename account.');
    } finally {
      setPending(false);
    }
  }

  async function archiveAccount() {
    if (!account || pending) return;
    setPending(true);
    setError('');
    try {
      await archive({ accountId: account._id });
      router.replace('/account' as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive account.');
      setConfirmingArchive(false);
    } finally {
      setPending(false);
    }
  }

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
            {account?.name ?? 'Account'}
          </Typography>
        </View>

        {!id ? (
          <Empty title="Account unavailable." description="This account could not be found." />
        ) : detail === undefined ? (
          <Typography variant="small">Loading account…</Typography>
        ) : !account ? (
          <Empty
            title="Account unavailable."
            description="This account could not be found or is no longer available."
          />
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Money amountMinor={detail.balanceMinor} currency={account.currency} size="display" />
              <Typography variant="caption">Current balance · {account.currency}</Typography>
            </View>

            <View style={{ gap: 8 }}>
              <Separator />
              <Typography variant="heading">{account.name}</Typography>
              <Typography variant="small">
                {ACCOUNT_TYPES[account.type]} · {account.currency}
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
              <Typography variant="caption">
                Added {new Date(account.createdAt).toLocaleDateString()}
              </Typography>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setName(account.name);
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
              {detail.transactions.length === 0 ? (
                <Empty
                  title="No posted activity yet."
                  description="Posted, non-deleted transactions for this account will appear here."
                />
              ) : (
                <View>
                  {detail.transactions.map((transaction, index) => (
                    <React.Fragment key={transaction._id}>
                      <TransactionRow
                        title={
                          transaction.type === 'transfer'
                            ? `${transaction.accountId === account._id ? 'Transfer out' : 'Transfer in'} · ${transaction.title}`
                            : transaction.title
                        }
                        amountMinor={transaction.amountMinor}
                        currency={transaction.currency}
                        type={
                          transaction.type === 'transfer'
                            ? transaction.accountId === account._id
                              ? 'expense'
                              : 'income'
                            : transaction.type
                        }
                        date={new Date(transaction.occurredAt).toLocaleDateString()}
                        onPress={() => router.push(`/transaction/${transaction._id}` as never)}
                      />
                      {index < detail.transactions.length - 1 && <Separator />}
                    </React.Fragment>
                  ))}
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
          {pending ? 'Archiving…' : `Archive ${account?.name ?? 'account'}`}
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
