import React, { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { toast } from '@/lib/toast';
import { TransactionFormScreen, type TransactionFormType } from '@finapp/ui/finance';
import { parseMinor } from '@convex/shared/money';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { commitLocalWrite } from '@/local/commands';
import { displayAccountName } from '@/lib/ledger';

type ProfileRecord = LocalRecord & {
  defaultCurrency?: string;
  defaultAccountId?: string | null;
  defaultExpenseCategoryId?: string | null;
  defaultIncomeCategoryId?: string | null;
  updatedAt?: number;
};
type AccountRecord = LocalRecord & { name: string; currency: string; archivedAt?: number };
type CategoryRecord = LocalRecord & { name: string; icon?: string; archivedAt?: number };
const scalar = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const typeOptions: TransactionFormType[] = ['expense', 'income', 'transfer'];
const recordId = (record: LocalRecord) => String(record.id ?? record._id ?? record.cloudId ?? '');

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{
    type?: string | string[];
    amount?: string | string[];
    accountId?: string | string[];
    categoryId?: string | string[];
    destinationId?: string | string[];
    occurredAt?: string | string[];
    hasTime?: string | string[];
    note?: string | string[];
    title?: string | string[];
    merchant?: string | string[];
  }>();
  const queryType = scalar(params.type);
  const initialType: TransactionFormType = typeOptions.includes(queryType as TransactionFormType)
    ? (queryType as TransactionFormType)
    : 'expense';
  const initialDate = Number(scalar(params.occurredAt));
  const [type, setType] = useState<TransactionFormType>(initialType);
  const [amount, setAmount] = useState(scalar(params.amount) ?? '');
  const [title, setTitle] = useState(scalar(params.title) ?? '');
  const [merchant, setMerchant] = useState(scalar(params.merchant) ?? '');
  const [note, setNote] = useState(scalar(params.note) ?? '');
  const [accountId, setAccountId] = useState(scalar(params.accountId) ?? '');
  const [categoryId, setCategoryId] = useState(scalar(params.categoryId) ?? '');
  const [destinationId, setDestinationId] = useState(scalar(params.destinationId) ?? '');
  const [occurredAt, setOccurredAt] = useState(() => {
    const date =
      Number.isFinite(initialDate) && initialDate > 0 ? new Date(initialDate) : new Date();
    if (!Number.isFinite(initialDate) || initialDate <= 0) date.setHours(12, 0, 0, 0);
    return date.getTime();
  });
  const [hasTime, setHasTime] = useState(scalar(params.hasTime) === 'true');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [error, setError] = useState('');
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  const accountState = useLocalRecords<AccountRecord>(userId, 'account');
  const categoryState = useLocalRecords<CategoryRecord>(userId, 'category');
  const profile = profileState.data?.[0];
  const accounts = accountState.data?.filter((item) => item.archivedAt === undefined) ?? [];
  const categories = categoryState.data?.filter((item) => item.archivedAt === undefined) ?? [];
  const preferredCurrencyAccount = accounts.find(
    (item) => item.currency === profile?.defaultCurrency,
  );
  const account =
    accounts.find((item) => [item.id, item._id, item.cloudId].includes(accountId)) ??
    preferredCurrencyAccount ??
    accounts.find((item) =>
      [item.id, item._id, item.cloudId].includes(String(profile?.defaultAccountId)),
    ) ??
    accounts[0];
  const defaultCategoryId =
    type === 'expense' ? profile?.defaultExpenseCategoryId : profile?.defaultIncomeCategoryId;
  const category =
    categories.find((item) => [item.id, item._id, item.cloudId].includes(categoryId)) ??
    categories.find((item) =>
      [item.id, item._id, item.cloudId].includes(String(defaultCategoryId)),
    ) ??
    categories[0];
  const destination = accounts.find((item) =>
    [item.id, item._id, item.cloudId].includes(destinationId),
  );
  const accountDefault = Boolean(
    account &&
    profile?.defaultAccountId &&
    [account.id, account._id, account.cloudId].includes(profile.defaultAccountId),
  );
  const categoryDefault = Boolean(
    category &&
    defaultCategoryId &&
    [category.id, category._id, category.cloudId].includes(defaultCategoryId),
  );
  useEffect(() => {
    if (type !== 'transfer' && !categoryId && category) setCategoryId(recordId(category));
  }, [category, categoryId, type]);
  let amountMinor: bigint | null = null;
  try {
    amountMinor = parseMinor(amount, account?.currency ?? profile?.defaultCurrency ?? 'INR');
  } catch {
    /* Invalid amounts keep save disabled. */
  }
  const invalidTransfer =
    type === 'transfer' &&
    (!destination ||
      destination.currency !== account?.currency ||
      recordId(destination) === recordId(account!));

  async function save() {
    if (saveLock.current) return;
    if (
      !userId ||
      !account ||
      !amountMinor ||
      amountMinor <= 0n ||
      amountMinor > 9_223_372_036_854_775_807n ||
      (type === 'transfer' ? invalidTransfer : !category)
    )
      return;
    saveLock.current = true;
    setSaving(true);
    setError('');
    try {
      const accountRecordId = recordId(account);
      const categoryRecordId = type === 'transfer' ? undefined : recordId(category!);
      const destinationRecordId = type === 'transfer' ? recordId(destination!) : undefined;
      const transactionTitle =
        type === 'transfer'
          ? `Transfer to ${displayAccountName(destination!.name)}`
          : title.trim() || note.trim() || category!.name;
      const payload = {
        accountId: accountRecordId,
        type,
        amountMinor,
        currency: account.currency,
        ...(categoryRecordId ? { categoryId: categoryRecordId } : {}),
        ...(destinationRecordId ? { transferAccountId: destinationRecordId } : {}),
        title: transactionTitle,
        ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        occurredAt,
        hasTime,
      };
      const record: LocalRecord = { ...payload, type, status: 'posted' };
      const dependencies = [
        !account.cloudId && !account._id ? `account:${accountRecordId}` : null,
        categoryRecordId && category && !category.cloudId && !category._id
          ? `category:${categoryRecordId}`
          : null,
        destinationRecordId && destination && !destination.cloudId && !destination._id
          ? `account:${destinationRecordId}`
          : null,
      ].filter((item): item is string => item !== null);
      await commitLocalWrite(userId, 'transaction', 'transaction.create', record, payload, {
        dependencies,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(`${type[0]!.toUpperCase()}${type.slice(1)} added`);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not save ${type}`);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }
  async function toggleDefault(selection: 'account' | 'category') {
    if (!userId) return;
    const currentProfile = profile ?? { id: userId };
    setSavingDefault(true);
    try {
      if (selection === 'account' && account) {
        const id = accountDefault ? null : recordId(account);
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultAccount',
          { ...currentProfile, defaultAccountId: id },
          { accountId: id },
          { dependencies: id && !account.cloudId && !account._id ? [`account:${id}`] : [] },
        );
      } else if (selection === 'category' && category && type !== 'transfer') {
        const id = categoryDefault ? null : recordId(category);
        const field = type === 'expense' ? 'defaultExpenseCategoryId' : 'defaultIncomeCategoryId';
        await commitLocalWrite(
          userId,
          'profile',
          'user.defaultCategory',
          { ...currentProfile, [field]: id },
          { transactionType: type, categoryId: id },
          { dependencies: id && !category.cloudId && !category._id ? [`category:${id}`] : [] },
        );
      }
      setSavingDefault(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this default.');
    } finally {
      setSavingDefault(false);
    }
  }

  return (
    <TransactionFormScreen
      mode="create"
      signedIn={Boolean(userId)}
      type={type}
      title={title}
      amount={amount}
      merchant={merchant}
      note={note}
      occurredAt={occurredAt}
      hasTime={hasTime}
      currency={account?.currency ?? profile?.defaultCurrency ?? 'INR'}
      saving={saving}
      error={error}
      savingDefault={savingDefault}
      isDefaultAccount={accountDefault}
      isDefaultCategory={categoryDefault}
      accounts={accounts.map((item) => ({
        id: recordId(item),
        name: displayAccountName(item.name),
        currency: item.currency,
      }))}
      categories={categories.map((item) => ({
        id: recordId(item),
        name: item.name,
        icon: item.icon,
      }))}
      accountId={account ? recordId(account) : ''}
      categoryId={category ? recordId(category) : ''}
      destinationId={destination ? recordId(destination) : ''}
      loading={!accountState.data || !categoryState.data || !profileState.data}
      dataError={
        accountState.error?.message ?? categoryState.error?.message ?? profileState.error?.message
      }
      submitDisabled={
        !userId ||
        !accountState.data ||
        !categoryState.data ||
        !profileState.data ||
        Boolean(accountState.error || categoryState.error || profileState.error) ||
        !account ||
        !amountMinor ||
        amountMinor <= 0n ||
        amountMinor > 9_223_372_036_854_775_807n ||
        (type === 'transfer' ? invalidTransfer : !category)
      }
      onTypeChange={(value) => {
        void Haptics.selectionAsync();
        setType(value);
        setCategoryId('');
      }}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onMerchantChange={setMerchant}
      onNoteChange={setNote}
      onAccountChange={(id) => {
        void Haptics.selectionAsync();
        setAccountId(id);
        setDestinationId('');
      }}
      onCategoryChange={(id) => {
        void Haptics.selectionAsync();
        setCategoryId(id);
      }}
      onDestinationChange={(id) => {
        void Haptics.selectionAsync();
        setDestinationId(id);
      }}
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
      onToggleDefault={toggleDefault}
      onAddAccount={() => router.push('/accounts/new' as never)}
      onManageCategories={() =>
        router.push((categories.length ? '/categories' : '/categories/new') as never)
      }
      onSplitExpense={() => router.push('/split/new' as never)}
    />
  );
}
