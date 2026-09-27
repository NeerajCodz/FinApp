'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ClipboardList,
  Plus,
  Settings2,
} from 'lucide-react';
import { projectGroupBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import { Avatar, Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered } from '@/lib/offline/repository';
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
  const rangeEndAt = React.useMemo(() => Date.now() + 1, []);

  React.useEffect(() => {
    if (!userId || !group) return;
    let active = true;
    if (!isConnected) {
      void isGroupRangeCovered(userId, localGroupId, 0, rangeEndAt).then(
        (covered) => {
          if (!active) return;
          setRangeStatus(covered ? 'loaded' : 'uncached');
          setRangeError(
            covered ? '' : 'Offline. Showing saved records; the all-time range may be incomplete.',
          );
        },
        (cause: unknown) => {
          if (!active) return;
          setRangeStatus('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'Saved range coverage could not be checked.',
          );
        },
      );
      return () => {
        active = false;
      };
    }
    setRangeStatus('loading');
    setRangeError('');
    void fetchGroupRange(localGroupId, 0, rangeEndAt).then(
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
  }, [fetchGroupRange, groupReady, isConnected, localGroupId, rangeEndAt, userId]);

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
  const rangeComplete = rangeStatus === 'loaded';
  let balanceByUser: Record<string, bigint> = {};
  let ledgerError = '';
  if (rangeComplete) {
    try {
      balanceByUser = projectGroupBalances(
        group,
        transactions,
        payers,
        participants,
        settlements,
      ).balances;
    } catch (cause) {
      ledgerError = cause instanceof Error ? cause.message : 'The group balance is incomplete.';
    }
  }
  const ledgerUnavailable = !rangeComplete || Boolean(ledgerError);
  const myBalance = ledgerUnavailable ? 0n : userId ? (balanceByUser[userId] ?? 0n) : 0n;
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
  }));
  if (group.ownerId === userId && !memberNames.some((member) => member.id === userId))
    memberNames.unshift({ id: userId, username: undefined, name: 'You' });
  const formatDate = (value: unknown) => new Date(Number(value ?? Date.now())).toLocaleDateString();

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link className="finance-secondary-action" href="/groups">
            <ArrowLeft size={15} /> All groups
          </Link>
          <p className="finance-kicker">SHARED GROUP · {group.currency ?? 'INR'}</p>
          <h1>{group.name ?? 'Shared group'}</h1>
          <p className="finance-muted">Group currency is fixed to {group.currency ?? 'INR'}.</p>
        </div>
        <Link
          className="finance-secondary-action"
          href={`/group/${encodeURIComponent(localGroupId)}/settings`}
          aria-label="Group settings"
          title="Group settings"
        >
          <Settings2 size={18} /> Settings
        </Link>
      </header>
      {(rangeStatus === 'loading' || rangeStatus === 'uncached' || rangeStatus === 'error') && (
        <p
          className={rangeStatus === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeStatus === 'error' ? 'alert' : 'status'}
        >
          {rangeStatus === 'loading' ? 'Loading the all-time group range…' : rangeError}
        </p>
      )}
      {rangeStatus === 'error' && isConnected && (
        <Button
          variant="outline"
          onPress={() => {
            setRangeStatus('loading');
            setRangeError('');
            void fetchGroupRange(localGroupId, 0, Date.now() + 1).then(
              () => setRangeStatus('loaded'),
              (cause: unknown) => {
                setRangeStatus('error');
                setRangeError(
                  cause instanceof Error ? cause.message : 'The group range could not be loaded.',
                );
              },
            );
          }}
        >
          Retry range
        </Button>
      )}
      {ledgerError && (
        <p className="finance-form-error" role="alert">
          Complete group balances are unavailable. No partial value is shown. {ledgerError}
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title="Your balance"
          action={
            <Badge
              variant={
                ledgerUnavailable
                  ? rangeStatus === 'loading'
                    ? 'neutral'
                    : 'danger'
                  : myBalance === 0n
                    ? 'neutral'
                    : myBalance > 0n
                      ? 'success'
                      : 'danger'
              }
            >
              {ledgerUnavailable
                ? 'Unavailable'
                : myBalance === 0n
                  ? 'You are settled'
                  : myBalance > 0n
                    ? 'Owed to you'
                    : 'You owe'}
            </Badge>
          }
        />
        <strong className="finance-record-amount">
          {ledgerUnavailable
            ? rangeStatus === 'loading' && !ledgerError
              ? 'Loading…'
              : 'Balance unavailable'
            : formatMinor(myBalance, group.currency ?? 'INR')}
        </strong>
        <p className="finance-muted">
          {ledgerUnavailable
            ? rangeStatus === 'loading' && !ledgerError
              ? 'Loading all-time balance…'
              : 'Complete group balances are unavailable. No partial value is shown.'
            : myBalance === 0n
              ? 'You are settled.'
              : myBalance > 0n
                ? 'Owed to you'
                : 'You owe'}
        </p>
        <div className="finance-page-actions">
          <Link
            className="finance-secondary-action"
            href={`/group/${encodeURIComponent(localGroupId)}/balances`}
          >
            View member balances <ArrowRight size={15} />
          </Link>
          {myBalance !== 0n && (
            <Link
              className="finance-secondary-action"
              href={`/settle/new?groupId=${encodeURIComponent(localGroupId)}`}
            >
              Record a settlement <ArrowLeftRight size={15} />
            </Link>
          )}
        </div>
      </Card>
      <Link
        className="finance-primary-link"
        href={`/group/${encodeURIComponent(localGroupId)}/expenses/new`}
      >
        <Plus size={17} /> Add expense
      </Link>
      <div className="finance-accounts-layout">
        <Card className="finance-record-panel">
          <SectionHeader
            title="People"
            action={<Badge variant="neutral">{memberNames.length}</Badge>}
          />
          {memberNames.length ? (
            <ul className="finance-record-list">
              {memberNames.map((member) => (
                <li key={member.id}>
                  <Avatar
                    initials={member.name
                      .split(/\s+/)
                      .map((part) => part[0] ?? '')
                      .join('')
                      .slice(0, 2)}
                    label={member.name}
                    size={42}
                  />
                  <span className="finance-record-copy">
                    <strong>{member.name}</strong>
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
            <Empty
              title="No members saved"
              description="Members invited to this group will appear here."
            />
          )}
        </Card>
        <Card className="finance-record-panel">
          <SectionHeader title="Recent" />
          {recent.length ? (
            <ul className="finance-record-list">
              {recent.map((expense) => (
                <li key={recordId(expense)}>
                  <span className="finance-record-symbol">
                    <ClipboardList size={17} />
                  </span>
                  <span className="finance-record-copy">
                    <strong>
                      <Link
                        href={`/transaction/${encodeURIComponent(recordId(expense))}`}
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {expense.title ?? 'Group expense'}
                      </Link>
                    </strong>
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
              title="No shared expenses"
              description="Add an expense to start your group history."
              action={
                <Link
                  className="finance-secondary-action"
                  href={`/group/${encodeURIComponent(localGroupId)}/expenses/new`}
                >
                  Add expense <ArrowRight size={15} />
                </Link>
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
}
