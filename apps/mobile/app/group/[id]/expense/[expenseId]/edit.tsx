import React, { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { allocateParticipants } from '@convex/splits/domain';
import {
  GroupExpenseFormScreen,
  minorToDecimal,
  type GroupExpenseMethod,
} from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalRecord } from '@/local/repository';
import { displayAccountName, recordId, recordIds } from '@/lib/ledger';
import { parseMinor } from '@/lib/money';

import { canEditGroupExpense } from '@/lib/groupExpenseEditing';
const cloudId = (record: LocalRecord | undefined) =>
  typeof record?.cloudId === 'string'
    ? record.cloudId
    : typeof record?._id === 'string'
      ? record._id
      : '';
const dateText = (value: number) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function EditGroupExpenseScreen() {
  const params = useLocalSearchParams<{ id: string; expenseId: string }>();
  const { userId, isConnected } = useLocalSync();
  const transactions = useLocalRecords<LocalRecord>(userId, 'transaction');
  const groups = useLocalRecords<LocalRecord>(userId, 'group');
  const memberships = useLocalRecords<LocalRecord>(userId, 'groupMember');
  const accounts = useLocalRecords<LocalRecord>(userId, 'account');
  const categories = useLocalRecords<LocalRecord>(userId, 'category');
  const participants = useLocalRecords<LocalRecord>(userId, 'expenseParticipant');
  const profiles = useLocalRecords<LocalRecord>(userId, 'profile');
  const updateExpense = useMutation(api.groups.mutations.updateExpense);
  const record = transactions.data?.find((item) => recordIds(item).includes(params.expenseId));
  const group = groups.data?.find((item) => recordIds(item).includes(params.id));
  const originalParticipants = (participants.data ?? []).filter(
    (item) =>
      record &&
      typeof item.transactionId === 'string' &&
      recordIds(record).includes(item.transactionId) &&
      item.deletedAt === undefined,
  );
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [method, setMethod] = useState<GroupExpenseMethod>('equal');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [basis, setBasis] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const initialized = useRef(false);
  const lock = useRef(false);
  const states = [transactions, groups, memberships, accounts, categories, participants, profiles];
  const loading = states.some((state) => state.loading);
  const dataError = states.find((state) => state.error)?.error;
  const currency = String(record?.currency ?? group?.currency ?? '');
  useEffect(() => {
    if (initialized.current || loading || dataError || !record || !originalParticipants.length)
      return;
    initialized.current = true;
    setTitle(String(record.title ?? ''));
    setAmount(minorToDecimal(BigInt(record.amountMinor as bigint), currency));
    setDate(dateText(Number(record.occurredAt)));
    setMerchant(String(record.merchant ?? ''));
    setNote(String(record.note ?? ''));
    setAccountId(String(record.accountId ?? ''));
    setCategoryId(String(record.categoryId ?? ''));
    const splitMethod = originalParticipants[0]?.method;
    const nextMethod: GroupExpenseMethod =
      splitMethod === 'exact' || splitMethod === 'percentage' || splitMethod === 'shares'
        ? splitMethod
        : 'equal';
    setMethod(nextMethod);
    setSelectedIds(originalParticipants.map((item) => String(item.memberId ?? item.userId)));
    setBasis(
      Object.fromEntries(
        originalParticipants.map((item) => {
          const value = String(item.basisValue ?? '0');
          return [
            String(item.memberId ?? item.userId),
            nextMethod === 'shares'
              ? value
              : minorToDecimal(BigInt(value), nextMethod === 'percentage' ? 'USD' : currency),
          ];
        }),
      ),
    );
  }, [loading, dataError, record, participants.data, currency]);
  const groupIds = recordIds(group ?? {});
  const members = (memberships.data ?? [])
    .filter(
      (item) =>
        item.deletedAt === undefined &&
        typeof item.groupId === 'string' &&
        groupIds.includes(item.groupId),
    )
    .map((item) => ({
      userId: String(item.memberId ?? item.userId ?? ''),
      name: String(item.displayName ?? item.name ?? item.username ?? 'Member'),
      avatarId: typeof item.avatarId === 'string' ? item.avatarId : undefined,
      avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : null,
    }))
    .filter((item) => item.userId);
  const compatibleAccounts = (accounts.data ?? []).filter(
    (item) =>
      item.ownerId === userId &&
      item.currency === currency &&
      item.archivedAt === undefined &&
      item.deletedAt === undefined,
  );
  const account = compatibleAccounts.find((item) => recordIds(item).includes(accountId));
  const availableCategories = (categories.data ?? []).filter(
    (item) => item.archivedAt === undefined && item.deletedAt === undefined,
  );
  const category = availableCategories.find((item) => recordIds(item).includes(categoryId));
  const unavailableMessage =
    !loading &&
    !dataError &&
    (!record ||
      !group ||
      !canEditGroupExpense(record, userId) ||
      typeof record.groupId !== 'string' ||
      !groupIds.includes(record.groupId))
      ? 'This expense is unavailable or you are not its creator.'
      : !loading && !dataError && !originalParticipants.length
        ? 'The expense split is unavailable. Sync the group and try again.'
        : undefined;
  let totalMinor: bigint | null = null;
  let shares: { userId: string; amountMinor: bigint }[] = [];
  let validation = '';
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const occurred = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : null;
  if (occurred && record) {
    const original = new Date(Number(record.occurredAt));
    occurred.setHours(
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
      original.getMilliseconds(),
    );
  }
  if (!isConnected) validation = 'Reconnect to edit this expense.';
  else if (!cloudId(record)) validation = 'Sync this expense before editing it.';
  else if (!account || !cloudId(account))
    validation = 'Choose a synced account in the group currency.';
  else if (categoryId && (!category || !cloudId(category)))
    validation = 'Choose a synced category.';
  else if (!title.trim()) validation = 'Enter what this expense was for.';
  else if (!occurred || dateText(occurred.getTime()) !== date)
    validation = 'Enter a valid date in YYYY-MM-DD format.';
  else if (
    !selectedIds.length ||
    selectedIds.some((id) => !members.some((member) => member.userId === id))
  )
    validation = 'Choose at least one current group member.';
  else {
    try {
      totalMinor = parseMinor(amount, currency);
      if (totalMinor <= 0n) throw new Error('Enter an amount greater than zero.');
      const values =
        method === 'equal'
          ? undefined
          : selectedIds.map((id) => {
              const value = (basis[id] ?? '').trim();
              if (!value) throw new Error('Enter a value for every selected member.');
              if (method === 'shares') {
                if (!/^\d+$/.test(value)) throw new Error('Shares must be whole numbers.');
                return BigInt(value);
              }
              return parseMinor(value, method === 'percentage' ? 'USD' : currency);
            });
      shares = allocateParticipants(totalMinor, selectedIds, method, values);
    } catch (cause) {
      validation =
        cause instanceof Error &&
        !['INVALID_SPLIT', 'INVALID_AMOUNT', 'INVALID_CURRENCY'].includes(cause.message)
          ? cause.message
          : 'Enter a valid amount and split values.';
    }
  }
  async function save() {
    if (lock.current || validation || !record || !account || totalMinor === null || !occurred)
      return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await updateExpense({
        transactionId: cloudId(record) as Id<'transactions'>,
        accountId: cloudId(account) as Id<'accounts'>,
        title: title.trim(),
        amountMinor: totalMinor,
        currency,
        occurredAt: occurred.getTime(),
        ...(category ? { categoryId: cloudId(category) as Id<'categories'> } : {}),
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        participants: shares.map((share) => ({
          userId: share.userId as Id<'users'>,
          amountMinor: share.amountMinor,
          method,
          ...(method === 'equal'
            ? {}
            : {
                basisValue: (method === 'shares'
                  ? BigInt(basis[share.userId]!)
                  : parseMinor(basis[share.userId]!, method === 'percentage' ? 'USD' : currency)
                ).toString(),
              }),
        })),
      });
      router.replace(`/transaction/${encodeURIComponent(recordId(record))}` as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this expense.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <GroupExpenseFormScreen
      mode="edit"
      signedIn={Boolean(userId)}
      loading={loading}
      dataError={dataError?.message}
      unavailableMessage={unavailableMessage}
      onRetry={() => states.forEach((state) => state.retry())}
      fixedGroupId={params.id}
      groups={[]}
      selectedGroupId={group ? recordId(group) : ''}
      groupName={String(group?.name ?? 'Group')}
      groupIcon={typeof group?.icon === 'string' ? group.icon : undefined}
      groupColor={typeof group?.color === 'string' ? group.color : undefined}
      currency={currency}
      accounts={compatibleAccounts.map((item) => ({
        id: recordId(item),
        name: displayAccountName(String(item.name ?? 'Account')),
      }))}
      selectedAccountId={account ? recordId(account) : ''}
      members={members}
      payerName={String(profiles.data?.[0]?.displayName ?? profiles.data?.[0]?.name ?? 'You')}
      title={title}
      amount={amount}
      date={date}
      merchant={merchant}
      note={note}
      categories={availableCategories.map((item) => ({
        id: recordId(item),
        name: String(item.name ?? 'Category'),
        icon: typeof item.icon === 'string' ? item.icon : undefined,
        color: typeof item.color === 'string' ? item.color : undefined,
      }))}
      selectedCategoryId={category ? recordId(category) : ''}
      method={method}
      selectedMemberIds={selectedIds}
      basis={basis}
      shares={shares}
      totalMinor={totalMinor}
      validation={validation}
      error={error}
      saving={saving}
      onAccountChange={setAccountId}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onDateChange={setDate}
      onMerchantChange={setMerchant}
      onNoteChange={setNote}
      onCategoryChange={setCategoryId}
      onMethodChange={(value) => {
        setMethod(value);
        setBasis({});
      }}
      onParticipantChange={(id, selected) =>
        setSelectedIds((current) =>
          selected
            ? current.includes(id)
              ? current
              : [...current, id]
            : current.filter((item) => item !== id),
        )
      }
      onBasisChange={(id, value) => setBasis((current) => ({ ...current, [id]: value }))}
      onSubmit={() => void save()}
      onBack={() => router.back()}
    />
  );
}
