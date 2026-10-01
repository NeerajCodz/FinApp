import React, { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from '@/lib/toast';
import { TransactionFormScreen, type TransactionFormType } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';

type Transaction = LocalRecord & {
  title?: string;
  note?: string;
  merchant?: string;
  type?: string;
  amountMinor?: bigint;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  transferAccountId?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
  groupId?: string;
};
type Entity = LocalRecord & {
  name?: string;
  currency?: string;
  icon?: string;
  archivedAt?: number;
};
const idsOf = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const recordId = (record: LocalRecord) => String(record.id ?? record._id ?? record.cloudId ?? '');

export default function EditTransactionScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId } = useLocalSync();
  const transactionState = useLocalRecords<LocalRecord>(userId, 'transaction');
  const accountState = useLocalRecords<LocalRecord>(userId, 'account');
  const categoryState = useLocalRecords<LocalRecord>(userId, 'category');
  const record = transactionState.data?.find((item) => routeId && idsOf(item).includes(routeId));
  const transaction = record as Transaction | undefined;
  const accounts = (accountState.data ?? []).filter(
    (item) => (item as Entity).archivedAt === undefined,
  ) as Entity[];
  const categories = (categoryState.data ?? []).filter(
    (item) => (item as Entity).archivedAt === undefined,
  ) as Entity[];
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<TransactionFormType>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [occurredAt, setOccurredAt] = useState(Date.now());
  const [hasTime, setHasTime] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!transaction) return;
    setTitle(String(transaction.title ?? ''));
    const minor = BigInt(transaction.amountMinor ?? 0n);
    setAmount(`${minor / 100n}.${String(minor % 100n).padStart(2, '0')}`);
    setMerchant(String(transaction.merchant ?? ''));
    setNote(String(transaction.note ?? ''));
    if (
      transaction.type === 'expense' ||
      transaction.type === 'income' ||
      transaction.type === 'transfer'
    )
      setType(transaction.type);
    setAccountId(String(transaction.accountId ?? ''));
    setCategoryId(String(transaction.categoryId ?? ''));
    setDestinationId(String(transaction.transferAccountId ?? ''));
    setOccurredAt(Number(transaction.occurredAt ?? Date.now()));
    setHasTime(transaction.hasTime === true);
  }, [transaction]);
  const findByAlias = <T extends LocalRecord>(records: T[], value?: string) =>
    records.find((item) => !!value && idsOf(item).includes(value));
  const account = findByAlias(accounts, accountId) ?? findByAlias(accounts, transaction?.accountId);
  const category =
    findByAlias(categories, categoryId) ?? findByAlias(categories, transaction?.categoryId);
  const destination =
    findByAlias(accounts, destinationId) ?? findByAlias(accounts, transaction?.transferAccountId);
  const loading = !transactionState.data || !accountState.data || !categoryState.data;
  const dataError = transactionState.error || accountState.error || categoryState.error;
  const supported = Boolean(
    transaction &&
    !transaction.groupId &&
    ['expense', 'income', 'transfer'].includes(String(transaction.type)),
  );
  const unavailableMessage =
    !loading && !dataError && (!transaction || transaction.deletedAt !== undefined || !supported)
      ? transaction?.groupId || (transaction && !supported)
        ? 'Shared, split, refund, and adjustment records retain their transaction semantics and cannot be edited here.'
        : 'This transaction is unavailable.'
      : undefined;
  const amountMinor = /^\d+(?:\.\d{1,2})?$/.test(amount)
    ? BigInt(amount.split('.')[0] || '0') * 100n +
      BigInt((amount.split('.')[1] || '').padEnd(2, '0'))
    : null;
  const validTransfer =
    type !== 'transfer' ||
    Boolean(
      destination &&
      account &&
      destination.currency === account.currency &&
      !idsOf(destination).some((id) => idsOf(account).includes(id)),
    );
  const invalidForm =
    !account ||
    (type !== 'transfer' && !title.trim()) ||
    !amountMinor ||
    amountMinor <= 0n ||
    amountMinor > 9_223_372_036_854_775_807n ||
    (type !== 'transfer' && !category) ||
    !validTransfer;

  async function save() {
    if (!userId || !transaction || !account || !amountMinor || !routeId || invalidForm) return;
    setSaving(true);
    setError('');
    try {
      const categoryChoice = type === 'transfer' ? undefined : category;
      const destinationChoice = type === 'transfer' ? destination : undefined;
      const accountRecordId = recordId(account);
      const categoryRecordId = categoryChoice ? recordId(categoryChoice) : undefined;
      const destinationRecordId = destinationChoice ? recordId(destinationChoice) : undefined;
      const currency = String(account.currency ?? transaction.currency ?? 'INR');
      const transactionTitle =
        type === 'transfer' ? `Transfer to ${destination?.name ?? 'account'}` : title.trim();
      const updated: LocalRecord = {
        ...transaction,
        title: transactionTitle,
        type,
        amountMinor,
        currency,
        accountId: accountRecordId,
        categoryId: categoryRecordId,
        transferAccountId: destinationRecordId,
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        occurredAt,
        hasTime,
      };
      const dependencies = [
        !account.cloudId && !account._id ? `account:${accountRecordId}` : null,
        categoryChoice && !categoryChoice.cloudId && !categoryChoice._id
          ? `category:${categoryRecordId}`
          : null,
        destinationChoice && !destinationChoice.cloudId && !destinationChoice._id
          ? `account:${destinationRecordId}`
          : null,
      ].filter((value): value is string => value !== null);
      await commitLocalWrite(
        userId,
        'transaction',
        'transaction.update',
        updated,
        {
          transactionId: recordId(transaction),
          accountId: accountRecordId,
          type,
          amountMinor,
          currency,
          ...(categoryRecordId ? { categoryId: categoryRecordId } : {}),
          ...(destinationRecordId ? { transferAccountId: destinationRecordId } : {}),
          title: transactionTitle,
          merchant: merchant.trim() || undefined,
          note: note.trim() || undefined,
          occurredAt,
          hasTime,
        },
        {
          recordId: recordId(transaction),
          dependencies,
          baseUpdatedAt:
            typeof transaction.updatedAt === 'number' ? transaction.updatedAt : undefined,
        },
      );
      toast.success('Transaction updated');
      router.replace(`/transaction/${encodeURIComponent(recordId(transaction))}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <TransactionFormScreen
      mode="edit"
      signedIn={Boolean(userId)}
      unavailableMessage={unavailableMessage}
      type={type}
      title={title}
      amount={amount}
      merchant={merchant}
      note={note}
      occurredAt={occurredAt}
      hasTime={hasTime}
      currency={account?.currency ?? transaction?.currency ?? 'INR'}
      accounts={accounts.map((item) => ({
        id: recordId(item),
        name: String(item.name ?? 'Account'),
        currency: item.currency,
      }))}
      categories={categories.map((item) => ({
        id: recordId(item),
        name: String(item.name ?? 'Category'),
        icon: typeof item.icon === 'string' ? item.icon : undefined,
      }))}
      accountId={account ? recordId(account) : ''}
      categoryId={category ? recordId(category) : ''}
      destinationId={destination ? recordId(destination) : ''}
      loading={loading}
      dataError={dataError?.message}
      saving={saving}
      error={error}
      submitDisabled={loading || Boolean(dataError) || invalidForm}
      onTypeChange={setType}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onMerchantChange={setMerchant}
      onNoteChange={setNote}
      onAccountChange={(id) => {
        setAccountId(id);
        setDestinationId('');
      }}
      onCategoryChange={setCategoryId}
      onDestinationChange={setDestinationId}
      onDateChange={setOccurredAt}
      onHasTimeChange={(enabled) => {
        setHasTime(enabled);
        const date = new Date(occurredAt);
        if (enabled) {
          const now = new Date();
          date.setHours(now.getHours(), now.getMinutes(), 0, 0);
        } else date.setHours(12, 0, 0, 0);
        setOccurredAt(date.getTime());
      }}
      onSubmit={() => void save()}
      onBack={() => router.back()}
    />
  );
}
