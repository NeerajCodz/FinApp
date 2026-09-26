'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { formatMinor } from '@convex/shared/money';
import { ArrowLeft, ArrowLeftRight, ArrowRight, UsersRound } from 'lucide-react';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & { name?: string; currency?: string };
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  username?: string;
  displayName?: string;
  name?: string;
};
type Entry = LocalRecord & {
  groupId?: string;
  transactionId?: string;
  userId?: string;
  memberId?: string;
  fromUserId?: string;
  toUserId?: string;
  type?: string;
  status?: string;
  amountMinor?: bigint | number | string;
  currency?: string;
  occurredAt?: number;
  title?: string;
  deletedAt?: number;
  participants?: Array<{ userId: string; amountMinor: bigint | number | string }>;
  payerUserId?: string;
  payerAmountMinor?: bigint | number | string;
};
type UserSearchResult = { id: string; username?: string; displayName?: string; image?: string };
const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;
const aliases = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const idOf = (record: LocalRecord) => String(record.id ?? record._id ?? '');
const endAt = Date.now() + 1;
const startAt = endAt - 90 * 24 * 60 * 60 * 1000;

export default function PersonPage() {
  const { username: routeUsername } = useParams<{ username: string }>();
  const handle = routeUsername.replace(/^@+/, '').trim().toLowerCase();
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const searchResult = useQuery(
    api.users.queries.search,
    userId && handle.length >= 2 ? { query: handle } : 'skip',
  ) as UserSearchResult[] | undefined;
  const { records: groups, loading: groupsLoading } = useLocalRecords<Group>('group');
  const { records: members } = useLocalRecords<Member>('groupMember');
  const { records: transactions } = useLocalRecords<Entry>('transaction');
  const { records: payers } = useLocalRecords<Entry>('expensePayer');
  const { records: participants } = useLocalRecords<Entry>('expenseParticipant');
  const { records: settlements } = useLocalRecords<Entry>('settlement');
  const [rangeState, setRangeState] = React.useState<'loading' | 'loaded' | 'uncached' | 'error'>(
    'loading',
  );
  const [rangeError, setRangeError] = React.useState('');
  const matchingMember = members.find(
    (member) => member.username?.replace(/^@+/, '').toLowerCase() === handle,
  );
  const personId = matchingMember
    ? String(matchingMember.userId ?? matchingMember.memberId ?? '')
    : searchResult?.find((person) => person.username?.toLowerCase() === handle)?.id;
  const person = searchResult?.find((item) => item.username?.toLowerCase() === handle);
  const sharedGroups = React.useMemo(() => {
    const groupIdsForPerson = new Set(
      members
        .filter(
          (member) =>
            member.username?.replace(/^@+/, '').toLowerCase() === handle ||
            (personId && (member.userId ?? member.memberId) === personId),
        )
        .map((member) => String(member.groupId ?? '')),
    );
    return groups.filter((group) => aliases(group).some((id) => groupIdsForPerson.has(id)));
  }, [groups, handle, members, personId]);
  const rangeKey = sharedGroups
    .map((group) => idOf(group))
    .sort()
    .join('|');

  React.useEffect(() => {
    if (!userId) return;
    if (!sharedGroups.length) {
      setRangeState('loaded');
      return;
    }
    if (!isConnected) {
      setRangeState('uncached');
      setRangeError(
        'Offline. Saved group expenses remain visible, but one or more 90-day ranges may be incomplete.',
      );
      return;
    }
    let active = true;
    setRangeState('loading');
    setRangeError('');
    void Promise.all(
      sharedGroups.map((group) => fetchGroupRange(idOf(group), startAt, endAt)),
    ).then(
      () => {
        if (active) setRangeState('loaded');
      },
      (cause: unknown) => {
        if (active) {
          setRangeState('error');
          setRangeError(
            cause instanceof Error
              ? cause.message
              : 'One or more shared group ranges could not be loaded.',
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [fetchGroupRange, isConnected, rangeKey, userId]);

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">PERSON LOOKUP</p>
        <h1>See what you share.</h1>
        <p>Sign in to find a username inside groups saved to this browser.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  if (groupsLoading && !groups.length)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening saved groups…
        </p>
      </div>
    );

  const groupIdAliases = new Set(sharedGroups.flatMap(aliases));
  const expenses = transactions
    .filter(
      (item) =>
        typeof item.groupId === 'string' &&
        groupIdAliases.has(item.groupId) &&
        item.type === 'expense' &&
        item.status === 'posted' &&
        item.deletedAt === undefined,
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0));
  let bilateralBalance = 0n;
  if (personId && userId) {
    for (const expense of expenses) {
      const expenseIds = aliases(expense);
      const payerRows = payers.filter(
        (item) => typeof item.transactionId === 'string' && expenseIds.includes(item.transactionId),
      );
      const participantRows = participants.filter(
        (item) => typeof item.transactionId === 'string' && expenseIds.includes(item.transactionId),
      );
      const expensePayers: Array<{ userId?: string; memberId?: string; amountMinor?: unknown }> =
        payerRows.length
          ? payerRows
          : expense.payerUserId
            ? [
                {
                  userId: expense.payerUserId,
                  amountMinor: expense.payerAmountMinor ?? expense.amountMinor,
                },
              ]
            : [];
      const expenseParticipants: Array<{
        userId?: string;
        memberId?: string;
        amountMinor?: unknown;
      }> = participantRows.length ? participantRows : (expense.participants ?? []);
      for (const payer of expensePayers) {
        const payerId = String(payer.userId ?? payer.memberId ?? '');
        for (const share of expenseParticipants) {
          const participantId = String(share.userId ?? share.memberId ?? '');
          if (payerId === userId && participantId === personId)
            bilateralBalance += asMinor(share.amountMinor);
          else if (payerId === personId && participantId === userId)
            bilateralBalance -= asMinor(share.amountMinor);
        }
      }
    }
    for (const repayment of settlements) {
      if (
        typeof repayment.groupId !== 'string' ||
        !groupIdAliases.has(repayment.groupId) ||
        repayment.deletedAt !== undefined
      )
        continue;
      if (repayment.fromUserId === userId && repayment.toUserId === personId)
        bilateralBalance += asMinor(repayment.amountMinor);
      else if (repayment.fromUserId === personId && repayment.toUserId === userId)
        bilateralBalance -= asMinor(repayment.amountMinor);
    }
  }
  const displayName =
    person?.displayName ?? matchingMember?.displayName ?? matchingMember?.name ?? `@${handle}`;
  const recent = expenses.slice(0, 12);
  const searchPending = !person && !matchingMember && searchResult === undefined;
  const routeToSettle = personId ?? handle;

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link className="finance-secondary-action" href="/groups">
            <ArrowLeft size={15} /> Groups
          </Link>
          <p className="finance-kicker">SHARED CONTACT</p>
          <h1>{displayName}</h1>
          <p className="finance-muted">@{handle}</p>
        </div>
        <div className="finance-page-actions">
          <Link
            className="finance-secondary-action"
            href={`/settle/${encodeURIComponent(routeToSettle)}`}
          >
            <ArrowLeftRight size={15} /> Settle
          </Link>
          <Link
            className="finance-primary-link"
            href={
              sharedGroups.length === 1
                ? `/split/new?groupId=${encodeURIComponent(idOf(sharedGroups[0]!))}`
                : '/split/new'
            }
          >
            Split an expense <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      {rangeState === 'loading' && sharedGroups.length > 0 && (
        <p className="finance-form-note" role="status">
          Loading shared group ranges…
        </p>
      )}
      {(rangeState === 'uncached' || rangeState === 'error') && (
        <p
          className={rangeState === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeState === 'error' ? 'alert' : 'status'}
        >
          {rangeError}
        </p>
      )}
      {searchPending && (
        <p className="finance-form-note" role="status">
          Searching the server for this username. Group membership and expenses remain
          browser-local.
        </p>
      )}
      {!person && !matchingMember && searchResult && (
        <Empty
          title="Person not found"
          description={`No visible username matches @${handle}. Only public usernames returned by server search are used.`}
        />
      )}
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader
            title="Bilateral ledger snapshot"
            action={
              <Badge
                variant={
                  bilateralBalance === 0n ? 'neutral' : bilateralBalance > 0n ? 'success' : 'danger'
                }
              >
                {bilateralBalance === 0n
                  ? 'Even'
                  : bilateralBalance > 0n
                    ? 'They owe you'
                    : 'You owe'}
              </Badge>
            }
          />
          <strong className="finance-record-amount">
            {formatMinor(
              bilateralBalance < 0n ? -bilateralBalance : bilateralBalance,
              sharedGroups[0]?.currency ?? 'INR',
            )}
          </strong>
          <p className="finance-muted">
            This snapshot includes direct participant allocations and repayments found in your saved
            shared groups.
          </p>
        </Card>
        <Card className="finance-record-panel">
          <SectionHeader title="Shared groups" action={<UsersRound size={17} />} />
          {sharedGroups.length ? (
            <ul className="finance-record-list">
              {sharedGroups.map((group) => (
                <li key={idOf(group)}>
                  <span className="finance-record-copy">
                    <strong>{group.name ?? 'Shared group'}</strong>
                    <small>{group.currency ?? 'INR'} · saved on this device</small>
                  </span>
                  <Link
                    className="finance-secondary-action"
                    href={`/group/${encodeURIComponent(idOf(group))}`}
                  >
                    Open <ArrowRight size={15} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty
              title="No shared groups cached"
              description="This page uses saved memberships. Reconnect and open your groups to refresh the local membership list."
            />
          )}
        </Card>
      </div>
      <Card className="finance-record-panel">
        <SectionHeader
          title="Shared activity"
          action={<Badge variant="neutral">Last 90 days · {recent.length}</Badge>}
        />
        {recent.length ? (
          <ul className="finance-record-list">
            {recent.map((expense) => {
              const group = sharedGroups.find((item) =>
                aliases(item).includes(String(expense.groupId)),
              );
              return (
                <li key={idOf(expense)}>
                  <span className="finance-record-copy">
                    <strong>{expense.title ?? 'Group expense'}</strong>
                    <small>
                      {group?.name ?? 'Shared group'} ·{' '}
                      {new Date(Number(expense.occurredAt ?? Date.now())).toLocaleDateString()}
                    </small>
                  </span>
                  <strong className="finance-record-amount">
                    {formatMinor(
                      asMinor(expense.amountMinor),
                      expense.currency ?? group?.currency ?? 'INR',
                    )}
                  </strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="Nothing shared yet"
            description="Expenses in groups where both people are members appear here after their date ranges are saved."
          />
        )}
      </Card>
      <Link className="finance-secondary-action" href="/groups">
        Browse groups <ArrowRight size={15} />
      </Link>
    </div>
  );
}
