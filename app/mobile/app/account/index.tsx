import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import {
  ArrowLeft,
  CaretRight,
  Coins,
  CurrencyDollar,
  Landmark,
  Plus,
  ReceiptText,
  Wallet,
} from '@/lib/icons';
import { router } from 'expo-router';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Money } from '@/components/finance';
import { Button, Card, IconButton, Separator, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

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
  isIncludedInTotal?: boolean;
};
type AccountTransaction = LocalRecord & {
  accountId: string;
  transferAccountId?: string;
  amountMinor: bigint;
  currency: string;
  type: string;
  status: string;
  deletedAt?: number;
  clientUpdatedAt?: number;
};

const ACCOUNT_ICONS = {
  cash: Coins,
  bank: Landmark,
  card: ReceiptText,
  wallet: Wallet,
  loan: CurrencyDollar,
  other: Wallet,
} as const;

function displayAccountName(name: string) {
  if (!name.includes('%')) return name;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export default function AccountsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const transactionState = useLocalRecords<AccountTransaction>(userId, 'transaction');
  if (accountState.error) throw accountState.error;
  if (transactionState.error) throw transactionState.error;

  const accounts = (accountState.data ?? [])
    .filter(
      (account) =>
        account.archivedAt === undefined &&
        (account.id ?? account._id ?? account.cloudId) !== undefined,
    )
    .sort((left, right) =>
      displayAccountName(left.name).localeCompare(displayAccountName(right.name)),
    )
    .map((account) => {
      const id = account.id ?? account._id ?? account.cloudId!;
      const ids = new Set(
        [account.id, account._id, account.cloudId].filter(
          (value): value is string => typeof value === 'string' && value.length > 0,
        ),
      );
      const optimisticDelta = (transactionState.data ?? []).reduce((delta, transaction) => {
        if (
          typeof transaction.clientUpdatedAt !== 'number' ||
          transaction.status !== 'posted' ||
          transaction.deletedAt !== undefined
        )
          return delta;
        const sourceDelta = ids.has(transaction.accountId)
          ? transaction.type === 'expense' || transaction.type === 'transfer'
            ? -transaction.amountMinor
            : transaction.amountMinor
          : 0n;
        const destinationDelta =
          transaction.type === 'transfer' &&
          transaction.transferAccountId &&
          ids.has(transaction.transferAccountId)
            ? transaction.amountMinor
            : 0n;
        return delta + sourceDelta + destinationDelta;
      }, 0n);
      return {
        account,
        id,
        name: displayAccountName(account.name),
        balanceMinor: (account.balanceMinor ?? account.openingBalanceMinor ?? 0n) + optimisticDelta,
      };
    });
  const loading = accountState.loading || (accounts.length > 0 && transactionState.loading);
  const totalsByCurrency = new Map<string, bigint>();
  for (const item of accounts) {
    if (item.account.isIncludedInTotal !== true) continue;
    totalsByCurrency.set(
      item.account.currency,
      (totalsByCurrency.get(item.account.currency) ?? 0n) + item.balanceMinor,
    );
  }
  const totals = [...totalsByCurrency.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 24,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="title">Accounts</Typography>
          <Typography variant="small">Balances, together.</Typography>
        </View>
        <IconButton
          label="Add account"
          variant="outline"
          onPress={() => router.push('/account/new' as never)}
        >
          <Plus size={21} color={tokens.foreground} />
        </IconButton>
      </View>

      {loading ? (
        <Card variant="subtle" style={{ gap: 12 }}>
          <Typography variant="label">Loading accounts</Typography>
          <View
            style={{
              height: 22,
              width: '62%',
              borderRadius: 8,
              backgroundColor: tokens.surfaceRaised,
            }}
          />
          <View
            style={{
              height: 14,
              width: '38%',
              borderRadius: 8,
              backgroundColor: tokens.surfaceRaised,
            }}
          />
        </Card>
      ) : accounts.length === 0 ? (
        <Card variant="subtle" style={{ gap: 14, padding: 24, alignItems: 'center' }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Wallet size={26} color={tokens.primary} />
          </View>
          <Typography variant="heading" style={{ textAlign: 'center' }}>Start with an account</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 300, textAlign: 'center' }}>
            Add cash, a bank account, or a card to keep balances and activity in one place.
          </Text>
          <Button variant="outline" onPress={() => router.push('/account/new' as never)}>
            Add your first account
          </Button>
        </Card>
      ) : (
        <>
          <Card
            variant="subtle"
            style={{
              gap: 16,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ gap: 5 }}>
                <Typography variant="caption">ACCOUNT OVERVIEW</Typography>
                <Typography variant="heading">
                  {accounts.length} active {accounts.length === 1 ? 'account' : 'accounts'}
                </Typography>
              </View>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: tokens.surfaceRaised,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Landmark size={20} color={tokens.primary} />
              </View>
            </View>
            <Separator />
            <View style={{ gap: 9 }}>
              <Typography variant="small">Included balances</Typography>
              {totals.length > 0 ? (
                totals.map(([currency, amountMinor], index) => (
                  <Money
                    key={currency}
                    amountMinor={amountMinor}
                    currency={currency}
                    size={index === 0 ? 'display' : 'body'}
                  />
                ))
              ) : (
                <Text style={{ color: tokens.foregroundMuted }}>
                  No account balances are included in your total.
                </Text>
              )}
            </View>
          </Card>

          <View style={{ gap: 11 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="heading">Your accounts</Typography>
              <Typography variant="caption">{accounts.length} ACTIVE</Typography>
            </View>
            {accounts.map(({ account, id, name, balanceMinor }) => {
              const TypeIcon = ACCOUNT_ICONS[account.type] ?? Wallet;
              return (
                <TouchableOpacity
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${name} account`}
                  onPress={() =>
                    router.push({ pathname: '/account/[id]', params: { id } } as never)
                  }
                  activeOpacity={0.72}
                  style={{
                    width: '100%',
                    alignSelf: 'stretch',
                    minHeight: 82,
                    flexDirection: 'row',
                    flexWrap: 'nowrap',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    borderRadius: 18,
                    backgroundColor: tokens.card,
                    borderWidth: 1,
                    borderColor: tokens.borderSubtle,
                  }}
                >
                  <View
                    style={{
                      width: '100%',
                      flex: 1,
                      flexDirection: 'row',
                      flexWrap: 'nowrap',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 15,
                        backgroundColor: tokens.surfaceRaised,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <TypeIcon size={21} color={tokens.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Typography variant="bodyLarge" numberOfLines={1} ellipsizeMode="tail">
                        {name}
                      </Typography>
                      <Typography variant="caption">
                        {account.type === 'other' && account.customType
                          ? account.customType
                          : ACCOUNT_TYPES[account.type] ?? 'Account'} · {account.currency}
                      </Typography>
                    </View>
                    <View style={{ flexShrink: 0, alignItems: 'flex-end', gap: 4 }}>
                      <Money amountMinor={balanceMinor} currency={account.currency} />
                      <Typography variant="caption">
                        {account.isIncludedInTotal === true ? 'In total' : 'Excluded'}
                      </Typography>
                    </View>
                    <CaretRight size={18} color={tokens.foregroundSubtle} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </ScrollView>
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
      <Typography variant="heading">Could not load accounts.</Typography>
      <Typography variant="small">{error.message}</Typography>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
