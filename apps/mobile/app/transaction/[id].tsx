import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight, ReceiptText } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryIcon, Money, SemanticMarker, SettingsRow } from '@/components/finance';
import { Button, Empty, IconButton, Separator, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
import { displayAccountName, ledgerTransaction, recordIds, recordIndex } from '@/lib/ledger';

export default function TransactionDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const transactionState = useLocalRecords<LocalRecord>(userId, 'transaction');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const record = transactionState.data?.find((item) => id && recordIds(item).includes(id));
  const transaction = record ? ledgerTransaction(record) : null;
  const accounts = useMemo(() => recordIndex(accountState.data ?? []), [accountState.data]);
  const categories = useMemo(() => recordIndex(categoryState.data ?? []), [categoryState.data]);
  const category = categories.get(transaction?.categoryId ?? '');
  const account = accounts.get(transaction?.accountId ?? '');
  const destination = accounts.get(
    typeof record?.transferAccountId === 'string' ? record.transferAccountId : '',
  );
  const timeZone =
    typeof profileState.data?.[0]?.timezone === 'string'
      ? (profileState.data[0].timezone as string)
      : 'UTC';
  const error =
    transactionState.error || accountState.error || categoryState.error || profileState.error;
  const loading =
    !transactionState.data || !accountState.data || !categoryState.data || !profileState.data;
  const duplicable =
    transaction &&
    ['expense', 'income', 'transfer'].includes(transaction.type) &&
    transaction.amountMinor > 0n &&
    account &&
    account.archivedAt === undefined &&
    account.currency === transaction.currency &&
    (transaction.type === 'transfer'
      ? destination && destination.archivedAt === undefined
      : category && category.archivedAt === undefined);
  const duplicate = () => {
    if (!transaction || !record || !duplicable) return;
    const amount = transaction.amountMinor;
    router.push({
      pathname: '/transaction/new',
      params: {
        type: transaction.type,
        amount: `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`,
        accountId: transaction.accountId ?? '',
        categoryId: transaction.categoryId ?? '',
        destinationId: typeof record.transferAccountId === 'string' ? record.transferAccountId : '',
        occurredAt: String(transaction.occurredAt),
        note: typeof record.note === 'string' ? record.note : '',
      },
    });
  };
  return (
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
        <Typography variant="heading">Transaction</Typography>
      </View>
      {!id ? (
        <Empty
          title="Missing transaction ID"
          description="Open a transaction from Activity to view its details."
        />
      ) : error && loading ? (
        <View style={{ gap: 12 }} accessibilityRole="alert">
          <Empty title="Transaction unavailable" description="Saved records could not be loaded." />
          <Button
            onPress={() => {
              transactionState.retry();
              accountState.retry();
              categoryState.retry();
              profileState.retry();
            }}
          >
            Retry
          </Button>
        </View>
      ) : loading ? (
        <Typography variant="heading">Loading transaction…</Typography>
      ) : !transaction || record?.deletedAt !== undefined ? (
        <Empty
          title="Transaction unavailable"
          description="This transaction was removed or is no longer saved on this device."
        />
      ) : (
        <>
          {error && (
            <View style={{ gap: 8 }} accessibilityRole="alert">
              <Typography variant="caption">Showing saved details. Refresh failed.</Typography>
              <Button
                onPress={() => {
                  transactionState.retry();
                  accountState.retry();
                  categoryState.retry();
                  profileState.retry();
                }}
              >
                Retry
              </Button>
            </View>
          )}
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <CategoryIcon
              label={typeof category?.name === 'string' ? category.name : transaction.type}
              icon={typeof category?.icon === 'string' ? category.icon : undefined}
            />
            <Money
              amountMinor={transaction.amountMinor}
              currency={transaction.currency}
              type={transaction.type}
              size="display"
            />
            <Typography variant="heading" style={{ textAlign: 'center' }}>
              {transaction.title || 'Transaction'}
            </Typography>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <SemanticMarker type={record?.groupId ? 'split' : transaction.type} />
              <Typography variant="caption">{transaction.status.toUpperCase()}</Typography>
            </View>
          </View>
          <View>
            {transaction.merchant && (
              <>
                <SettingsRow label="Merchant" value={transaction.merchant} />
                <Separator />
              </>
            )}
            <View style={{ minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ color: tokens.foregroundMuted, flex: 1 }}>Category</Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  flex: 1,
                }}
              >
                <CategoryIcon
                  label={typeof category?.name === 'string' ? category.name : 'Uncategorized'}
                  icon={typeof category?.icon === 'string' ? category.icon : undefined}
                />
                <Typography
                  variant="bodyLarge"
                  numberOfLines={2}
                  style={{ flexShrink: 1, textAlign: 'right' }}
                >
                  {typeof category?.name === 'string' ? category.name : 'Uncategorized'}
                </Typography>
              </View>
            </View>
            <Separator />
            <SettingsRow
              label="Account"
              value={
                typeof account?.name === 'string'
                  ? displayAccountName(account.name)
                  : 'Unassigned account'
              }
            />
            {transaction.type === 'transfer' && (
              <>
                <Separator />
                <SettingsRow
                  label="Destination"
                  value={
                    typeof destination?.name === 'string'
                      ? displayAccountName(destination.name)
                      : 'Unassigned account'
                  }
                />
              </>
            )}
            <Separator />
            <SettingsRow
              label="Date"
              value={new Intl.DateTimeFormat('en-US', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone,
              }).format(transaction.occurredAt)}
            />
            <Separator />
            <SettingsRow
              label="Note"
              value={typeof record?.note === 'string' && record.note.trim() ? record.note : 'None'}
            />
          </View>
          {duplicable && (
            <Button
              size="lg"
              variant="outline"
              onPress={duplicate}
              style={{ justifyContent: 'space-between' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ReceiptText size={19} color={tokens.foreground} />
                <Text
                  style={{
                    color: tokens.foreground,
                    fontFamily: 'SpaceGrotesk_600SemiBold',
                    fontSize: 15,
                  }}
                >
                  Duplicate transaction
                </Text>
              </View>
              <ArrowRight size={18} color={tokens.foregroundSubtle} />
            </Button>
          )}
        </>
      )}
    </ScrollView>
  );
}
