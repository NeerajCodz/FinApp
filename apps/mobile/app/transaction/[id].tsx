import React, { useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  TransactionDetailScreen,
  transactionViews,
  formatTransactionDate,
  type SemanticType,
  type TransactionType,
} from '@finapp/ui/finance';
import { minorToDecimal } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
import { displayAccountName, ledgerTransaction, recordIds, recordIndex } from '@/lib/ledger';

export default function TransactionDetailRoute() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useLocalSync();
  const transactionState = useLocalRecords<LocalRecord>(userId, 'transaction');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const tagState = useLocalRecords<LocalRecord>(userId, 'transactionTag');
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
      ? profileState.data[0].timezone
      : undefined;
  const error =
    transactionState.error ||
    accountState.error ||
    categoryState.error ||
    profileState.error ||
    tagState.error;
  const loading =
    !transactionState.data ||
    !accountState.data ||
    !categoryState.data ||
    !profileState.data ||
    !tagState.data;
  const type = (transaction?.type ?? 'expense') as TransactionType;
  const semanticType: SemanticType =
    record?.groupId && transaction?.type === 'expense' ? 'split' : type;
  const editable = Boolean(
    transaction &&
    !record?.groupId &&
    ['expense', 'income', 'transfer'].includes(String(transaction.type)),
  );
  const duplicable = Boolean(
    transaction &&
    ['expense', 'income', 'transfer'].includes(String(transaction.type)) &&
    transaction.amountMinor > 0n &&
    account &&
    account.archivedAt === undefined &&
    account.currency === transaction.currency &&
    (transaction.type === 'transfer'
      ? destination && destination.archivedAt === undefined
      : category && category.archivedAt === undefined),
  );
  function duplicate() {
    if (!transaction || !record || !duplicable) return;
    const amount = transaction.amountMinor;
    router.push({
      pathname: '/transaction/new',
      params: {
        type: transaction.type,
        amount: minorToDecimal(amount, transaction.currency),
        accountId: transaction.accountId ?? '',
        categoryId: transaction.categoryId ?? '',
        destinationId: typeof record.transferAccountId === 'string' ? record.transferAccountId : '',
        occurredAt: String(transaction.occurredAt),
        hasTime: String(record.hasTime === true),
        title: typeof record.title === 'string' ? record.title : '',
        merchant: typeof record.merchant === 'string' ? record.merchant : '',
        note: typeof record.note === 'string' ? record.note : '',
      },
    });
  }
  return (
    <TransactionDetailScreen
      referenceId={id}
      relatedTransactions={transactionViews((transactionState.data??[]).filter(item => !recordIds(item).includes(String(id)) && ((record?.categoryId && item.categoryId === record.categoryId) || (record?.merchant && item.merchant === record.merchant))).sort((a,b)=>Number(b.occurredAt)-Number(a.occurredAt)).slice(0,5),accountState.data??[],categoryState.data??[],timeZone)}
      onOpenTransaction={value => router.push(`/transaction/${encodeURIComponent(value)}` as never)}
      tags={(tagState.data ?? []).flatMap((tag) =>
        record &&
        typeof tag.transactionId === 'string' &&
        typeof tag.tag === 'string' &&
        recordIds(record).includes(tag.transactionId)
          ? [tag.tag]
          : [],
      )}
      title={transaction?.title || transaction?.merchant || 'Transaction'}
      amountMinor={transaction?.amountMinor ?? 0n}
      currency={transaction?.currency ?? String(account?.currency ?? 'INR')}
      type={type}
      semanticType={semanticType}
      status={transaction?.status}
      category={
        typeof category?.name === 'string'
          ? category.name
          : record?.groupId
            ? 'Split expense'
            : 'Uncategorized'
      }
      categoryIcon={typeof category?.icon === 'string' ? category.icon : undefined}
      account={
        typeof account?.name === 'string' ? displayAccountName(account.name) : 'Unassigned account'
      }
      destination={
        transaction?.type === 'transfer'
          ? typeof destination?.name === 'string'
            ? displayAccountName(destination.name)
            : 'Unassigned account'
          : undefined
      }
      date={
        transaction?.occurredAt
          ? formatTransactionDate(transaction.occurredAt, record?.hasTime === true, timeZone)
          : 'Date unavailable'
      }
      merchant={transaction?.merchant}
      note={typeof record?.note === 'string' ? record.note.trim() : undefined}
      loading={loading}
      error={error?.message ?? null}
      unavailable={!loading && !error && (!transaction || record?.deletedAt !== undefined)}
      missingId={!id}
      canEdit={editable}
      canDuplicate={duplicable}
      onBack={() => router.back()}
      onEdit={() => router.push(`/transaction/${encodeURIComponent(String(id))}/edit` as never)}
      onDuplicate={duplicate}
      onRetry={() => {
        transactionState.retry();
        accountState.retry();
        categoryState.retry();
        profileState.retry();
        tagState.retry();
      }}
    />
  );
}
