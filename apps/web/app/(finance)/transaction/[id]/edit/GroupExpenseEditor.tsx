'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ExpenseImpactSheet,
  GroupExpenseFormScreen,
  useExpenseComposer,
  type GroupExpenseMethod,
} from '@finapp/ui/finance';
import { basisInputFromRow, minorToInput, toBigInt } from '@finapp/ui/finance/expense-draft';
import { projectExpenseImpact, type ExpenseImpact } from '@finapp/ui/finance/expense-impact';
import { describeSyncError, syncErrorCode } from '@finapp/ui/finance/sync-errors';
import { lineItemDrafts } from '@finapp/ui/finance/line-items';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import type { LocalRecord } from '@/lib/offline/repository';
import { canEditGroupExpense } from '@/lib/groupExpense';
import { toast } from 'sonner';
import { aliases, idOf, rowsForExpense, useGroupLedger, type GroupPerson } from '@/lib/groupLedger';

const methods: readonly GroupExpenseMethod[] = [
  'equal',
  'exact',
  'percentage',
  'shares',
  'itemized',
];
const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Edits a group expense with the stepped composer, previews the balance impact and saves with
 * the version it was edited from (directly online, queued offline).
 */
export function GroupExpenseEditor({ transaction }: { transaction: LocalRecord }) {
  const router = useRouter();
  const { userId, isConnected, fetchGroupRange, updateGroupExpense } = useBrowserSync();
  const groupId = text(transaction.groupId);
  const data = useGroupLedger(groupId);
  const [range, setRange] = React.useState<{ loading: boolean; error?: string }>({
    loading: true,
  });
  const [reloads, setReloads] = React.useState(0);
  const occurredAt = Number(transaction.occurredAt);
  React.useEffect(() => {
    if (!isConnected || !groupId || !Number.isFinite(occurredAt)) {
      setRange({ loading: false });
      return;
    }
    let active = true;
    setRange({ loading: true });
    // Refresh this expense's split rows so the editor starts from the latest version.
    void fetchGroupRange(groupId, occurredAt, occurredAt + 1).then(
      () => active && setRange({ loading: false }),
      (cause: unknown) =>
        active &&
        setRange({
          loading: false,
          error: cause instanceof Error ? cause.message : 'Could not load the expense split.',
        }),
    );
    return () => {
      active = false;
    };
  }, [fetchGroupRange, groupId, isConnected, occurredAt, reloads]);

  const record =
    data.transactions.find((item) =>
      aliases(item).some((id) => aliases(transaction).includes(id)),
    ) ?? transaction;
  const payerRows = rowsForExpense(data.payers, record);
  const participantRows = rowsForExpense(data.participants, record);
  const currency = text(record.currency) || text(data.group?.currency);
  const locked = record.ownerId !== userId;
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
  const findAccount = (id: string) => accounts.find((item) => aliases(item).includes(id));
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
  const initialized = React.useRef(false);
  const { reset } = composer;
  React.useEffect(() => {
    if (initialized.current || range.loading || !participantRows.length || !payerRows.length)
      return;
    initialized.current = true;
    const stored = participantRows[0]?.method;
    const storedItems = lineItemDrafts(record.items, currency);
    const found = methods.find((item) => item === stored) ?? 'equal';
    // An itemized split needs its items; fall back to equal if they never synced.
    const method = found === 'itemized' && !storedItems.length ? 'equal' : found;
    const memberOf = (row: LocalRecord) => text(row.userId) || text(row.memberId);
    reset({
      title: text(record.title),
      amount: minorToInput(toBigInt(record.amountMinor) ?? 0n, currency),
      occurredAt: Number(record.occurredAt) || Date.now(),
      merchant: text(record.merchant),
      note: text(record.note),
      accountId: text(record.accountId),
      categoryId: text(record.categoryId),
      method,
      itemize: Boolean(storedItems.length),
      items: storedItems,
      participantIds: participantRows.map(memberOf),
      basis: Object.fromEntries(
        participantRows.map((row) => [memberOf(row), basisInputFromRow(method, row, currency)]),
      ),
      payerIds: payerRows.map(memberOf),
      payerAmounts:
        payerRows.length > 1
          ? Object.fromEntries(
              payerRows.map((row) => [
                memberOf(row),
                minorToInput(toBigInt(row.amountMinor) ?? 0n, currency),
              ]),
            )
          : {},
    });
  }, [range.loading, record, participantRows, payerRows, currency, reset, reloads]);

  const [impact, setImpact] = React.useState<ExpenseImpact | null>(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const back = () => router.push(`/transaction/${encodeURIComponent(idOf(transaction))}`);
  const unavailableMessage =
    data.loading || range.loading || data.error || range.error
      ? undefined
      : !data.group
        ? 'The group for this expense is not available. Open the group online and try again.'
        : !canEditGroupExpense(record, userId, data.roleOf(userId))
          ? 'Only the person who added this expense or a group admin can edit it.'
          : !participantRows.length || !payerRows.length
            ? 'The split for this expense has not loaded. Open the group online and try again.'
            : undefined;
  const account = findAccount(composer.accountId);
  const category = categories.find((item) => aliases(item).includes(composer.categoryId));

  function review() {
    if (composer.validation || !data.ledger || composer.draft.totalMinor === null) return;
    setImpact(
      projectExpenseImpact(data.ledger, idOf(record), {
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
    if (lock.current || composer.validation || totalMinor === null) return;
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
            : composer.categoryId
              ? // The current category is archived or not synced yet, so it isn't an option:
                // keep it rather than clearing it on an unrelated edit.
                { categoryId: text(record.categoryId) || undefined }
              : {}),
        title: composer.title,
        amountMinor: totalMinor,
        currency,
        occurredAt: composer.occurredAt,
        merchant: composer.merchant,
        note: composer.note,
        participants: composer.draft.participants,
        payers: composer.payerDraft.payers,
        items: composer.itemize ? composer.draft.items : [],
      });
      setReviewing(false);
      toast.success(
        result.queued
          ? 'Expense updated on this device. It syncs when you are back online.'
          : 'Expense updated. Everyone in the group sees the new balances.',
      );
      back();
    } catch (cause) {
      setReviewing(false);
      if (syncErrorCode(cause) === 'TRANSACTION_CHANGED') {
        setError(
          'Someone else changed this expense. We loaded the latest version — review it and save again.',
        );
        initialized.current = false;
        setReloads((count) => count + 1);
      } else setError(describeSyncError(cause, 'Could not update this expense.'));
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
        loading={data.loading || range.loading}
        dataError={data.error ?? range.error}
        unavailableMessage={unavailableMessage}
        onRetry={() => setReloads((count) => count + 1)}
        fixedGroupId={groupId}
        groups={[]}
        selectedGroupId={data.group ? idOf(data.group) : ''}
        groupName={text(data.group?.name) || 'Group'}
        groupIcon={text(data.group?.icon) || undefined}
        groupColor={text(data.group?.color) || undefined}
        currency={currency}
        accounts={accounts.map((item) => ({ id: idOf(item), name: text(item.name) || 'Account' }))}
        accountLocked={locked}
        categories={
          locked
            ? undefined
            : categories.map((item) => ({
                id: idOf(item),
                name: text(item.name) || 'Category',
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
        onBack={back}
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
