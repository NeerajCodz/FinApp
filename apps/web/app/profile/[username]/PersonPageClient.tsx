'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { bilateralBalancesByCurrency } from '@convex/splits/domain';
import {
  ArrowLeft,
  ArrowLeftRight,
  ChartColumn,
  MessageCircle,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { Avatar, Empty } from '@finapp/ui/web';
import {
  FinanceEmptyState,
  formatTransactionDate,
  isAnalyticsLinkAvailable,
  isTimestampInRange,
  personStatus,
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
  id?: string;
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
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export default function PersonPage({ handle, profile, profileUnavailable }: PersonPageProps) {
  const router = useRouter();
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const endAt = Date.now() + 1;
  const startAt = endAt - NINETY_DAYS_MS;
  const person = profile?.username.toLowerCase() === handle ? profile : null;
  const otherId = person?.id && person.id !== userId ? (person.id as Id<'users'>) : null;
  const live = Boolean(userId && isConnected && otherId);
  const relationship = useQuery(
    api.social.queries.relationship,
    live && otherId ? { userId: otherId } : 'skip',
  );
  const analytics = useQuery(
    api.social.queries.personAnalytics,
    live && otherId ? { userId: otherId, tzOffsetMinutes: -new Date().getTimezoneOffset() } : 'skip',
  );
  const sendRequest = useMutation(api.social.mutations.sendRequest);
  const respondToRequest = useMutation(api.social.mutations.respondToRequest);
  const startConversation = useMutation(api.directMessages.mutations.startConversation);
  const [actionError, setActionError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'That didn\u2019t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
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
              item.deletedAt === undefined &&
              isTimestampInRange(Number(item.occurredAt ?? 0), startAt, endAt),
          )
          .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
      : [];
  // One balance per shared currency; group order never picks the currency.
  const balances =
    userId && personId
      ? bilateralBalancesByCurrency(
          userId,
          personId,
          sharedGroups,
          transactions,
          payers,
          participants,
          settlements,
        )
      : [];
  const bilateralBalance = balances[0]?.balanceMinor ?? 0n;
  const otherBalances = balances.slice(1).filter((row) => row.balanceMinor !== 0n);
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

  const isSelf = Boolean(userId && person?.id && person.id === userId);
  const status = relationship?.status;
  const presence = analytics ? personStatus(analytics) : '';
  const mutualFriends = relationship?.mutualFriends ?? [];
  const serverGroups = relationship?.sharedGroups ?? [];
  const groupCount = Math.max(sharedGroups.length, serverGroups.length);
  const splitHref =
    sharedGroups.length === 1
      ? `/split/new?groupId=${encodeURIComponent(idOf(sharedGroups[0]!))}`
      : '/split/new';
  const balanceError =
    rangeState === 'error' ||
    Boolean(
      groupsError ||
        membersError ||
        transactionsError ||
        payersError ||
        participantsError ||
        settlementsError,
    );
  const balanceLabel = !balanceAvailable
    ? balanceError
      ? 'Balance unavailable'
      : sharedGroups.length
        ? 'Loading balance…'
        : 'No shared groups'
    : bilateralBalance === 0n
      ? 'You’re even'
      : bilateralBalance > 0n
        ? 'They owe you'
        : 'You owe them';
  const since = analytics?.friendsSince ?? analytics?.conversationSince;

  const primaryAction = () => {
    if (!person?.id) return null;
    const personId = person.id as Id<'users'>;
    if (status === 'friends' || analytics?.conversationId)
      return (
        <button
          type="button"
          className="profile-action profile-action--primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const conversationId =
                analytics?.conversationId ?? (await startConversation({ userId: personId }));
              router.push(`/messages/${encodeURIComponent(String(conversationId))}`);
            })
          }
        >
          <MessageCircle size={17} /> Message
        </button>
      );
    const incomingId =
      relationship && 'incomingRequestId' in relationship
        ? relationship.incomingRequestId
        : undefined;
    if (status === 'incoming' && incomingId)
      return (
        <button
          type="button"
          className="profile-action profile-action--primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await respondToRequest({ requestId: incomingId, response: 'accept' });
            })
          }
        >
          <UserPlus size={17} /> Accept request
        </button>
      );
    if (status === 'outgoing')
      return (
        <button type="button" className="profile-action" disabled>
          Request sent
        </button>
      );
    if (status === 'none')
      return (
        <button
          type="button"
          className="profile-action profile-action--primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await sendRequest({ recipientId: personId });
            })
          }
        >
          <UserPlus size={17} /> Add friend
        </button>
      );
    return null;
  };

  return (
    <div className="finance-page finance-page--wide profile-page">
      <header className="profile-topbar">
        <Link className="profile-icon-button" href={userId ? '/network' : '/'} aria-label="Back">
          <ArrowLeft size={18} />
        </Link>
        <span className="profile-crumb">{userId ? 'People' : 'Finapp'}</span>
        <span aria-hidden>/</span>
        <span className="profile-crumb profile-crumb--current">
          {person ? person.displayName : `@${handle}`}
        </span>
      </header>
      {profileUnavailable ? (
        <section className="profile-card profile-error" role="alert">
          <p className="public-profile-eyebrow">Profile temporarily unavailable</p>
          <h2>We couldn’t load this profile.</h2>
          <p>Check your connection and try again.</p>
          <Link className="profile-action" href={`/@${encodeURIComponent(handle)}`}>
            Retry
          </Link>
        </section>
      ) : !person ? (
        <Empty title="Profile not found" description={`No public profile matches @${handle}.`} />
      ) : (
        <>
          <section className="profile-card profile-hero">
            <div className="profile-cover" aria-hidden />
            <div className="profile-hero-body">
              <span className="profile-avatar">
                <Avatar
                  initials={(person.displayName || handle).slice(0, 2).toUpperCase()}
                  label={`@${person.username}`}
                  size={104}
                  imageUrl={person.avatarUrl}
                  avatarId={person.avatarId}
                />
                {analytics?.active ? (
                  <span className="profile-online" role="img" aria-label="Active now" />
                ) : null}
              </span>
              <div className="profile-identity">
                <h1>{person.displayName}</h1>
                <p>
                  @{person.username}
                  {presence ? <span> · {presence}</span> : null}
                </p>
                <div className="profile-chips">
                  {isSelf ? <span className="profile-chip">This is you</span> : null}
                  {status === 'friends' ? (
                    <span className="profile-chip profile-chip--ok">Friends</span>
                  ) : null}
                  {status === 'incoming' ? (
                    <span className="profile-chip">Sent you a request</span>
                  ) : null}
                  {groupCount ? (
                    <span className="profile-chip">
                      {groupCount} shared {groupCount === 1 ? 'group' : 'groups'}
                    </span>
                  ) : null}
                  {mutualFriends.length ? (
                    <span className="profile-chip">{mutualFriends.length} mutual</span>
                  ) : null}
                </div>
              </div>
              <div className="profile-actions">
                {isSelf ? (
                  <Link className="profile-action profile-action--primary" href="/profile">
                    Edit profile
                  </Link>
                ) : userId ? (
                  <>
                    {primaryAction()}
                    {sharedGroups.length ? (
                      <>
                        <Link className="profile-action" href={splitHref}>
                          <UsersRound size={17} /> Split
                        </Link>
                        <Link
                          className="profile-action"
                          href={`/settle/${encodeURIComponent(routeToSettle)}`}
                        >
                          <ArrowLeftRight size={17} /> Settle
                        </Link>
                      </>
                    ) : null}
                    {person.id &&
                    isAnalyticsLinkAvailable(analytics, status === 'friends', groupCount) ? (
                      <Link
                        className="profile-icon-button"
                        href={`/network/person/${encodeURIComponent(person.id)}`}
                        aria-label={`${person.displayName} analytics`}
                        title="Analytics"
                      >
                        <ChartColumn size={18} />
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <Link className="profile-action profile-action--primary" href="/sign-in">
                    Sign in to connect
                  </Link>
                )}
              </div>
            </div>
            {actionError ? (
              <p className="finance-form-error profile-hero-error" role="alert">
                {actionError}
              </p>
            ) : null}
          </section>

          {userId && !isSelf ? (
            <section className="profile-stats" aria-label="Summary">
              <div className="profile-stat">
                <span>Balance</span>
                <strong>
                  {balanceAvailable ? (
                    <Money
                      amountMinor={bilateralBalance < 0n ? -bilateralBalance : bilateralBalance}
                      currency={balances[0]?.currency ?? 'INR'}
                      size="body"
                    />
                  ) : (
                    '—'
                  )}
                </strong>
                <small
                  data-tone={
                    !balanceAvailable
                      ? undefined
                      : bilateralBalance > 0n
                        ? 'positive'
                        : bilateralBalance < 0n
                          ? 'negative'
                          : undefined
                  }
                >
                  {balanceLabel}
                </small>
                {otherBalances.map((row) => (
                  <small key={row.currency}>
                    <Money
                      amountMinor={row.balanceMinor < 0n ? -row.balanceMinor : row.balanceMinor}
                      currency={row.currency}
                      size="body"
                    />{' '}
                    {row.balanceMinor > 0n ? 'they owe you' : 'you owe'}
                  </small>
                ))}
              </div>
              <div className="profile-stat">
                <span>Shared expenses</span>
                <strong>{recent.length}</strong>
                <small>Last 90 days</small>
              </div>
              <div className="profile-stat">
                <span>Messages</span>
                  <strong>
                    {analytics
                      ? `${analytics.totalMessages}${analytics.totalMessagesCapped ? '+' : ''}`
                      : '—'}
                  </strong>
                <small>Last 30 days</small>
              </div>
              <div className="profile-stat">
                <span>{analytics?.friends ? 'Friends since' : 'Connected since'}</span>
                <strong>
                  {since
                    ? new Date(since).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </strong>
                <small>{status === 'friends' ? 'Friends' : 'Not friends yet'}</small>
              </div>
            </section>
          ) : null}

          {userId && !isSelf ? (
            <div className="profile-columns">
              <section className="profile-card profile-panel">
                <header className="profile-panel-head">
                  <h2>Between you</h2>
                  {rangeState === 'loading' && sharedGroups.length ? (
                    <small role="status">Loading…</small>
                  ) : null}
                </header>
                {(rangeState === 'uncached' || rangeState === 'error') && (
                  <p
                    className={rangeState === 'error' ? 'finance-form-error' : 'finance-form-note'}
                    role={rangeState === 'error' ? 'alert' : 'status'}
                  >
                    {rangeError}
                  </p>
                )}
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
                    compact
                    title="Nothing shared yet"
                    description={
                      sharedGroups.length
                        ? 'Expenses between you will appear here.'
                        : 'Add them to a group to split expenses together.'
                    }
                  />
                )}
              </section>
              <aside className="profile-side">
                <section className="profile-card profile-panel">
                  <h2>Shared groups</h2>
                  {serverGroups.length ? (
                    <ul className="profile-list">
                      {serverGroups.map((group) => (
                        <li key={group.id}>
                          <Link href={`/group/${encodeURIComponent(group.id)}`}>
                            <span
                              className="profile-group-dot"
                              style={{ background: group.color ?? 'var(--finance-lime)' }}
                              aria-hidden
                            />
                            <span className="profile-list-copy">
                              <strong>{group.name}</strong>
                              <small>{group.memberCount} members</small>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="finance-muted">No shared groups yet.</p>
                  )}
                </section>
                <section className="profile-card profile-panel">
                  <h2>Mutual friends</h2>
                  {mutualFriends.length ? (
                    <ul className="profile-list">
                      {mutualFriends.map((friend) => (
                        <li key={friend.id}>
                          <Link
                            href={
                              friend.username
                                ? `/profile/${encodeURIComponent(friend.username)}`
                                : '/people'
                            }
                          >
                            <Avatar
                              initials={friend.displayName.slice(0, 2).toUpperCase()}
                              label={friend.displayName}
                              size={32}
                              imageUrl={friend.avatarUrl}
                              avatarId={friend.avatarId}
                            />
                            <span className="profile-list-copy">
                              <strong>{friend.displayName}</strong>
                              {friend.username ? <small>@{friend.username}</small> : null}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="finance-muted">No mutual friends.</p>
                  )}
                </section>
              </aside>
            </div>
          ) : !userId ? (
            <section className="profile-card profile-panel profile-cta">
              <h2>Split expenses with {person.displayName}</h2>
              <p className="finance-muted">
                Sign in to add them as a friend, share a group and settle up.
              </p>
              <Link className="profile-action profile-action--primary" href="/sign-up">
                Get started
              </Link>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
