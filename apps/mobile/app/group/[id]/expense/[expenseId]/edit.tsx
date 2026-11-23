import React, { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ExpenseImpactSheet,
  GroupExpenseFormScreen,
  useExpenseComposer,
  type GroupExpenseMethod,
} from '@finapp/ui/finance';
import { basisInputFromRow, minorToInput, toBigInt } from '@finapp/ui/finance/expense-draft';
import { projectExpenseImpact, type ExpenseImpact } from '@finapp/ui/finance/expense-impact';
import { describeSyncError, syncErrorCode } from '@finapp/ui/finance/sync-errors';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { displayAccountName, recordId, recordIds } from '@/lib/ledger';
import { canEditGroupExpense } from '@/lib/groupExpenseEditing';
import { rowsForExpense, useExpenseLedger, type GroupPerson } from '@/hooks/useExpenseLedger';
import { toast } from '@/lib/toast';

const methods: readonly GroupExpenseMethod[] = ['equal', 'exact', 'percentage', 'shares'];
const text = (value: unknown) => (typeof value === 'string' ? value : '');

export default function EditGroupExpenseScreen() {
  const params = useLocalSearchParams<{ id: string; expenseId: string }>();
  const { userId, isConnected, updateGroupExpense } = useLocalSync();
  const data = useExpenseLedger(userId, params.id);
  const record = data.transactions.find((item) => recordIds(item).includes(params.expenseId));
  const payerRows = rowsForExpense(data.payers, record);
  const participantRows = rowsForExpense(data.participants, record);
  const currency = text(record?.currency) || text(data.group?.currency);
  const locked = Boolean(record && record.ownerId !== userId);
  // Members, plus anyone already on the expense who has since left the group.
  const people: GroupPerson[] = [...data.members];
  for (const row of [...payerRows, ...participantRows]) {
    const id = text(row.userId) || text(row.memberId);
    if (id && !people.some((person) => person.userId === id))
      people.push({ userId: id, name: 'Former member' });
  }
  const accounts = data.accounts.filter(
    (item) =>
      item.ownerId === userId &&
      item.currency === currency &&
      item.archivedAt === undefined &&
      item.deletedAt === undefined,
  );
  const findAccount = (id: string) => accounts.find((item) => recordIds(item).includes(id));
  const categories = data.categories.filter(
    (item) =>
      item.ownerId === userId && item.archivedAt === undefined && item.deletedAt === undefined,
  );
  const composer = useExpenseComposer({
    currency,
    currentUserId: userId,
    memberIds: people.map((person) => person.userId),
    detailsError: (values) =>
      locked || findAccount(values.accountId) ? '' : 'Choose an account in the group currency.',
  });
  const initialized = useRef(false);
  const [reloads, setReloads] = useState(0);
  const { reset } = composer;
  useEffect(() => {
    if (initialized.current || !record || !participantRows.length || !payerRows.length) return;
    initialized.current = true;
    const stored = participantRows[0]?.method;
    const method = methods.find((item) => item === stored) ?? 'equal';
    const multiple = payerRows.length > 1;
    reset({
      title: text(record.title),
      amount: minorToInput(toBigInt(record.amountMinor) ?? 0n, currency),
      occurredAt: Number(record.occurredAt) || Date.now(),
      merchant: text(record.merchant),
      note: text(record.note),
      accountId: text(record.accountId),
      categoryId: text(record.categoryId),
      method,
      participantIds: participantRows.map((row) => text(row.userId) || text(row.memberId)),
      basis: Object.fromEntries(
        participantRows.map((row) => [
          text(row.userId) || text(row.memberId),
          basisInputFromRow(method, row, currency),
        ]),
      ),
      payerIds: payerRows.map((row) => text(row.userId) || text(row.memberId)),
      payerAmounts: multiple
        ? Object.fromEntries(
            payerRows.map((row) => [
              text(row.userId) || text(row.memberId),
              minorToInput(toBigInt(row.amountMinor) ?? 0n, currency),
            ]),
          )
        : {},
    });
  }, [record, participantRows, payerRows, currency, reset, reloads]);

  const [impact, setImpact] = useState<ExpenseImpact | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const role = data.roleOf(userId);
  const unavailableMessage =
    data.loading || data.error
      ? undefined
      : !record || !data.group
        ? 'This expense is no longer available on this device.'
        : !canEditGroupExpense(record, userId, role)
          ? 'Only the person who added this expense or a group admin can edit it.'
          : !participantRows.length || !payerRows.length
            ? 'The split for this expense has not synced yet. Open the group and try again.'
            : undefined;
  const account = findAccount(composer.accountId);
  const category = categories.find((item) => recordIds(item).includes(composer.categoryId));

  function review() {
    if (composer.validation || !data.ledger || !record || composer.draft.totalMinor === null)
      return;
    setImpact(
      projectExpenseImpact(data.ledger, recordId(record), {
        kind: 'update',
        amountMinor: composer.draft.totalMinor,
        payers: composer.payerDraft.payers,
        participants: composer.draft.participants,
      }),
    );
    setReviewing(true);
  }

  async function save() {
    const totalMinor = composer.draft.totalMinor;
    if (lock.current || composer.validation || !record || totalMinor === null) return;
    lock.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await updateGroupExpense({
        transaction: record,
        payerRows,
        participantRows,
        ...(locked ? {} : { account }),
        ...(locked
          ? { categoryId: text(record.categoryId) || undefined }
          : category
            ? { category }
            : {}),
        title: composer.title,
        amountMinor: totalMinor,
        currency,
        occurredAt: composer.occurredAt,
        merchant: composer.merchant,
        note: composer.note,
        participants: composer.draft.participants,
        payers: composer.payerDraft.payers,
      });
      setReviewing(false);
      toast.success('Expense updated', {
        description: result.queued
          ? 'Saved on this device. It syncs when you are back online.'
          : 'Everyone in the group sees the new balances.',
      });
      router.replace(`/transaction/${encodeURIComponent(recordId(record))}` as never);
    } catch (cause) {
      setReviewing(false);
      if (syncErrorCode(cause) === 'TRANSACTION_CHANGED') {
        toast.error('Someone else changed this expense', {
          description: 'We loaded the latest version so you can edit it again.',
        });
        initialized.current = false;
        data.retry();
        setReloads((count) => count + 1);
      } else {
        const message = describeSyncError(cause, 'Could not update this expense.');
        setError(message);
        toast.error('Expense not updated', { description: message });
      }
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <GroupExpenseFormScreen
        mode="edit"
        signedIn={Boolean(userId)}
        loading={data.loading}
        dataError={data.error?.message}
        unavailableMessage={unavailableMessage}
        onRetry={data.retry}
        fixedGroupId={params.id}
        groups={[]}
        selectedGroupId={data.group ? recordId(data.group) : ''}
        groupName={text(data.group?.name) || 'Group'}
        groupIcon={text(data.group?.icon) || undefined}
        groupColor={text(data.group?.color) || undefined}
        currency={currency}
        accounts={accounts.map((item) => ({
          id: recordId(item),
          name: displayAccountName(String(item.name ?? 'Account')),
        }))}
        accountLocked={locked}
        categories={
          locked
            ? undefined
            : categories.map((item) => ({
                id: recordId(item),
                name: String(item.name ?? 'Category'),
                icon: text(item.icon) || undefined,
                color: text(item.color) || undefined,
              }))
        }
        members={people}
        currentUserId={userId}
        composer={composer}
        payerEditable
        offline={!isConnected}
        error={error}
        saving={saving}
        onSubmit={review}
        onBack={() => router.back()}
      />
      <ExpenseImpactSheet
        visible={reviewing}
        onClose={() => setReviewing(false)}
        onConfirm={() => void save()}
        impact={impact}
        people={people}
        currency={currency}
        saving={saving}
      />
    </>
  );
}
