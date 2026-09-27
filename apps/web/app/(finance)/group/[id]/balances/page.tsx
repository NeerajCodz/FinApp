'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { projectGroupBalances } from '@convex/splits/domain';
import { Money } from '@finapp/ui/finance';
import { Button, Empty, SectionHeader } from '@finapp/ui/web';
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
        <Link
          className="finance-secondary-action"
          href={`/group/${encodeURIComponent(groupId)}`}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 style={{ margin: 0 }}>Balances</h1>
      </header>
      {(rangeState === 'uncached' || rangeState === 'error') && (
        <p
          className={rangeState === 'error' ? 'finance-form-error' : 'finance-form-note'}
          role={rangeState === 'error' ? 'alert' : 'status'}
        >
          {rangeError}
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
          Retry
        </Button>
      )}
      {ledgerUnavailable ? (
        rangeState === 'loading' ? (
          <p className="finance-muted" role="status">
            Loading all-time balances…
          </p>
        ) : (
          <Empty
            title="Balances unavailable"
            description={
              ledgerError
                ? `The complete group ledger could not be loaded. No partial balance is shown. ${ledgerError}`
                : rangeError ||
                  'The complete group ledger could not be loaded. No partial balance is shown.'
            }
          />
        )
      ) : (
        <>
          <section style={{ display: 'grid', gap: 8 }}>
            <strong>Your balance · {group.name ?? 'Group'}</strong>
            <Money
              amountMinor={myBalance}
              currency={group.currency ?? 'INR'}
              size="display"
            />
            <p className="finance-muted">
              {myBalance > 0n ? 'Owed to you' : myBalance < 0n ? 'You owe' : 'You are settled'}
            </p>
          </section>
          {settled ? (
            <Empty title="All settled" description="Every member has a zero balance." />
          ) : (
            <section style={{ display: 'grid', gap: 16 }}>
              <SectionHeader title="Members" />
              <ul className="finance-record-list">
                {[...names.entries()].map(([memberId, name]) => {
                  const amount = balances[memberId] ?? 0n;
                  return (
                    <li key={memberId}>
                      <span className="finance-record-copy">
                        <strong>{name}</strong>
                        <small>
                          {amount === 0n ? 'Settled' : amount > 0n ? 'Is owed' : 'Owes'}
                        </small>
                      </span>
                      <Money amountMinor={amount} currency={group.currency ?? 'INR'} />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
