'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { allocateParticipants } from '@convex/splits/domain';
import { parseMinor } from '@convex/shared/money';
import { GroupExpenseFormScreen, type GroupExpenseMethod } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { canEditGroupExpense } from '@/lib/groupExpense';
import { aliasesOf, idOf, minorToInput, syncedId } from '../../../_personal';

type RecordData = LocalRecord & {
  groupId?: string;
  transactionId?: string;
  userId?: string;
  memberId?: string;
  name?: string;
  displayName?: string;
  username?: string;
  currency?: string;
  ownerId?: string;
  accountId?: string;
  categoryId?: string;
  title?: string;
  merchant?: string;
  note?: string;
  amountMinor?: bigint | number | string;
  type?: string;
  status?: string;
  occurredAt?: number;
  method?: GroupExpenseMethod;
  basisValue?: string;
  archivedAt?: number;
  deletedAt?: number;
  avatarId?: string;
  avatarUrl?: string | null;
  icon?: string;
  color?: string;
};

const dateText = (value: number) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function GroupExpenseEditor({ transaction }: { transaction: RecordData }) {
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const groups = useLocalRecords<RecordData>('group');
  const members = useLocalRecords<RecordData>('groupMember');
  const accounts = useLocalRecords<RecordData>('account');
  const participants = useLocalRecords<RecordData>('expenseParticipant');
  const categories = useLocalRecords<RecordData>('category');
  const profiles = useLocalRecords<RecordData>('profile');
  const router = useRouter();
  const states = [groups, members, accounts, participants, profiles, categories];
  const loading = states.some((state) => state.loading);
  const error = states.find((state) => state.error)?.error;
  const back = () => router.push(`/transaction/${encodeURIComponent(idOf(transaction))}`);
  const [range, setRange] = React.useState<{ loading: boolean; error?: string }>({ loading: true });
  React.useEffect(() => {
    if (!isConnected || !transaction.groupId || !Number.isFinite(transaction.occurredAt)) {
      setRange({ loading: false });
      return;
    }
    let active = true;
    setRange({ loading: true });
    void fetchGroupRange(
      transaction.groupId,
      transaction.occurredAt!,
      transaction.occurredAt! + 1,
    ).then(
      () => {
        if (active) setRange({ loading: false });
      },
      (cause: unknown) => {
        if (active)
          setRange({
            loading: false,
            error: cause instanceof Error ? cause.message : 'Could not load the expense split.',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [fetchGroupRange, isConnected, transaction.groupId, transaction.occurredAt]);
  if (loading || range.loading)
    return (
      <div className="finance-page">
        <p role="status">Loading expense…</p>
      </div>
    );
  if (error || range.error)
    return (
      <div className="finance-page">
        <p role="alert">Could not load expense: {error ?? range.error}</p>
        <button onClick={back}>Back</button>
      </div>
    );
  if (!userId || !canEditGroupExpense(transaction, userId))
    return (
      <div className="finance-page">
        <p role="alert">Only the creator can edit this expense.</p>
        <button onClick={back}>Back</button>
      </div>
    );
  const group = groups.records.find(
    (record) => transaction.groupId && aliasesOf(record).includes(transaction.groupId),
  );
  const split = participants.records.filter(
    (record) =>
      record.deletedAt === undefined &&
      record.transactionId &&
      aliasesOf(transaction).includes(record.transactionId),
  );
  if (!group || !split.length)
    return (
      <div className="finance-page">
        <p role="alert">
          The group or expense split is unavailable. Open the group online and try again.
        </p>
        <button onClick={back}>Back</button>
      </div>
    );
  return (
    <EditForm
      transaction={transaction}
      group={group}
      split={split}
      members={members.records}
      accounts={accounts.records}
      categories={categories.records}
      profile={profiles.records[0]}
      userId={userId}
      onBack={back}
    />
  );
}

function EditForm({
  transaction,
  group,
  split,
  members,
  accounts,
  categories,
  profile,
  userId,
  onBack,
}: {
  transaction: RecordData;
  group: RecordData;
  split: RecordData[];
  members: RecordData[];
  accounts: RecordData[];
  categories: RecordData[];
  profile?: RecordData;
  userId: string;
  onBack: () => void;
}) {
  const { isConnected, fetchGroupRange } = useBrowserSync();
  const updateExpense = useMutation(api.groups.mutations.updateExpense);
  const [title, setTitle] = React.useState(transaction.title ?? '');
  const currency = transaction.currency ?? group.currency ?? '';
  const [amount, setAmount] = React.useState(() => minorToInput(transaction.amountMinor, currency));
  const [accountId, setAccountId] = React.useState(transaction.accountId ?? '');
  const [date, setDate] = React.useState(() => dateText(Number(transaction.occurredAt)));
  const [categoryId, setCategoryId] = React.useState(transaction.categoryId ?? '');
  const [merchant, setMerchant] = React.useState(transaction.merchant ?? '');
  const [note, setNote] = React.useState(transaction.note ?? '');
  const [method, setMethod] = React.useState<GroupExpenseMethod>(split[0]?.method ?? 'equal');
  const [selectedIds, setSelectedIds] = React.useState(() =>
    split.map((p) => String(p.userId ?? p.memberId ?? '')).filter(Boolean),
  );
  const [basis, setBasis] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      split.map((p) => {
        const value = p.basisValue ?? (p.method === 'exact' ? String(p.amountMinor ?? 0) : '0');
        return [
          String(p.userId ?? p.memberId ?? ''),
          p.method === 'shares'
            ? value
            : minorToInput(value, p.method === 'percentage' ? 'USD' : currency),
        ];
      }),
    ),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const groupIds = aliasesOf(group);
  const options = members
    .filter((m) => m.deletedAt === undefined && m.groupId && groupIds.includes(m.groupId))
    .map((m) => ({
      userId: String(m.userId ?? m.memberId ?? ''),
      name: String(m.displayName ?? m.name ?? (m.username ? `@${m.username}` : 'Group member')),
      avatarId: m.avatarId,
      avatarUrl: m.avatarUrl,
    }))
    .filter((m) => m.userId);
  if (!options.some((m) => m.userId === userId))
    options.unshift({
      userId,
      name: profile?.displayName ?? profile?.name ?? 'You',
      avatarId: profile?.avatarId,
      avatarUrl: profile?.avatarUrl,
    });
  const accountOptions = accounts.filter(
    (a) => a.ownerId === userId && a.currency === currency && a.archivedAt === undefined,
  );
  const account = accountOptions.find((a) => aliasesOf(a).includes(accountId));
  let validation = '';
  const categoryOptions = categories.filter(
    (item) =>
      item.ownerId === userId && item.archivedAt === undefined && item.deletedAt === undefined,
  );
  const category = categoryOptions.find((item) => aliasesOf(item).includes(categoryId));
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const occurred = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : null;
  const originalOccurredAt = Number(transaction.occurredAt);
  if (occurred && Number.isFinite(originalOccurredAt)) {
    const original = new Date(originalOccurredAt);
    occurred.setHours(
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
      original.getMilliseconds(),
    );
  }
  const occurredAt =
    date === dateText(originalOccurredAt) ? originalOccurredAt : occurred?.getTime();
  let totalMinor: bigint | null = null;
  let shares: Array<{ userId: string; amountMinor: bigint }> = [];
  if (!isConnected) validation = 'Reconnect to edit this expense.';
  else if (!syncedId(transaction) || !account || !syncedId(account))
    validation = 'Sync this expense and choose a synced account before editing.';
  else if (categoryId && (!category || !syncedId(category)))
    validation = 'Choose a synced category.';
  else if (!title.trim()) validation = 'Enter what this expense was for.';
  else if (
    !occurred ||
    dateText(occurred.getTime()) !== date ||
    !Number.isSafeInteger(occurredAt) ||
    occurredAt! <= 0
  )
    validation = 'Enter a valid date.';
  else if (!selectedIds.length || selectedIds.some((id) => !options.some((m) => m.userId === id)))
    validation = 'Choose current group members for the split.';
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
    } catch {
      validation =
        'Enter a valid amount and split. Exact amounts must match the total and percentages must add up to 100%.';
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const transactionId = syncedId(transaction);
    const cloudAccountId = account && syncedId(account);
    if (
      validation ||
      totalMinor === null ||
      !transactionId ||
      !cloudAccountId ||
      occurredAt === undefined ||
      lock.current
    )
      return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      await updateExpense({
        transactionId: transactionId as Id<'transactions'>,
        accountId: cloudAccountId as Id<'accounts'>,
        title: title.trim(),
        amountMinor: totalMinor,
        currency,
        occurredAt,
        ...(category && syncedId(category)
          ? { categoryId: syncedId(category) as Id<'categories'> }
          : {}),
        merchant: merchant.trim() || undefined,
        note: note.trim() || undefined,
        participants: shares.map((share) => ({
          ...share,
          userId: share.userId as Id<'users'>,
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
      try {
        await fetchGroupRange(
          idOf(group),
          Number(transaction.occurredAt),
          Number(transaction.occurredAt) + 1,
        );
        if (occurredAt !== originalOccurredAt) {
          await fetchGroupRange(idOf(group), occurredAt, occurredAt + 1);
        }
      } catch {
        setError(
          'Expense saved, but the refreshed group ledger could not be loaded. Reopen the group online to refresh it.',
        );
        return;
      }
      onBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this expense.');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }
  return (
    <GroupExpenseFormScreen
      mode="edit"
      signedIn
      fixedGroupId={idOf(group)}
      groups={[]}
      selectedGroupId={idOf(group)}
      groupName={group.name}
      groupIcon={group.icon}
      groupColor={group.color}
      currency={currency}
      accounts={accountOptions.map((a) => ({ id: idOf(a), name: a.name ?? 'Account' }))}
      selectedAccountId={account ? idOf(account) : ''}
      members={options}
      payerName={profile?.displayName ?? profile?.name ?? 'You'}
      payerAvatarId={profile?.avatarId}
      payerAvatarUrl={profile?.avatarUrl}
      title={title}
      amount={amount}
      method={method}
      selectedMemberIds={selectedIds}
      basis={basis}
      shares={shares}
      totalMinor={totalMinor}
      validation={validation}
      error={error}
      saving={saving}
      date={date}
      categories={[
        ...(categoryId && !category ? [{ id: categoryId, name: 'Unavailable category' }] : []),
        ...categoryOptions.map((item) => ({ id: idOf(item), name: item.name ?? 'Category' })),
      ]}
      selectedCategoryId={category ? idOf(category) : categoryId}
      merchant={merchant}
      note={note}
      onAccountChange={setAccountId}
      onTitleChange={setTitle}
      onAmountChange={setAmount}
      onDateChange={setDate}
      onCategoryChange={setCategoryId}
      onMerchantChange={setMerchant}
      onNoteChange={setNote}
      onMethodChange={(value) => {
        setMethod(value);
        setBasis({});
      }}
      onParticipantChange={(id, selected) =>
        setSelectedIds((current) =>
          selected
            ? [...current.filter((item) => item !== id), id]
            : current.filter((item) => item !== id),
        )
      }
      onBasisChange={(id, value) => setBasis((current) => ({ ...current, [id]: value }))}
      onSubmit={save}
      onBack={onBack}
    />
  );
}
