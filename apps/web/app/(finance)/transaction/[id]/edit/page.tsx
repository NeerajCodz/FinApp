'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { parseMinor } from '@convex/shared/money';
import {
  TransactionFormScreen,
  transactionViews,
  type TransactionFormType,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  belongsToUser,
  idOf,
  localDependency,
  matchesId,
  minorToInput,
} from '../../../_personal';

const maxInt64 = 9_223_372_036_854_775_807n;
type Transaction = LocalRecord & {
  title?: string;
  note?: string;
  merchant?: string;
  type?: string;
  amountMinor?: bigint | number | string;
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
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & { defaultCurrency?: string };

export default function EditTransactionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useBrowserSync();
  const transactionState = useLocalRecords<Transaction>('transaction');
  const accountState = useLocalRecords<Account>('account');
  const categoryState = useLocalRecords<Category>('category');
  const profileState = useLocalRecords<Profile>('profile');
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transaction = transactionState.records.find(
    (record) => userId && belongsToUser(record, userId) && matchesId(record, routeId),
  );
  const accounts = accountState.records.filter(
    (record) => userId && belongsToUser(record, userId) && record.archivedAt === undefined,
  );
  const categories = categoryState.records.filter(
    (record) => userId && belongsToUser(record, userId) && record.archivedAt === undefined,
  );
  const [title, setTitle] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [merchant, setMerchant] = React.useState('');
  const [note, setNote] = React.useState('');
  const [type, setType] = React.useState<TransactionFormType>('expense');
  const [accountId, setAccountId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [occurredAt, setOccurredAt] = React.useState(Date.now());
  const [hasTime, setHasTime] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    if (!transaction) return;
    setTitle(String(transaction.title ?? ''));
    setAmount(minorToInput(transaction.amountMinor, transaction.currency ?? 'INR'));
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
  const loading =
    transactionState.loading ||
    accountState.loading ||
    categoryState.loading ||
    profileState.loading;
  const dataError =
    transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
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
  const selectedAccount = accounts.find((item) => matchesId(item, accountId));
  const selectedCategory = categories.find((item) => matchesId(item, categoryId));
  const selectedDestination = accounts.find((item) => matchesId(item, destinationId));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !transaction || !selectedAccount || !routeId) return;
    if (type !== 'transfer' && !title.trim()) {
      setError('Enter a transaction title.');
      return;
    }
    if (type === 'transfer') {
      if (
        !selectedDestination ||
        aliasesOf(selectedAccount).some((id) => aliasesOf(selectedDestination).includes(id)) ||
        selectedDestination.currency !== selectedAccount.currency
      ) {
        setError('Choose a different destination account with the same currency.');
        return;
      }
    } else if (!selectedCategory) {
      setError('Choose a category.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const amountMinor = parseMinor(amount, selectedAccount.currency ?? 'INR');
      if (amountMinor <= 0n || amountMinor > maxInt64)
        throw new Error('Enter a positive valid amount.');
      if (!Number.isFinite(occurredAt)) throw new Error('Choose a valid transaction date.');
      const transactionTitle =
        type === 'transfer'
          ? `Transfer to ${selectedDestination?.name ?? 'account'}`
          : title.trim();
      const categoryChoice = type === 'transfer' ? undefined : selectedCategory;
      const destinationChoice = type === 'transfer' ? selectedDestination : undefined;
      const updated: LocalRecord = {
        ...transaction,
        title: transactionTitle,
        type,
        amountMinor,
        currency: selectedAccount.currency ?? 'INR',
        accountId: idOf(selectedAccount),
        categoryId: categoryChoice ? idOf(categoryChoice) : undefined,
        transferAccountId: destinationChoice ? idOf(destinationChoice) : undefined,
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        occurredAt,
        hasTime,
      };
      const dependencies = [
        localDependency('account', selectedAccount),
        categoryChoice ? localDependency('category', categoryChoice) : null,
        destinationChoice ? localDependency('account', destinationChoice) : null,
      ].filter((value): value is string => value !== null);
      await commitLocalWrite(
        userId,
        'transaction',
        'transaction.update',
        updated,
        {
          transactionId: idOf(transaction),
          accountId: idOf(selectedAccount),
          type,
          amountMinor,
          currency: selectedAccount.currency ?? 'INR',
          title: transactionTitle,
          ...(categoryChoice ? { categoryId: idOf(categoryChoice) } : {}),
          ...(destinationChoice ? { transferAccountId: idOf(destinationChoice) } : {}),
          ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          occurredAt,
          hasTime,
        },
        {
          recordId: idOf(transaction),
          dependencies,
          baseUpdatedAt:
            typeof transaction.updatedAt === 'number' ? transaction.updatedAt : undefined,
        },
      );
      router.push(`/transaction/${encodeURIComponent(idOf(transaction))}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <TransactionFormScreen
      status={transaction?.status}
      referenceId={routeId}
      similarTransactions={transactionViews(
        transactionState.records
          .filter(
            (record) =>
              userId &&
              belongsToUser(record, userId) &&
              !matchesId(record, routeId) &&
              ((categoryId && record.categoryId === categoryId) ||
                (merchant.trim() && record.merchant === merchant.trim())),
          )
          .sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt))
          .slice(0, 4),
        accounts,
        categories,
      )}
      onOpenTransaction={(id) => router.push(`/transaction/${encodeURIComponent(id)}`)}
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
      currency={
        selectedAccount?.currency ??
        transaction?.currency ??
        profileState.records[0]?.defaultCurrency ??
        'INR'
      }
      accounts={accounts.map((item) => ({
        id: idOf(item),
        name: item.name ?? 'Account',
        currency: item.currency,
      }))}
      categories={categories.map((item) => ({
        id: idOf(item),
        name: item.name ?? 'Category',
        icon: item.icon,
      }))}
      submitDisabled={
        loading ||
        Boolean(dataError) ||
        !selectedAccount ||
        (type !== 'transfer' && (!selectedCategory || !title.trim())) ||
        (type === 'transfer' &&
          (!selectedDestination ||
            aliasesOf(selectedAccount).some((id) => aliasesOf(selectedDestination).includes(id)) ||
            selectedDestination.currency !== selectedAccount.currency)) ||
        (() => {
          try {
            const value = selectedAccount
              ? parseMinor(amount, selectedAccount.currency ?? 'INR')
              : 0n;
            return value <= 0n || value > maxInt64;
          } catch {
            return true;
          }
        })()
      }
      accountId={selectedAccount ? idOf(selectedAccount) : ''}
      categoryId={selectedCategory ? idOf(selectedCategory) : ''}
      destinationId={selectedDestination ? idOf(selectedDestination) : ''}
      loading={loading}
      dataError={dataError}
      saving={saving}
      error={error}
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
      onSubmit={save}
      onBack={() => router.push(`/transaction/${encodeURIComponent(routeId)}`)}
    />
  );
}
