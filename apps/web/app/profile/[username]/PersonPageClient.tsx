'use client';

import React from 'react';
import Link from 'next/link';
import { calculateBilateralBalance } from '@convex/splits/domain';
import { ArrowLeft, ArrowLeftRight, UsersRound } from 'lucide-react';
import { Avatar, Card, Empty, SectionHeader, Separator } from '@finapp/ui/web';
import {
  FinanceEmptyState,
  formatTransactionDate,
  Money,
  TransactionRow,
} from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & { name?: string; currency?: string };
type Member = LocalRecord & {
  deletedAt?: number;
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
  hasTime?: boolean;
  title?: string;
  deletedAt?: number;
  participants?: Array<{ userId: string; amountMinor: bigint | number | string }>;
  payerUserId?: string;
  payerAmountMinor?: bigint | number | string;
};
export type PublicProfile = {
  username: string;
  displayName: string;
  avatarId?: string;
  avatarUrl?: string | null;
};

type PersonPageProps = {
  handle: string;
  profile: PublicProfile | null;
  profileUnavailable: boolean;
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
const endAt = Date.now() + 1;
const startAt = endAt - 90 * 24 * 60 * 60 * 1000;

export default function PersonPage({ handle, profile, profileUnavailable }: PersonPageProps) {
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const person = profile?.username.toLowerCase() === handle ? profile : null;
  const {
    records: groups,
    loading: groupsLoading,
    error: groupsError,
  } = useLocalRecords<Group>('group');
  const {
    records: members,
    loading: membersLoading,
    error: membersError,
  } = useLocalRecords<Member>('groupMember');
  const {
    records: transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useLocalRecords<Entry>('transaction');
  const {
    records: payers,
    loading: payersLoading,
    error: payersError,
  } = useLocalRecords<Entry>('expensePayer');
  const {
    records: participants,
    loading: participantsLoading,
    error: participantsError,
  } = useLocalRecords<Entry>('expenseParticipant');
  const {
    records: settlements,
    loading: settlementsLoading,
    error: settlementsError,
  } = useLocalRecords<Entry>('settlement');
  const [rangeState, setRangeState] = React.useState<'loading' | 'loaded' | 'uncached' | 'error'>(
    'loading',
  );
  const [rangeError, setRangeError] = React.useState('');
  const matchingMember =
    userId && person
      ? members.find(
          (member) =>
            member.deletedAt === undefined &&
            member.username?.replace(/^@+/, '').toLowerCase() === handle,
        )
      : undefined;
  const personId = matchingMember
    ? String(matchingMember.userId ?? matchingMember.memberId ?? '')
    : undefined;
  const sharedGroups = React.useMemo(() => {
    if (!userId || !personId) return [];
    const memberGroupIds = new Set(
      members
        .filter(
          (member) =>
            member.deletedAt === undefined && (member.userId ?? member.memberId) === personId,
        )
        .map((member) => String(member.groupId ?? '')),
    );
    const viewerGroupIds = new Set(
      members
        .filter(
          (member) =>
            member.deletedAt === undefined && (member.userId ?? member.memberId) === userId,
        )
        .map((member) => String(member.groupId ?? '')),
    );
    return groups.filter((group) =>
      aliases(group).some((id) => memberGroupIds.has(id) && viewerGroupIds.has(id)),
    );
  }, [groups, members, personId, userId]);
  const rangeKey = sharedGroups
    .map((group) => idOf(group))
    .sort()
    .join('|');

  React.useEffect(() => {
    if (!userId || !personId) {
      setRangeState('loaded');
      return;
    }
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
  }, [fetchGroupRange, isConnected, rangeKey, userId, personId]);

  const groupIdAliases = new Set(sharedGroups.flatMap(aliases));
  const expenses =
    userId && personId
      ? transactions
          .filter(
            (item) =>
              typeof item.groupId === 'string' &&
              groupIdAliases.has(item.groupId) &&
              item.type === 'expense' &&
              item.status === 'posted' &&
              item.deletedAt === undefined,
          )
          .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
      : [];
  const bilateralBalance =
    userId && personId
      ? calculateBilateralBalance(
          userId,
          personId,
          sharedGroups,
          transactions,
          payers,
          participants,
          settlements,
        )
      : 0n;
  const balanceAvailable =
    Boolean(userId && personId && sharedGroups.length) &&
    rangeState === 'loaded' &&
    !groupsLoading &&
    !groupsError &&
    !membersLoading &&
    !membersError &&
    !transactionsLoading &&
    !transactionsError &&
    !payersLoading &&
    !payersError &&
    !participantsLoading &&
    !participantsError &&
    !settlementsLoading &&
    !settlementsError;
  const recent = expenses;
  const routeToSettle = personId ?? handle;

  return (
    <main className="public-profile-page">
      <div className="finance-page public-profile-content">
        <header className="public-profile-heading">
          <Link className="finance-secondary-action" href="/people" aria-label="Go back to People">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="public-profile-eyebrow">Finapp · People</p>
            <h1>Public profile</h1>
          </div>
        </header>
        {profileUnavailable ? (
          <div className="finance-record-panel public-profile-card" role="alert">
            <div className="public-profile-error">
              <p className="public-profile-eyebrow">PROFILE TEMPORARILY UNAVAILABLE</p>
              <h2>We couldn’t load this profile.</h2>
              <p>Check your connection and try again.</p>
              <Link className="finance-secondary-action" href={`/@${encodeURIComponent(handle)}`}>
                Retry
              </Link>
            </div>
          </div>
        ) : !person ? (
          <Empty title="Profile not found" description={`No public profile matches @${handle}.`} />
        ) : (
          <>
            <Card className="finance-record-panel public-profile-card">
              <div className="public-profile-hero">
                <Avatar
                  initials={(person.displayName || handle).slice(0, 2).toUpperCase()}
                  label={`@${person.username}`}
                  size={88}
                  imageUrl={person.avatarUrl}
                  avatarId={person.avatarId}
                />
                <div className="public-profile-identity">
                  <p className="public-profile-eyebrow">FINAPP MEMBER</p>
                  <h2>{person.displayName}</h2>
                  <p className="public-profile-handle">@{person.username}</p>
                </div>
              </div>
              <Separator />
              <p className="public-profile-note">
                Shared group activity appears here when you both belong to the same group.
              </p>
              {userId && sharedGroups.length > 0 && (
                <>
                  <Separator />
                  <div style={{ display: 'grid', gap: 5 }}>
                    {balanceAvailable ? (
                      <Money
                        amountMinor={bilateralBalance < 0n ? -bilateralBalance : bilateralBalance}
                        currency={String(sharedGroups[0]?.currency ?? 'INR')}
                        size="display"
                      />
                    ) : (
                      <p className="finance-muted">
                        Balance unavailable until saved group ranges are complete.
                      </p>
                    )}
                    <small>
                      {balanceAvailable
                        ? bilateralBalance === 0n
                          ? 'Even across shared groups'
                          : bilateralBalance > 0n
                            ? 'They owe you across shared groups'
                            : 'You owe across shared groups'
                        : 'Across shared groups'}
                    </small>
                  </div>
                </>
              )}
            </Card>
            {userId && sharedGroups.length > 0 && (
              <>
                <div className="finance-page-actions">
                  <Link
                    className="finance-primary-link"
                    href={
                      sharedGroups.length === 1
                        ? `/split/new?groupId=${encodeURIComponent(idOf(sharedGroups[0]!))}`
                        : '/split/new'
                    }
                  >
                    <UsersRound size={17} /> Split
                  </Link>
                  <Link
                    className="finance-secondary-action"
                    href={`/settle/${encodeURIComponent(routeToSettle)}`}
                  >
                    <ArrowLeftRight size={17} /> Settle
                  </Link>
                </div>
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
                <section style={{ display: 'grid', gap: 12 }}>
                  <SectionHeader title="Between you" />
                  {recent.length ? (
                    <div className="finance-record-list">
                      {recent.map((expense) => {
                        const group = sharedGroups.find((item) =>
                          aliases(item).includes(String(expense.groupId)),
                        );
                        return (
                          <TransactionRow
                            key={idOf(expense)}
                            title={expense.title ?? 'Group expense'}
                            category="Shared expense"
                            account={group?.name ?? 'Group'}
                            amountMinor={asMinor(expense.amountMinor)}
                            currency={expense.currency ?? group?.currency ?? 'INR'}
                            type="expense"
                            semanticType="split"
                            date={formatTransactionDate(
                              Number(expense.occurredAt ?? Date.now()),
                              expense.hasTime,
                            )}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <FinanceEmptyState
                      kind="activity"
                      title="Nothing shared yet."
                      description="Expenses between you will appear here, grouped across your shared groups."
                    />
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
