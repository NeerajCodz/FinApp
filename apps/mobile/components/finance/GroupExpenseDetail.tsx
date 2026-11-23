import React from 'react';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { formatMinor } from '@convex/shared/money';
import { GroupExpenseDetailScreen, formatTransactionDate } from '@finapp/ui/finance';
import { toBigInt } from '@finapp/ui/finance/expense-draft';
import {
  currentGroupBalances,
  projectExpenseImpact,
  shareStatus,
} from '@finapp/ui/finance/expense-impact';
import { describeSyncError } from '@finapp/ui/finance/sync-errors';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { rowsForExpense, useExpenseLedger } from '@/hooks/useExpenseLedger';
import { canEditGroupExpense } from '@/lib/groupExpenseEditing';
import { recordId, recordIds } from '@/lib/ledger';
import { toast } from '@/lib/toast';

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Detail of a shared expense: who paid, each share, edit/delete and the change history. */
export function GroupExpenseDetail({ record }: { record: LocalRecord }) {
  const { userId, isConnected, deleteGroupExpense } = useLocalSync();
  const data = useExpenseLedger(userId, text(record.groupId));
  const [deleting, setDeleting] = React.useState(false);
  const currency = text(record.currency) || text(data.group?.currency) || 'INR';
  const cloudId = text(record.cloudId) || text(record._id);
  const history = useQuery(
    api.groups.queries.expenseHistory,
    isConnected && cloudId ? { transactionId: cloudId } : 'skip',
  );
  const person = (id: string) => data.members.find((member) => member.userId === id);
  const nameOf = (id: string) => person(id)?.name ?? 'Former member';
  const balances = data.ledger ? currentGroupBalances(data.ledger) : null;
  const payerRows = rowsForExpense(data.payers, record);
  const participantRows = rowsForExpense(data.participants, record);
  const payerIds = payerRows.map((row) => text(row.userId) || text(row.memberId));
  const view = (row: LocalRecord) => {
    const id = text(row.userId) || text(row.memberId);
    const member = person(id);
    return {
      userId: id,
      name: member?.name ?? 'Former member',
      avatarId: member?.avatarId,
      avatarUrl: member?.avatarUrl,
      amountMinor: toBigInt(row.amountMinor) ?? 0n,
    };
  };
  const role = data.roleOf(userId);
  const canManage = canEditGroupExpense(record, userId, role);
  const category = data.categories.find((item) =>
    recordIds(item).includes(text(record.categoryId)),
  );
  const deleteImpact = (() => {
    if (!data.ledger) return undefined;
    const impact = projectExpenseImpact(data.ledger, recordId(record), { kind: 'delete' });
    if (impact.status !== 'ready') return undefined;
    const credits = impact.settled
      .filter((item) => item.credit)
      .map(
        (item) =>
          `${nameOf(item.userId)} already settled and will be owed ${formatMinor(item.after, currency)} back.`,
      );
    return [
      `It is removed for everyone and balances change for ${impact.changes.length} ${
        impact.changes.length === 1 ? 'person' : 'people'
      }. Recorded payments stay.`,
      ...credits,
    ].join(' ');
  })();

  async function remove() {
    setDeleting(true);
    try {
      const result = await deleteGroupExpense(record);
      toast.success('Expense deleted', {
        description: result.queued
          ? 'Removed on this device. It syncs when you are back online.'
          : 'Balances were recalculated for the group.',
      });
      router.replace(`/group/${encodeURIComponent(text(record.groupId))}` as never);
    } catch (cause) {
      toast.error('Expense not deleted', {
        description: describeSyncError(cause, 'Please try again.'),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <GroupExpenseDetailScreen
      title={text(record.title) || text(record.merchant) || 'Shared expense'}
      amountMinor={toBigInt(record.amountMinor) ?? 0n}
      currency={currency}
      date={formatTransactionDate(Number(record.occurredAt), record.hasTime === true)}
      groupName={text(data.group?.name) || undefined}
      category={text(category?.name) || undefined}
      merchant={text(record.merchant) || undefined}
      note={text(record.note).trim() || undefined}
      payers={payerRows.map(view)}
      shares={participantRows.map((row) => {
        const share = view(row);
        return {
          ...share,
          status: shareStatus(share.userId, payerIds, balances),
          balanceMinor: balances?.[share.userId],
        };
      })}
      history={
        !isConnected || !cloudId
          ? { status: 'offline' }
          : history === undefined
            ? { status: 'loading' }
            : {
                status: 'ready',
                events: (history ?? []).map((event) => ({
                  id: event.id,
                  kind: event.kind,
                  actorName: event.actorName,
                  summary: event.summary,
                  createdAt: event.createdAt,
                  changes: Object.entries(event.balanceDeltas).map(([id, value]) => ({
                    name: nameOf(id),
                    amountMinor: BigInt(value),
                  })),
                })),
              }
      }
      canManage={canManage}
      manageHint={
        canManage ? undefined : 'Only the person who added it or a group admin can change it.'
      }
      pendingSync={!cloudId}
      deleting={deleting}
      deleteImpact={deleteImpact}
      loading={data.loading}
      unavailable={
        record.deletedAt !== undefined ? 'This expense was deleted.' : data.error?.message
      }
      onBack={() => router.back()}
      onEdit={() =>
        router.push(
          `/group/${encodeURIComponent(text(record.groupId))}/expense/${encodeURIComponent(recordId(record))}/edit` as never,
        )
      }
      onDelete={remove}
      onOpenGroup={() => router.push(`/group/${encodeURIComponent(text(record.groupId))}` as never)}
    />
  );
}
