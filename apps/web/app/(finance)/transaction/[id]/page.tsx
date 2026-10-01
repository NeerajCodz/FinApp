'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  TransactionDetailScreen,
  transactionViews,
  formatTransactionDate,
  type SemanticType,
  type TransactionType,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import {
  aliasesOf,
  asMinor,
  belongsToUser,
  matchesId,
  minorToInput,
  SignInGate,
} from '../../_personal';

type Transaction = LocalRecord & {
  title?: string;
  note?: string;
  type?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  accountId?: string;
  categoryId?: string;
  transferAccountId?: string;
  groupId?: string;
  occurredAt?: number;
  hasTime?: boolean;
  status?: string;
  deletedAt?: number;
  merchant?: string;
};
type Account = LocalRecord & { name?: string; currency?: string; archivedAt?: number };
type Category = LocalRecord & { name?: string; icon?: string; archivedAt?: number };
type Profile = LocalRecord & { timezone?: string };

export default function PersonalTransactionDetailPage() {
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
  const accounts = accountState.records.filter((record) => userId && belongsToUser(record, userId));
  const categories = categoryState.records.filter(
    (record) => userId && belongsToUser(record, userId),
  );
  const profile = profileState.records[0];
  const account = accounts.find(
    (record) => transaction?.accountId && aliasesOf(record).includes(transaction.accountId),
  );
  const category = categories.find(
    (record) => transaction?.categoryId && aliasesOf(record).includes(transaction.categoryId),
  );
  const destination = accounts.find(
    (record) =>
      transaction?.transferAccountId && aliasesOf(record).includes(transaction.transferAccountId),
  );
  const transactionType: TransactionType =
    transaction?.type === 'income' ||
    transaction?.type === 'transfer' ||
    transaction?.type === 'refund' ||
    transaction?.type === 'adjustment'
      ? transaction.type
      : 'expense';
  const semanticType: SemanticType = transaction?.groupId ? 'split' : transactionType;
  const loading =
    transactionState.loading ||
    accountState.loading ||
    categoryState.loading ||
    profileState.loading;
  const error =
    transactionState.error ?? accountState.error ?? categoryState.error ?? profileState.error;
  const canEdit = Boolean(
    transaction &&
    !transaction.groupId &&
    ['expense', 'income', 'transfer'].includes(String(transaction.type)),
  );
  const canDuplicate = Boolean(
    transaction &&
    (transaction.type === 'expense' ||
      transaction.type === 'income' ||
      transaction.type === 'transfer') &&
    asMinor(transaction.amountMinor) > 0n &&
    account &&
    account.archivedAt === undefined &&
    account.currency === transaction.currency &&
    (transaction.type === 'transfer'
      ? destination && destination.archivedAt === undefined
      : category && category.archivedAt === undefined),
  );
  function duplicate() {
    if (!transaction || !canDuplicate) return;
    const query = new URLSearchParams({
      type: transaction.type!,
      amount: minorToInput(transaction.amountMinor, transaction.currency ?? 'INR'),
      accountId: transaction.accountId ?? '',
      occurredAt: String(transaction.occurredAt ?? Date.now()),
      note: transaction.note ?? '',
      hasTime: String(transaction.hasTime === true),
    });
    if (transaction.categoryId) query.set('categoryId', transaction.categoryId);
    if (transaction.transferAccountId) query.set('destinationId', transaction.transferAccountId);
    if (transaction.title) query.set('title', transaction.title);
    if (transaction.merchant) query.set('merchant', transaction.merchant);
    router.push(`/transaction/new?${query.toString()}`);
  }
  if (!userId)
    return (
      <SignInGate eyebrow="TRANSACTION DETAIL" title="Your ledger stays private.">
        Sign in to review a transaction from your personal finance data.
      </SignInGate>
    );
  return (
    <TransactionDetailScreen
      referenceId={routeId}
      relatedTransactions={transactionViews(transactionState.records.filter(record => userId && belongsToUser(record, userId) && !matchesId(record, routeId) && ((transaction?.categoryId && record.categoryId === transaction.categoryId) || (transaction?.merchant && record.merchant === transaction.merchant))).sort((a,b)=>Number(b.occurredAt)-Number(a.occurredAt)).slice(0,5),accounts,categories,profile?.timezone)}
      onOpenTransaction={id => router.push(`/transaction/${encodeURIComponent(id)}`)}
      title={transaction?.title || transaction?.merchant || 'Transaction'}
      amountMinor={asMinor(transaction?.amountMinor)}
      currency={String(
        transaction?.currency ?? account?.currency ?? profile?.defaultCurrency ?? 'INR',
      )}
      type={transactionType}
      semanticType={semanticType}
      status={transaction?.status}
      category={category?.name ?? (transaction?.groupId ? 'Split expense' : 'Uncategorized')}
      categoryIcon={category?.icon}
      account={account?.name ?? 'Unassigned account'}
      destination={
        transaction?.type === 'transfer' ? (destination?.name ?? 'Unassigned account') : undefined
      }
      date={
        transaction?.occurredAt
          ? formatTransactionDate(
              transaction.occurredAt,
              transaction.hasTime,
              profile?.timezone ?? 'UTC',
            )
          : 'Date unavailable'
      }
      merchant={transaction?.merchant}
      note={transaction?.note?.trim()}
      loading={loading}
      error={error}
      unavailable={!loading && !error && (!transaction || transaction.deletedAt !== undefined)}
      missingId={!routeId}
      canEdit={canEdit}
      canDuplicate={canDuplicate}
      onBack={() => router.push('/transactions')}
      onEdit={() => router.push(`/transaction/${encodeURIComponent(routeId)}/edit`)}
      onDuplicate={duplicate}
    />
  );
}
