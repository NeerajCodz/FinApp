'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Plus, Settings2 } from 'lucide-react';
import { projectGroupBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import { Avatar, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import { EntityIcon, formatTransactionDate, TransactionRow } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered } from '@/lib/offline/repository';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
  icon?: string;
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
  hasTime?: boolean;
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
  const router = useRouter();
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
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const cloudGroupId = groupIdentity.startsWith('local-') ? '' : groupIdentity;
  const canUseGroupChat = isConnected && Boolean(cloudGroupId);
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    canUseGroupChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const chatMessages = useQuery(
    api.groups.queries.chatMessages,
    canUseGroupChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const createChatUploadUrl = useMutation(api.groups.mutations.createChatUploadUrl);
  const sendChatText = useMutation(api.groups.mutations.sendChatText);
  const sendBillAttachment = useMutation(api.groups.mutations.sendBillAttachment);
  const [chatDraft, setChatDraft] = React.useState('');
  const [chatPending, setChatPending] = React.useState(false);
  const [chatError, setChatError] = React.useState('');

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
  const formatDate = (value: unknown, hasTime?: boolean) =>
    formatTransactionDate(Number(value ?? Date.now()), hasTime);
  async function submitChatMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUseGroupChat || !chatDraft.trim() || chatPending) return;
    setChatPending(true);
    setChatError('');
    try {
      await sendChatText({
        groupId: cloudGroupId as Id<'groups'>,
        text: chatDraft.trim(),
      });
      setChatDraft('');
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      setChatPending(false);
    }
  }

  async function uploadBillImage(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setChatError('Choose a JPEG, PNG, or WebP bill image up to 5 MB.');
      return;
    }
    if (!canUseGroupChat || chatPending) return;
    setChatPending(true);
    setChatError('');
    try {
      const uploadUrl = await createChatUploadUrl({ groupId: cloudGroupId as Id<'groups'> });
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) throw new Error('BILL_UPLOAD_FAILED');
      const result = (await response.json()) as { storageId?: string };
      if (!result.storageId) throw new Error('BILL_UPLOAD_FAILED');
      const messageId = await sendBillAttachment({
        groupId: cloudGroupId as Id<'groups'>,
        storageId: result.storageId as Id<'_storage'>,
      });
      if (!messageId) throw new Error('INVALID_BILL_IMAGE');
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not upload this bill image.');
    } finally {
      setChatPending(false);
    }
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <Link className="finance-secondary-action" href="/groups" aria-label="Go back to groups">
          <ArrowLeft size={18} />
        </Link>
        <EntityIcon
          value={
            remoteGroup
              ? (remoteGroup.icon ?? 'lucide:UsersRound')
              : (group.icon ?? 'lucide:UsersRound')
          }
          size={24}
        />
        <h1 style={{ flex: 1, margin: 0 }}>{group.name ?? 'Group'}</h1>
        <Link
          className="finance-secondary-action"
          href={`/group/${encodeURIComponent(localGroupId)}/settings`}
          aria-label="Group settings"
          title="Group settings"
        >
          <Settings2 size={18} />
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
        <SectionHeader title="Your balance" />
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
              ? 'You are settled'
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
      <Card className="finance-record-panel">
        <SectionHeader title="Group chat" />
        {canUseGroupChat ? (
          <>
            <div
              role="log"
              aria-live="polite"
              aria-label="Group messages"
              style={{ display: 'grid', gap: 12, maxHeight: 420, overflowY: 'auto' }}
            >
              {chatMessages === undefined ? (
                <p className="finance-muted" role="status">
                  Loading messages…
                </p>
              ) : chatMessages.length ? (
                chatMessages.map((message) => (
                  <article
                    key={message.id}
                    style={{
                      display: 'grid',
                      justifySelf: message.senderId === userId ? 'end' : 'start',
                      maxWidth: 'min(88%, 520px)',
                      gap: 6,
                      padding: 12,
                      borderRadius: 14,
                      background: 'var(--finance-surface-subtle, rgba(127,127,127,.08))',
                    }}
                  >
                    <strong>{message.senderName}</strong>
                    {message.kind === 'bill' && message.attachmentUrl ? (
                      <img
                        src={message.attachmentUrl}
                        alt="Bill attachment"
                        style={{
                          display: 'block',
                          maxWidth: '100%',
                          maxHeight: 360,
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                        {message.text}
                      </p>
                    )}
                    <time
                      className="finance-muted"
                      dateTime={new Date(message.createdAt).toISOString()}
                    >
                      {new Date(message.createdAt).toLocaleString()}
                    </time>
                  </article>
                ))
              ) : (
                <p className="finance-muted">No messages yet. Start the group conversation.</p>
              )}
            </div>
            <form className="finance-form" onSubmit={submitChatMessage}>
              <textarea
                aria-label="Group message"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.currentTarget.value)}
                maxLength={4_000}
                rows={3}
                placeholder="Write a message…"
                disabled={chatPending}
              />
              <div className="finance-page-actions">
                <label className="finance-secondary-action">
                  Attach bill image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Attach bill image"
                    disabled={chatPending}
                    onChange={(event) => void uploadBillImage(event)}
                  />
                </label>
                <Button type="submit" disabled={chatPending || !chatDraft.trim()}>
                  {chatPending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <p className="finance-muted">Connect to the internet to use group chat.</p>
        )}
        {!!chatError && (
          <p className="finance-form-error" role="alert">
            {chatError}
          </p>
        )}
      </Card>
      <section style={{ display: 'grid', gap: 24 }}>
        <section>
          <SectionHeader title="People" />
          {memberNames.length ? (
            <div
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBlock: 12,
              }}
            >
              {memberNames.map((member) => {
                const profileHref =
                  member.id !== userId && member.username
                    ? `/person/${encodeURIComponent(member.username.replace(/^@+/, ''))}`
                    : undefined;
                const item = (
                  <>
                    <Avatar
                      initials={member.name
                        .split(/\s+/)
                        .map((part) => part[0] ?? '')
                        .join('')
                        .slice(0, 2)}
                      label={member.name}
                      size={48}
                    />
                    <small>
                      {member.username ? `@${member.username.replace(/^@+/, '')}` : member.name}
                    </small>
                  </>
                );
                return profileHref ? (
                  <Link
                    key={member.id}
                    href={profileHref}
                    aria-label={`Open @${member.username}`}
                    style={{
                      display: 'grid',
                      width: 96,
                      flex: '0 0 96px',
                      justifyItems: 'center',
                      gap: 7,
                      color: 'inherit',
                      textDecoration: 'none',
                    }}
                  >
                    {item}
                  </Link>
                ) : (
                  <span
                    key={member.id}
                    style={{
                      display: 'grid',
                      width: 96,
                      flex: '0 0 96px',
                      justifyItems: 'center',
                      gap: 7,
                    }}
                  >
                    {item}
                  </span>
                );
              })}
            </div>
          ) : (
            <Empty
              title="No members saved"
              description="Members invited to this group will appear here."
            />
          )}
        </section>
        <section>
          <SectionHeader title="Recent" />
          {recent.length ? (
            <div className="finance-record-list">
              {recent.map((expense) => {
                const transactionId = recordId(expense);
                return (
                  <TransactionRow
                    key={transactionId}
                    title={expense.title ?? 'Group expense'}
                    category="Group expense"
                    account={group.name ?? 'Group'}
                    amountMinor={asMinor(expense.amountMinor)}
                    currency={group.currency ?? 'INR'}
                    type="expense"
                    semanticType="split"
                    date={formatDate(expense.occurredAt, expense.hasTime)}
                    onPress={() => router.push(`/transaction/${encodeURIComponent(transactionId)}`)}
                  />
                );
              })}
            </div>
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
        </section>
      </section>
    </div>
  );
}
