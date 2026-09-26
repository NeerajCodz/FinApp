'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Scale } from 'lucide-react';
import { calculateNetBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & { name?: string; currency?: string; ownerId?: string };
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
  deletedAt?: number;
  participants?: Array<{ userId: string; amountMinor: bigint | number | string }>;
  payerUserId?: string;
  payerAmountMinor?: bigint | number | string;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  username?: string;
  displayName?: string;
  name?: string;
  role?: string;
};
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

export default function GroupBalancesPage() {
  const { id: routeId } = useParams<{ id: string }>();
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
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
  const group = groups.find((item) => aliases(item).includes(routeId));
  const groupId = group ? idOf(group) : routeId;
  const groupReady = Boolean(group);
  React.useEffect(() => {
    if (!userId || !group) return;
    if (!isConnected) {
      setRangeState('uncached');
      setRangeError('Offline. Showing saved balances; this all-time range may be incomplete.');
      return;
    }
    let active = true;
    setRangeState('loading');
    setRangeError('');
    void fetchGroupRange(groupId, 0, Date.now() + 1).then(
      () => {
        if (active) setRangeState('loaded');
      },
      (cause: unknown) => {
        if (active) {
          setRangeState('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'All-time balances could not be loaded.',
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [fetchGroupRange, groupReady, groupId, isConnected, userId]);

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GROUP BALANCES</p>
        <h1>Settle what is shared.</h1>
        <p>Sign in to open saved balances and repayments.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  if (!group && groupsLoading)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Opening saved group…
        </p>
      </div>
    );
  if (!group)
    return (
      <div className="finance-page">
        <Link className="finance-secondary-action" href="/groups">
          <ArrowLeft size={15} /> Groups
        </Link>
        <Empty
          title="Group unavailable offline"
          description="Reconnect to refresh its membership and all-time ledger."
        />
      </div>
    );

  const groupIds = aliases(group);
  const eligible = transactions.filter(
    (item) =>
      typeof item.groupId === 'string' &&
      groupIds.includes(item.groupId) &&
      item.type === 'expense' &&
      item.status === 'posted' &&
      item.deletedAt === undefined &&
      item.currency === (group.currency ?? 'INR'),
  );
  const expenseIds = new Set(eligible.flatMap(aliases));
  const payerRows = payers.filter(
    (item) => typeof item.transactionId === 'string' && expenseIds.has(item.transactionId),
  );
  const participantRows = participants.filter(
    (item) => typeof item.transactionId === 'string' && expenseIds.has(item.transactionId),
  );
  let incompleteAllocation = false;
  const payerAmounts: Array<{ userId: string; amountMinor: bigint }> = [];
  const participantAmounts: Array<{ userId: string; amountMinor: bigint }> = [];
  for (const expense of eligible) {
    const expenseIds = aliases(expense);
    const relatedPayers = payerRows.filter(
      (item) => typeof item.transactionId === 'string' && expenseIds.includes(item.transactionId),
    );
    const relatedParticipants = participantRows.filter(
      (item) => typeof item.transactionId === 'string' && expenseIds.includes(item.transactionId),
    );
    const expensePayers = relatedPayers.length
      ? relatedPayers.map((item) => ({
          userId: String(item.userId ?? item.memberId ?? ''),
          amountMinor: asMinor(item.amountMinor),
        }))
      : expense.payerUserId
        ? [
            {
              userId: expense.payerUserId,
              amountMinor: asMinor(expense.payerAmountMinor ?? expense.amountMinor),
            },
          ]
        : [];
    const expenseParticipants = relatedParticipants.length
      ? relatedParticipants.map((item) => ({
          userId: String(item.userId ?? item.memberId ?? ''),
          amountMinor: asMinor(item.amountMinor),
        }))
      : (expense.participants ?? []).map((item) => ({
          userId: item.userId,
          amountMinor: asMinor(item.amountMinor),
        }));
    const expected = asMinor(expense.amountMinor);
    if (
      !expensePayers.length ||
      !expenseParticipants.length ||
      expensePayers.reduce((sum, item) => sum + item.amountMinor, 0n) !== expected ||
      expenseParticipants.reduce((sum, item) => sum + item.amountMinor, 0n) !== expected
    )
      incompleteAllocation = true;
    payerAmounts.push(...expensePayers);
    participantAmounts.push(...expenseParticipants);
  }
  const settlementRows = settlements
    .filter(
      (item) =>
        typeof item.groupId === 'string' &&
        groupIds.includes(item.groupId) &&
        item.currency === (group.currency ?? 'INR') &&
        item.deletedAt === undefined,
    )
    .map((item) => ({
      fromUserId: String(item.fromUserId ?? ''),
      toUserId: String(item.toUserId ?? ''),
      amountMinor: asMinor(item.amountMinor),
    }));
  let balances: Record<string, bigint> = {};
  let ledgerError = incompleteAllocation ? 'INCOMPLETE_GROUP_SPLITS' : '';
  if (!incompleteAllocation) {
    try {
      balances = calculateNetBalances(payerAmounts, participantAmounts, settlementRows);
    } catch (cause) {
      ledgerError = cause instanceof Error ? cause.message : 'Incomplete group ledger.';
    }
  }
  const groupMembers = members.filter(
    (member) => typeof member.groupId === 'string' && groupIds.includes(member.groupId),
  );
  if (
    group.ownerId === userId &&
    !groupMembers.some((member) => (member.userId ?? member.memberId) === userId)
  )
    groupMembers.unshift({ id: userId, userId, groupId, role: 'owner', displayName: 'You' });
  const names = new Map(
    groupMembers.map((member) => [
      String(member.userId ?? member.memberId ?? idOf(member)),
      String(
        member.userId === userId
          ? 'You'
          : (member.displayName ??
              member.name ??
              (member.username
                ? `@${member.username}`
                : `Member ${String(member.userId ?? '').slice(-6)}`)),
      ),
    ]),
  );
  const myBalance = balances[userId] ?? 0n;
  const counterparties = ledgerError
    ? []
    : [...names.entries()].filter(
        ([memberId]) =>
          memberId !== userId &&
          (myBalance < 0n
            ? (balances[memberId] ?? 0n) > 0n
            : myBalance > 0n
              ? (balances[memberId] ?? 0n) < 0n
              : false),
      );
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link className="finance-secondary-action" href={`/group/${encodeURIComponent(groupId)}`}>
            ‹ {group.name ?? 'Group'}
          </Link>
          <p className="finance-kicker">GROUP LEDGER · {group.currency ?? 'INR'}</p>
          <h1>Balances</h1>
          <p className="finance-muted">
            Balances use shared expenses and repayments. A repayment only records money already
            paid.
          </p>
        </div>
        <Badge
          variant={
            ledgerError
              ? 'danger'
              : myBalance === 0n
                ? 'neutral'
                : myBalance > 0n
                  ? 'success'
                  : 'danger'
          }
        >
          {ledgerError
            ? 'Unavailable'
            : myBalance === 0n
              ? 'Even'
              : myBalance > 0n
                ? 'You are owed'
                : 'You owe'}
        </Badge>
      </header>
      {(rangeState === 'loading' || rangeState === 'uncached' || rangeState === 'error') && (
        <p
          className={rangeState === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeState === 'error' ? 'alert' : 'status'}
        >
          {rangeState === 'loading' ? 'Loading all-time group range…' : rangeError}
        </p>
      )}
      {ledgerError && (
        <p className="finance-form-error" role="alert">
          Some expense allocations are missing: {ledgerError}. Reconnect to refresh the group range.
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader title="Member balances" action={<Scale size={17} />} />
        {names.size ? (
          <ul className="finance-record-list">
            {[...names.entries()].map(([memberId, name]) => {
              const amount = balances[memberId] ?? 0n;
              return (
                <li key={memberId}>
                  <span className="finance-record-copy">
                    <strong>{name}</strong>
                    <small>
                      {ledgerError
                        ? 'Balance unavailable'
                        : amount === 0n
                          ? 'Settled'
                          : amount > 0n
                            ? 'Owed to this member'
                            : 'This member owes'}
                    </small>
                  </span>
                  <strong className="finance-record-amount">
                    {ledgerError
                      ? 'Unavailable'
                      : formatMinor(amount < 0n ? -amount : amount, group.currency ?? 'INR')}
                  </strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="No group members saved"
            description="Membership appears here when group data is available on this device."
          />
        )}
      </Card>
      <Card className="finance-record-panel">
        <SectionHeader title="Repayment options" action={<ArrowLeftRight size={17} />} />
        {ledgerError ? (
          <Empty
            title="Repayments unavailable"
            description="Reconnect to load every expense allocation before calculating a safe bilateral amount."
          />
        ) : counterparties.length ? (
          <ul className="finance-record-list">
            {counterparties.map(([memberId, name]) => {
              const memberBalance = balances[memberId] ?? 0n;
              const max =
                myBalance < 0n
                  ? -myBalance < memberBalance
                    ? -myBalance
                    : memberBalance
                  : myBalance < -memberBalance
                    ? myBalance
                    : -memberBalance;
              return (
                <li key={memberId}>
                  <span className="finance-record-copy">
                    <strong>{myBalance < 0n ? `Pay ${name}` : `Receive from ${name}`}</strong>
                    <small>
                      Maximum bilateral repayment {formatMinor(max, group.currency ?? 'INR')}
                    </small>
                  </span>
                  <Link
                    className="finance-secondary-action"
                    href={`/settle/new?groupId=${encodeURIComponent(groupId)}&member=${encodeURIComponent(memberId)}`}
                  >
                    Record <ArrowRight size={15} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty
            title="No bilateral repayment due"
            description="A repayment option appears only when you and another member have opposite outstanding balances."
            action={
              <Link
                className="finance-secondary-action"
                href={`/settle/new?groupId=${encodeURIComponent(groupId)}`}
              >
                Open settlement form <ArrowRight size={15} />
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
