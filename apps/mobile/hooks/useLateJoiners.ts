import React from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  findLateJoiners,
  groupErrorMessage,
  includablePastExpenses,
  type PastExpenseCandidate,
  type TimelineJoin,
} from '@finapp/ui/finance';
import type { LocalRecord } from '@/local/repository';
import { recordId, recordIds } from '@/lib/ledger';
import { toast } from '@/lib/toast';

type JoinMember = { userId: string; name: string; joinedAt?: number };

const minor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;

/**
 * Late-joiner state for a group: "joined" markers for the expense timeline, admin banners and
 * the include-in-past-expenses sheet (online only; calls groups.addMembersToExpenses).
 */
export function useLateJoiners({
  cloudGroupId,
  currency,
  expenses,
  participants,
  members,
  meId,
  isAdmin,
  isConnected,
}: {
  cloudGroupId: string;
  currency: string;
  expenses: readonly LocalRecord[];
  participants: readonly LocalRecord[] | undefined;
  members: readonly JoinMember[];
  meId: string | null | undefined;
  isAdmin: boolean;
  isConnected: boolean;
}) {
  const addMembers = useMutation(api.groups.mutations.addMembersToExpenses);
  const [openUserId, setOpenUserId] = React.useState<string>();
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const candidates: PastExpenseCandidate[] = expenses.map((expense) => {
    const ids = recordIds(expense);
    return {
      id: recordId(expense),
      cloudId:
        typeof expense.cloudId === 'string'
          ? expense.cloudId
          : typeof expense._id === 'string'
            ? expense._id
            : undefined,
      title: String(expense.title ?? 'Group expense'),
      amountMinor: minor(expense.amountMinor),
      occurredAt: Number(expense.occurredAt ?? 0),
      ownerId: typeof expense.ownerId === 'string' ? expense.ownerId : undefined,
      participants: (participants ?? [])
        .filter((row) => typeof row.transactionId === 'string' && ids.includes(row.transactionId))
        .map((row) => ({
          userId: String(row.userId ?? row.memberId ?? ''),
          amountMinor: minor(row.amountMinor),
          method: typeof row.method === 'string' ? row.method : undefined,
          basisValue: typeof row.basisValue === 'string' ? row.basisValue : undefined,
        })),
    };
  });
  const lateJoiners = findLateJoiners(
    members,
    candidates.map((expense) => ({
      id: expense.id,
      occurredAt: expense.occurredAt,
      participantIds: expense.participants.map((participant) => participant.userId),
    })),
  );
  const joins: TimelineJoin[] = members.flatMap((member) =>
    member.joinedAt === undefined
      ? []
      : [{ userId: member.userId, name: member.name, joinedAt: member.joinedAt }],
  );
  const manageable = lateJoiners
    .filter((joiner) => !dismissed.includes(joiner.userId) && joiner.userId !== meId)
    .map((joiner) => ({
      joiner,
      expenses: includablePastExpenses(joiner, candidates, {
        meId: meId ?? '',
        isAdmin,
        currency,
      }),
    }))
    .filter((entry) => entry.expenses.some((expense) => expense.editable));
  const open = manageable.find((entry) => entry.joiner.userId === openUserId);

  async function confirm(expenseIds: string[]) {
    if (!open || busy) return;
    if (!isConnected || !cloudGroupId) {
      setError('You are offline. Reconnect to update past expenses.');
      return;
    }
    const cloudIds = open.expenses
      .filter((expense) => expenseIds.includes(expense.id) && expense.cloudId)
      .map((expense) => expense.cloudId as Id<'transactions'>);
    if (!cloudIds.length) return;
    setBusy(true);
    setError('');
    try {
      const changed = await addMembers({
        groupId: cloudGroupId as Id<'groups'>,
        expenseIds: cloudIds,
        userIds: [open.joiner.userId as Id<'users'>],
      });
      toast.success(`${open.joiner.name} added to ${changed} expense${changed === 1 ? '' : 's'}`, {
        description: 'Shares were recomputed for everyone on those expenses.',
      });
      setOpenUserId(undefined);
    } catch (cause) {
      setError(groupErrorMessage(cause, 'Could not update those expenses.'));
    } finally {
      setBusy(false);
    }
  }

  return {
    joins,
    banners: manageable.map((entry) => ({
      userId: entry.joiner.userId,
      name: entry.joiner.name,
      missedCount: entry.joiner.missedExpenseIds.length,
    })),
    open: (userId: string) => {
      setError('');
      setOpenUserId(userId);
    },
    dismiss: (userId: string) => setDismissed((current) => [...current, userId]),
    sheet: {
      visible: Boolean(open),
      memberName: open?.joiner.name ?? '',
      expenses: open?.expenses ?? [],
      busy,
      error: error || undefined,
      onClose: () => setOpenUserId(undefined),
      onConfirm: (ids: string[]) => void confirm(ids),
    },
  };
}
