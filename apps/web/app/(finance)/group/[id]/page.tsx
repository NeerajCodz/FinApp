'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeftRight, ArrowRight, ClipboardList, Settings2 } from 'lucide-react';
import { calculateNetBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import { Badge, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  role?: string;
  username?: string;
  displayName?: string;
  name?: string;
};
type LedgerRecord = LocalRecord & {
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
const asMinor = (value: unknown) =>
  typeof value === 'bigint'
    ? value
    : typeof value === 'number' && Number.isFinite(value)
      ? BigInt(Math.trunc(value))
      : typeof value === 'string' && /^-?\d+$/.test(value)
        ? BigInt(value)
        : 0n;
const recordIds = (record: LocalRecord) =>
  [record.id, record._id, record.cloudId].filter(
    (value): value is string => typeof value === 'string',
  );
const recordId = (record: LocalRecord) => String(record.id ?? record._id ?? '');

export default function GroupHomePage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const {
    records: groups,
    loading: groupsLoading,
    error: groupsError,
  } = useLocalRecords<Group>('group');
  const { records: members } = useLocalRecords<Member>('groupMember');
  const { records: transactions } = useLocalRecords<LedgerRecord>('transaction');
  const { records: payers } = useLocalRecords<LedgerRecord>('expensePayer');
  const { records: participants } = useLocalRecords<LedgerRecord>('expenseParticipant');
  const { records: settlements } = useLocalRecords<LedgerRecord>('settlement');
  const [rangeStatus, setRangeStatus] = React.useState<
    'idle' | 'loading' | 'loaded' | 'uncached' | 'error'
  >('idle');
  const [rangeError, setRangeError] = React.useState('');
  const group = groups.find((item) => recordIds(item).includes(groupId));
  const groupIds = group ? recordIds(group) : [groupId];
  const localGroupId = group ? recordId(group) : groupId;
  const groupReady = Boolean(group);

  React.useEffect(() => {
    if (!userId || !group) return;
    if (!isConnected) {
      setRangeStatus('uncached');
      setRangeError('Offline. Showing saved records; the all-time range may be incomplete.');
      return;
    }
    let active = true;
    setRangeStatus('loading');
    setRangeError('');
    void fetchGroupRange(localGroupId, 0, Date.now() + 1).then(
      () => {
        if (active) setRangeStatus('loaded');
      },
      (cause: unknown) => {
        if (active) {
          setRangeStatus('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'The group range could not be loaded.',
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [fetchGroupRange, groupReady, isConnected, localGroupId, userId]);

  if (!userId)
    return (
      <section className="finance-welcome">
        <p className="finance-kicker">GROUP LEDGER</p>
        <h1>Shared expenses, clearly.</h1>
        <p>Sign in to open your local group records and shared balances.</p>
        <Link className="finance-primary-link" href="/sign-in">
          Sign in <ArrowRight size={16} />
        </Link>
      </section>
    );
  if (groupsLoading && !group)
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
          ‹ All groups
        </Link>
        <Empty
          title="Group not found on this device"
          description={
            groupsError
              ? `Local group data could not be read: ${groupsError}`
              : 'This group is not in the saved browser cache. Reconnect and open Groups to refresh membership.'
          }
          action={
            <Link className="finance-secondary-action" href="/groups">
              Return to groups <ArrowRight size={15} />
            </Link>
          }
        />
      </div>
    );

  const groupMembers = members.filter(
    (member) => typeof member.groupId === 'string' && groupIds.includes(member.groupId),
  );
  const expenses = transactions.filter(
    (record) =>
      typeof record.groupId === 'string' &&
      groupIds.includes(record.groupId) &&
      record.type === 'expense' &&
      record.status === 'posted' &&
      record.deletedAt === undefined &&
      record.currency === (group.currency ?? 'INR'),
  );
  const activeExpenses = expenses.filter((expense) => {
    const transactionIds = recordIds(expense);
    return transactionIds.length > 0;
  });
  const eligibleTransactionIds = new Set(activeExpenses.flatMap(recordIds));
  const payerRows = payers.filter(
    (item) =>
      typeof item.transactionId === 'string' && eligibleTransactionIds.has(item.transactionId),
  );
  const participantRows = participants.filter(
    (item) =>
      typeof item.transactionId === 'string' && eligibleTransactionIds.has(item.transactionId),
  );
  let incompleteAllocation = false;
  const payerAmounts: Array<{ userId: string; amountMinor: bigint }> = [];
  const participantAmounts: Array<{ userId: string; amountMinor: bigint }> = [];
  for (const expense of activeExpenses) {
    const expenseIds = recordIds(expense);
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
  let balanceByUser: Record<string, bigint> = {};
  let ledgerError = incompleteAllocation ? 'INCOMPLETE_GROUP_SPLITS' : '';
  if (!incompleteAllocation) {
    try {
      balanceByUser = calculateNetBalances(payerAmounts, participantAmounts, settlementRows);
    } catch (cause) {
      ledgerError = cause instanceof Error ? cause.message : 'The group balance is incomplete.';
    }
  }
  const myBalance = userId ? (balanceByUser[userId] ?? 0n) : 0n;
  const recent = [...activeExpenses]
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5);
  const memberNames = groupMembers.map((member) => ({
    id: String(member.userId ?? member.memberId ?? recordId(member)),
    username: member.username,
    name: String(
      member.userId === userId
        ? 'You'
        : (member.displayName ??
            member.name ??
            (member.username
              ? `@${member.username}`
              : `Member ${String(member.userId ?? '').slice(-6)}`)),
    ),
    balance: balanceByUser[String(member.userId ?? member.memberId ?? '')] ?? 0n,
  }));
  if (group.ownerId === userId && !memberNames.some((member) => member.id === userId))
    memberNames.unshift({ id: userId, username: undefined, name: 'You', balance: myBalance });
  const formatDate = (value: unknown) => new Date(Number(value ?? Date.now())).toLocaleDateString();

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link className="finance-secondary-action" href="/groups">
            ‹ All groups
          </Link>
          <p className="finance-kicker">SHARED GROUP · INR</p>
          <h1>{group.name ?? 'Shared group'}</h1>
          <p className="finance-muted">Group currency is fixed to Indian rupees.</p>
        </div>
        <div className="finance-page-actions">
          <Link
            className="finance-secondary-action"
            href={`/group/${encodeURIComponent(localGroupId)}/settings`}
          >
            <Settings2 size={15} /> Settings
          </Link>
          <Link
            className="finance-primary-link"
            href={`/group/${encodeURIComponent(localGroupId)}/expenses/new`}
          >
            Add expense <ArrowRight size={15} />
          </Link>
        </div>
      </header>
      {(rangeStatus === 'loading' || rangeStatus === 'uncached' || rangeStatus === 'error') && (
        <p
          className={rangeStatus === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeStatus === 'error' ? 'alert' : 'status'}
        >
          {rangeStatus === 'loading' ? 'Loading the all-time group range…' : rangeError}
        </p>
      )}
      {ledgerError && (
        <p className="finance-form-error" role="alert">
          Balance details need a complete expense allocation: {ledgerError}
        </p>
      )}
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader
            title="Your balance"
            action={
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
                    ? 'Settled'
                    : myBalance > 0n
                      ? 'You are owed'
                      : 'You owe'}
              </Badge>
            }
          />
          <strong className="finance-record-amount">
            {ledgerError
              ? 'Balance unavailable'
              : formatMinor(myBalance < 0n ? -myBalance : myBalance, group.currency ?? 'INR')}
          </strong>
          <p className="finance-muted">
            {ledgerError
              ? 'Complete allocations are not available on this device yet.'
              : myBalance === 0n
                ? 'Your group balance is even.'
                : 'A positive balance means members owe you; a negative balance means you owe the group.'}
          </p>
          <div className="finance-page-actions">
            <Link
              className="finance-secondary-action"
              href={`/group/${encodeURIComponent(localGroupId)}/balances`}
            >
              View balances <ArrowRight size={15} />
            </Link>
            <Link
              className="finance-secondary-action"
              href={`/settle/new?groupId=${encodeURIComponent(localGroupId)}`}
            >
              Record repayment <ArrowLeftRight size={15} />
            </Link>
          </div>
        </Card>
        <Card className="finance-record-panel">
          <SectionHeader
            title="Members"
            action={<Badge variant="neutral">{memberNames.length}</Badge>}
          />
          {memberNames.length ? (
            <ul className="finance-record-list">
              {memberNames.map((member) => (
                <li key={member.id}>
                  <span className="finance-record-copy">
                    <strong>{member.name}</strong>
                    <small>
                      {ledgerError
                        ? 'Balance unavailable'
                        : member.balance === 0n
                          ? 'Even'
                          : member.balance > 0n
                            ? `Owed ${formatMinor(member.balance, group.currency ?? 'INR')}`
                            : `Owes ${formatMinor(-member.balance, group.currency ?? 'INR')}`}
                    </small>
                  </span>
                  {member.id !== userId && member.username && (
                    <Link
                      className="finance-secondary-action"
                      href={`/person/${encodeURIComponent(member.username.replace(/^@+/, ''))}`}
                    >
                      Profile
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="finance-muted">
              Member details will appear after group membership syncs.
            </p>
          )}
        </Card>
      </div>
      <Card className="finance-record-panel">
        <SectionHeader
          title="Recent shared expenses"
          action={
            <Link
              className="finance-secondary-action"
              href={`/group/${encodeURIComponent(localGroupId)}/expenses`}
            >
              All expenses <ArrowRight size={15} />
            </Link>
          }
        />
        {recent.length ? (
          <ul className="finance-record-list">
            {recent.map((expense) => (
              <li key={recordId(expense)}>
                <span className="finance-record-symbol">
                  <ClipboardList size={17} />
                </span>
                <span className="finance-record-copy">
                  <strong>{expense.title ?? 'Group expense'}</strong>
                  <small>
                    {formatDate(expense.occurredAt)} ·{' '}
                    {expense.status === 'pending' ? 'Pending sync' : 'Shared expense'}
                  </small>
                </span>
                <strong className="finance-record-amount">
                  {formatMinor(asMinor(expense.amountMinor), group.currency ?? 'INR')}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            title="No shared expenses yet"
            description="Add an expense and choose the members who shared it."
            action={
              <Link
                className="finance-secondary-action"
                href={`/group/${encodeURIComponent(localGroupId)}/expenses/new`}
              >
                Add the first expense <ArrowRight size={15} />
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
