'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { projectGroupBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered } from '@/lib/offline/repository';
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
  const rangeEndAt = React.useMemo(() => Date.now() + 1, []);
  React.useEffect(() => {
    if (!userId || !group) return;
    let active = true;
    if (!isConnected) {
      void isGroupRangeCovered(userId, groupId, 0, rangeEndAt).then(
        (covered) => {
          if (!active) return;
          setRangeState(covered ? 'loaded' : 'uncached');
          setRangeError(
            covered
              ? ''
              : 'Offline. Saved group records are available, but balances are withheld because the all-time range may be incomplete.',
          );
        },
        (cause: unknown) => {
          if (!active) return;
          setRangeState('error');
          setRangeError(
            cause instanceof Error ? cause.message : 'Saved range coverage could not be checked.',
          );
        },
      );
      return () => {
        active = false;
      };
    }
    setRangeState('loading');
    setRangeError('');
    void fetchGroupRange(groupId, 0, rangeEndAt).then(
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
  }, [fetchGroupRange, groupReady, groupId, isConnected, rangeEndAt, userId]);

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
  const groupMembers = members.filter(
    (member) => typeof member.groupId === 'string' && groupIds.includes(member.groupId),
  );
  if (
    group.ownerId === userId &&
    !groupMembers.some((member) => (member.userId ?? member.memberId) === userId)
  )
    groupMembers.unshift({ id: userId, userId, groupId, role: 'owner', displayName: 'You' });
  const rangeComplete = rangeState === 'loaded';
  let balances: Record<string, bigint> = {};
  let ledgerError = '';
  if (rangeComplete) {
    try {
      balances = projectGroupBalances(
        group,
        transactions,
        payers,
        participants,
        settlements,
      ).balances;
    } catch (cause) {
      ledgerError = cause instanceof Error ? cause.message : 'Incomplete group ledger.';
    }
  }
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
  const ledgerUnavailable = !rangeComplete || Boolean(ledgerError);
  const myBalance = ledgerUnavailable ? 0n : (balances[userId] ?? 0n);
  const settled = !ledgerUnavailable && Object.values(balances).every((amount) => amount === 0n);
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <Link className="finance-secondary-action" href={`/group/${encodeURIComponent(groupId)}`}>
            <ArrowLeft size={15} /> {group.name ?? 'Group'}
          </Link>
          <p className="finance-kicker">GROUP LEDGER · {group.currency ?? 'INR'}</p>
          <h1>Balances</h1>
          <p className="finance-muted">
            Balances use shared expenses and repayments. A repayment only records money already
            paid.
          </p>
        </div>
      </header>
      {(rangeState === 'loading' || rangeState === 'uncached' || rangeState === 'error') && (
        <p
          className={rangeState === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeState === 'error' ? 'alert' : 'status'}
        >
          {rangeState === 'loading' ? 'Loading all-time group range…' : rangeError}
        </p>
      )}
      {rangeState === 'error' && isConnected && (
        <Button
          variant="outline"
          onPress={() => {
            setRangeState('loading');
            setRangeError('');
            void fetchGroupRange(groupId, 0, Date.now() + 1).then(
              () => setRangeState('loaded'),
              (cause: unknown) => {
                setRangeState('error');
                setRangeError(
                  cause instanceof Error ? cause.message : 'All-time balances could not be loaded.',
                );
              },
            );
          }}
        >
          Retry all-time range
        </Button>
      )}
      {ledgerError && (
        <p className="finance-form-error" role="alert">
          Some expense allocations are missing: {ledgerError}. Reconnect to refresh the group range.
        </p>
      )}
      <Card className="finance-record-panel">
        <SectionHeader
          title={`Your balance · ${group.name ?? 'Group'}`}
          action={
            <Badge
              variant={
                ledgerUnavailable
                  ? rangeState === 'loading'
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
            ? rangeState === 'loading'
              ? 'Loading…'
              : 'Balance unavailable'
            : formatMinor(myBalance, group.currency ?? 'INR')}
        </strong>
      </Card>
      <Card className="finance-record-panel">
        <SectionHeader title="Members" />
        {settled ? (
          <Empty title="All settled" description="Every member has a zero balance." />
        ) : names.size ? (
          <ul className="finance-record-list">
            {[...names.entries()].map(([memberId, name]) => {
              const amount = balances[memberId] ?? 0n;
              return (
                <li key={memberId}>
                  <span className="finance-record-copy">
                    <strong>{name}</strong>
                    <small>
                      {ledgerUnavailable
                        ? 'Balance unavailable'
                        : amount === 0n
                          ? 'Settled'
                          : amount > 0n
                            ? 'Is owed'
                            : 'Owes'}
                    </small>
                  </span>
                  <strong className="finance-record-amount">
                    {ledgerUnavailable
                      ? 'Unavailable'
                      : formatMinor(amount, group.currency ?? 'INR')}
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
    </div>
  );
}
