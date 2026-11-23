'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react';
import { Button, ListSkeleton } from '@finapp/ui/web';
import {
  GroupExpenseTimeline,
  IllustratedState,
  IncludePastExpensesSheet,
  LateJoinerBanner,
  SettleCard,
  settleStyles,
} from '@finapp/ui/finance';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
import { asMinor, localRecordId, recordAliases, useGroupLedger } from '@/lib/groups/useGroupLedger';
import { useLateJoiners } from '@/lib/groups/useLateJoiners';

type Category = LocalRecord & { name?: string; icon?: string; color?: string };

export default function GroupExpensesPage() {
  const router = useRouter();
  const { id: routeId } = useParams<{ id: string }>();
  const ledger = useGroupLedger(routeId);
  const { userId, isConnected, group, groupId, cloudGroupId, members, participants, currency } =
    ledger;
  const { records: categories } = useLocalRecords<Category>('category');
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    isConnected && cloudGroupId ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const currentMembers = remoteGroup
    ? remoteGroup.members.map((member) => ({
        userId: member.id,
        name: member.id === userId ? 'You' : member.displayName,
        joinedAt: member.joinedAt,
        role: member.role as string | undefined,
      }))
    : members.map((member) => ({
        userId: String(member.userId ?? member.memberId ?? ''),
        name:
          member.userId === userId
            ? 'You'
            : String(member.displayName ?? member.name ?? member.username ?? 'Member'),
        joinedAt: member.joinedAt,
        role: member.role,
      }));
  const myRole = currentMembers.find((member) => member.userId === userId)?.role;
  const lateJoiners = useLateJoiners({
    cloudGroupId,
    currency,
    expenses: ledger.expenses,
    participants,
    members: currentMembers,
    meId: userId,
    isAdmin:
      (remoteGroup ? remoteGroup.ownerId === userId : group?.ownerId === userId) ||
      myRole === 'owner' ||
      myRole === 'admin',
    isConnected,
  });

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GROUP EXPENSES</p>
        <h1>Keep shared spending together.</h1>
        <p>Sign in to view saved group expenses and create an allocation.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );

  const expenses = ledger.expenses.map((expense) => {
    const category = categories.find(
      (record) => expense.categoryId && recordAliases(record).includes(expense.categoryId),
    );
    return {
      id: localRecordId(expense),
      title: expense.title ?? 'Group expense',
      amountMinor: asMinor(expense.amountMinor),
      currency,
      occurredAt: Number(expense.occurredAt ?? 0),
      category: category?.name,
      icon: category?.icon,
      color: category?.color,
    };
  });
  const newHref = `/group/${encodeURIComponent(groupId)}/new`;

  return (
    <main className={`${settleStyles.page} ${settleStyles.narrow}`}>
      <header className={settleStyles.heading}>
        <Link
          className={settleStyles.back}
          href={group ? `/group/${encodeURIComponent(groupId)}` : '/groups'}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1>Expenses</h1>
          {group ? (
            <p className={settleStyles.muted}>
              {group.name ?? 'Group'} · {expenses.length} total
            </p>
          ) : null}
        </div>
        <Link className={settleStyles.back} href={newHref} aria-label="Add group expense">
          <Plus size={20} />
        </Link>
      </header>
      {lateJoiners.banners.map((joiner) => (
        <LateJoinerBanner
          key={joiner.userId}
          name={joiner.name}
          missedCount={joiner.missedCount}
          onInclude={() => lateJoiners.open(joiner.userId)}
          onDismiss={() => lateJoiners.dismiss(joiner.userId)}
        />
      ))}
      {!group && !ledger.groupsLoading ? (
        <IllustratedState
          scene="group"
          title="Group unavailable"
          description="This group is not saved in this browser. Reconnect, then open the group list again."
        />
      ) : ledger.status === 'unavailable' ? (
        <IllustratedState
          scene="offline"
          title="Expenses unavailable"
          description={ledger.error || 'The group history could not be loaded completely.'}
          action={
            isConnected ? (
              <Button variant="outline" onPress={ledger.retry}>
                Retry
              </Button>
            ) : undefined
          }
        />
      ) : ledger.status === 'loading' ? (
        <SettleCard>
          <ListSkeleton rows={5} />
        </SettleCard>
      ) : expenses.length ? (
        <GroupExpenseTimeline
          expenses={expenses}
          joins={lateJoiners.joins}
          onOpen={(expenseId) => router.push(`/transaction/${encodeURIComponent(expenseId)}`)}
        />
      ) : (
        <IllustratedState
          scene="splitBill"
          title="No group expenses yet"
          description="Add the first expense and choose who shared it."
          action={
            <Button variant="outline" onPress={() => router.push(newHref)}>
              Add expense
            </Button>
          }
        />
      )}
      <IncludePastExpensesSheet {...lateJoiners.sheet} />
    </main>
  );
}
