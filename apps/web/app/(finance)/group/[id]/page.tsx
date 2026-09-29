'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ChartNoAxesCombined,
  Plus,
  Settings2,
} from 'lucide-react';
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
  const chatTimelineRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const timeline = chatTimelineRef.current;
    if (canUseGroupChat && chatMessages?.length && timeline)
      timeline.scrollTop = timeline.scrollHeight;
  }, [canUseGroupChat, chatMessages?.length]);

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
  const recentSettlements = settlements
    .filter(
      (record) =>
        typeof record.groupId === 'string' &&
        groupIds.includes(record.groupId) &&
        record.currency === (group.currency ?? 'INR') &&
        record.deletedAt === undefined,
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5);
  const memberName = (id: string | undefined) =>
    id === userId
      ? 'You'
      : (memberNames.find((member) => member.id === id)?.name ??
        (id ? `Member ${id.slice(-6)}` : 'Group member'));
  const formatDate = (value: unknown, hasTime?: boolean) =>
    formatTransactionDate(Number(value ?? Date.now()), hasTime);
  const chatTimelineItems = [
    ...recent.map((expense) => ({
      id: `expense:${recordId(expense)}`,
      kind: 'expense' as const,
      createdAt: Number(expense.occurredAt ?? 0),
      expense,
    })),
    ...recentSettlements.map((settlement) => ({
      id: `settlement:${recordId(settlement)}`,
      kind: 'settlement' as const,
      createdAt: Number(settlement.occurredAt ?? 0),
      settlement,
    })),
    ...(chatMessages ?? []).map((message) => ({
      id: `message:${message.id}`,
      kind: 'message' as const,
      createdAt: message.createdAt,
      message,
    })),
  ].sort((left, right) => left.createdAt - right.createdAt);
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
          href={`/group/${encodeURIComponent(localGroupId)}/analytics`}
          aria-label="Group analytics"
          title="Group analytics"
        >
          <ChartNoAxesCombined size={18} />
        </Link>
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
        <p id="group-chat-help" className="finance-muted">
          Messages and bill images are saved to this group when you are online. They are not queued
          for offline sending.
        </p>
        {canUseGroupChat ? (
          <>
            <div
              ref={chatTimelineRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Group messages"
              tabIndex={0}
              style={{
                display: 'grid',
                alignContent: 'start',
                gap: 10,
                minHeight: 180,
                maxHeight: 440,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                padding: 14,
                border: '1px solid var(--finance-border, rgba(127,127,127,.2))',
                borderRadius: 16,
                background: 'var(--finance-surface-subtle, rgba(127,127,127,.05))',
              }}
            >
              {chatMessages === undefined && (
                <p className="finance-muted" role="status">
                  Loading saved messages…
                </p>
              )}
              {chatTimelineItems.length ? (
                chatTimelineItems.map((item) => {
                  const createdAt = new Date(item.createdAt);
                  if (item.kind === 'message') {
                    const { message } = item;
                    const ownMessage = message.senderId === userId;
                    return (
                      <article
                        key={item.id}
                        aria-label={`${ownMessage ? 'You' : message.senderName}, ${createdAt.toLocaleString()}`}
                        style={{
                          display: 'grid',
                          justifySelf: ownMessage ? 'end' : 'start',
                          width: 'fit-content',
                          maxWidth: 'min(88%, 560px)',
                          gap: 6,
                          padding: '10px 13px',
                          border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
                          borderRadius: ownMessage ? '16px 16px 5px 16px' : '16px 16px 16px 5px',
                          background: ownMessage
                            ? 'var(--finance-accent-subtle, rgba(190,255,0,.12))'
                            : 'var(--finance-surface, rgba(127,127,127,.1))',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <strong style={{ fontSize: 13 }}>
                          {ownMessage ? 'You' : message.senderName}
                        </strong>
                        {message.kind === 'bill' ? (
                          message.attachmentUrl ? (
                            <a
                              href={message.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open bill image shared by ${ownMessage ? 'you' : message.senderName}`}
                            >
                              <img
                                src={message.attachmentUrl}
                                alt={`Bill shared by ${ownMessage ? 'you' : message.senderName}`}
                                style={{
                                  display: 'block',
                                  maxWidth: '100%',
                                  maxHeight: 320,
                                  borderRadius: 10,
                                  objectFit: 'contain',
                                }}
                              />
                            </a>
                          ) : (
                            <p className="finance-muted" style={{ margin: 0 }}>
                              Bill image is no longer available.
                            </p>
                          )
                        ) : (
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {message.text}
                          </p>
                        )}
                        <time
                          className="finance-muted"
                          dateTime={createdAt.toISOString()}
                          style={{ fontSize: 12 }}
                        >
                          {createdAt.toLocaleString()}
                        </time>
                      </article>
                    );
                  }
                  if (item.kind === 'expense') {
                    const { expense } = item;
                    return (
                      <article
                        key={item.id}
                        aria-label={`Shared expense: ${expense.title ?? 'Group expense'}, ${formatMinor(asMinor(expense.amountMinor), group.currency ?? 'INR')}`}
                        style={{
                          display: 'grid',
                          justifySelf: 'center',
                          width: 'min(100%, 540px)',
                          gap: 5,
                          padding: '11px 14px',
                          border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
                          borderLeft: '3px solid var(--finapp-split)',
                          borderRadius: 12,
                          background: 'var(--finance-surface-raised, rgba(127,127,127,.08))',
                        }}
                      >
                        <strong style={{ fontSize: 12 }}>Shared expense · Split</strong>
                        <span>{expense.title ?? 'Group expense'}</span>
                        <strong>
                          {formatMinor(asMinor(expense.amountMinor), group.currency ?? 'INR')}
                        </strong>
                        <time
                          className="finance-muted"
                          dateTime={createdAt.toISOString()}
                          style={{ fontSize: 12 }}
                        >
                          {formatDate(expense.occurredAt, expense.hasTime)}
                        </time>
                      </article>
                    );
                  }
                  const { settlement } = item;
                  const from = String(settlement.fromUserId ?? '');
                  const to = String(settlement.toUserId ?? '');
                  return (
                    <article
                      key={item.id}
                      aria-label={`Settlement: ${memberName(from)} paid ${memberName(to)}, ${formatMinor(asMinor(settlement.amountMinor), group.currency ?? 'INR')}`}
                      style={{
                        display: 'grid',
                        justifySelf: 'center',
                        width: 'min(100%, 540px)',
                        gap: 5,
                        padding: '11px 14px',
                        border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
                        borderLeft: '3px solid var(--finapp-settlement)',
                        borderRadius: 12,
                        background: 'var(--finance-surface-raised, rgba(127,127,127,.08))',
                      }}
                    >
                      <strong style={{ fontSize: 12 }}>Settlement</strong>
                      <span>
                        {memberName(from)} paid {memberName(to)}
                      </span>
                      <strong>
                        {formatMinor(asMinor(settlement.amountMinor), group.currency ?? 'INR')}
                      </strong>
                      <time
                        className="finance-muted"
                        dateTime={createdAt.toISOString()}
                        style={{ fontSize: 12 }}
                      >
                        {formatDate(settlement.occurredAt, true)}
                      </time>
                    </article>
                  );
                })
              ) : chatMessages !== undefined ? (
                <div
                  style={{
                    alignSelf: 'center',
                    justifySelf: 'center',
                    padding: '18px 8px',
                    textAlign: 'center',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: 5 }}>
                    Start the conversation
                  </strong>
                  <span className="finance-muted">
                    Share a note or attach a bill for the group.
                  </span>
                </div>
              ) : null}
            </div>
            <form
              className="finance-form"
              onSubmit={submitChatMessage}
              aria-describedby="group-chat-help"
            >
              <textarea
                aria-label="Group message"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.currentTarget.value)}
                maxLength={4_000}
                rows={3}
                placeholder="Write a message…"
                disabled={chatPending}
                style={{ resize: 'vertical', minHeight: 84 }}
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
                  {chatPending ? 'Sending…' : 'Send message'}
                </Button>
              </div>
              <p className="finance-muted" aria-live="polite">
                {chatPending ? 'Sending to the group…' : `${chatDraft.length}/4,000 characters`}
              </p>
            </form>
          </>
        ) : (
          <div
            style={{
              padding: 16,
              border: '1px solid var(--finance-border, rgba(127,127,127,.2))',
              borderRadius: 14,
            }}
          >
            <strong>{isConnected ? 'Chat is not synced yet' : 'Group chat is offline'}</strong>
            <p className="finance-muted" style={{ marginBottom: 0 }}>
              {isConnected
                ? 'This saved group has no connected cloud ID. Sync the group before using server chat or sharing bill images.'
                : 'Connect to the internet to load saved messages or send a message and bill image. Group ledger data remains available offline.'}
            </p>
          </div>
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
        <section>
          <SectionHeader title="Recent settlements" />
          {recentSettlements.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentSettlements.map((settlement) => {
                const from = String(settlement.fromUserId ?? '');
                const to = String(settlement.toUserId ?? '');
                return (
                  <Card
                    key={recordId(settlement)}
                    className="finance-record-panel"
                    style={{ display: 'grid', gap: 8 }}
                  >
                    <strong>
                      {memberName(from)} paid {memberName(to)}
                    </strong>
                    <span className="finance-record-amount">
                      {formatMinor(asMinor(settlement.amountMinor), group.currency ?? 'INR')}
                    </span>
                    {settlement.occurredAt !== undefined && (
                      <time
                        className="finance-muted"
                        dateTime={new Date(settlement.occurredAt).toISOString()}
                      >
                        {formatDate(settlement.occurredAt, true)}
                      </time>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="finance-muted">Settlements recorded for this group will appear here.</p>
          )}
        </section>
      </section>
    </div>
  );
}
