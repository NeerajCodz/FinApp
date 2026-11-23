'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
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
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import type { LocalRecord } from '@/lib/offline/repository';
import { canEditGroupExpense } from '@/lib/groupExpense';
import { FlashToast } from '@/lib/flash';
import { aliases, idOf, rowsForExpense, useGroupLedger } from '@/lib/groupLedger';

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** Detail of a shared expense: who paid, each share, edit/delete and the change history. */
export function GroupExpenseView({
  transaction,
  timeZone,
}: {
  transaction: LocalRecord;
  timeZone?: string;
}) {
  const router = useRouter();
  const { userId, isConnected, deleteGroupExpense } = useBrowserSync();
  const groupId = text(transaction.groupId);
  const data = useGroupLedger(groupId);
  const [deleting, setDeleting] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const currency = text(transaction.currency) || text(data.group?.currency) || 'INR';
  const cloudId = text(transaction.cloudId) || text(transaction._id);
  const history = useQuery(
    api.groups.queries.expenseHistory,
    isConnected && cloudId ? { transactionId: cloudId } : 'skip',
  );
  const person = (id: string) => data.members.find((member) => member.userId === id);
  const nameOf = (id: string) => person(id)?.name ?? 'Former member';
  const balances = data.ledger ? currentGroupBalances(data.ledger) : null;
  const payerRows = rowsForExpense(data.payers, transaction);
  const participantRows = rowsForExpense(data.participants, transaction);
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
  const canManage = canEditGroupExpense(transaction, userId, data.roleOf(userId));
  const category = data.categories.find((item) =>
    aliases(item).includes(text(transaction.categoryId)),
  );
  const deleteImpact = (() => {
    if (!data.ledger) return undefined;
    const impact = projectExpenseImpact(data.ledger, idOf(transaction), { kind: 'delete' });
    if (impact.status !== 'ready') return undefined;
    return [
      `It is removed for everyone and balances change for ${impact.changes.length} ${
        impact.changes.length === 1 ? 'person' : 'people'
      }. Recorded payments stay.`,
      ...impact.settled
        .filter((item) => item.credit)
        .map(
          (item) =>
            `${nameOf(item.userId)} already settled and will be owed ${formatMinor(item.after, currency)} back.`,
        ),
    ].join(' ');
  })();

  async function remove() {
    setDeleting(true);
    try {
      const result = await deleteGroupExpense(transaction);
      setNotice(
        result.queued
          ? 'Expense deleted on this device. It syncs when you are back online.'
          : 'Expense deleted. Balances were recalculated for the group.',
      );
    } catch (cause) {
      setNotice(describeSyncError(cause, 'Could not delete this expense. Please try again.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <FlashToast message={notice} />
      <GroupExpenseDetailScreen
        title={text(transaction.title) || text(transaction.merchant) || 'Shared expense'}
        amountMinor={toBigInt(transaction.amountMinor) ?? 0n}
        currency={currency}
        date={formatTransactionDate(
          Number(transaction.occurredAt),
          transaction.hasTime === true,
          timeZone ?? 'UTC',
        )}
        groupName={text(data.group?.name) || undefined}
        category={text(category?.name) || undefined}
        merchant={text(transaction.merchant) || undefined}
        note={text(transaction.note).trim() || undefined}
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
        unavailable={transaction.deletedAt !== undefined ? 'This expense was deleted.' : data.error}
        onBack={() =>
          router.push(groupId ? `/group/${encodeURIComponent(groupId)}` : '/transactions')
        }
        onEdit={() => router.push(`/transaction/${encodeURIComponent(idOf(transaction))}/edit`)}
        onDelete={remove}
        onOpenGroup={
          groupId ? () => router.push(`/group/${encodeURIComponent(groupId)}`) : undefined
        }
      />
    </>
  );
}
