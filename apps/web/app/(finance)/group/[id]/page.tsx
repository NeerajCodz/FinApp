'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowRight } from 'lucide-react';
import { projectGroupBalances } from '@convex/splits/domain';
import { formatMinor } from '@convex/shared/money';
import { Empty } from '@finapp/ui/web';
import { formatTransactionDate } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { isGroupRangeCovered } from '@/lib/offline/repository';
import {
  GroupDetailScreen,
  type GroupDetailActivity,
  type GroupDetailMember,
  type GroupDetailSettlement,
} from '@finapp/ui/finance';
import type { GroupChatItem } from '@finapp/ui/finance';
import type { LocalRecord } from '@/lib/offline/repository';

type Group = LocalRecord & {
  name?: string;
  currency?: string;
  ownerId?: string;
  archivedAt?: number;
  icon?: string;
  color?: string;
};
type Member = LocalRecord & {
  groupId?: string;
  userId?: string;
  memberId?: string;
  role?: string;
  username?: string;
  displayName?: string;
  name?: string;
  avatarUrl?: string | null;
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
    avatarUrl: member.avatarUrl,
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
    memberNames.unshift({ id: userId, username: undefined, avatarUrl: null, name: 'You' });
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
  const groupChatItems: GroupChatItem[] = chatTimelineItems.map((item) => {
    const date = new Date(item.createdAt);
    if (item.kind === 'message') {
      const message = item.message;
      const ownMessage = message.senderId === userId;
      return {
        id: item.id,
        kind: 'message',
        date: date.toLocaleString(),
        accessibleLabel: `${ownMessage ? 'You' : message.senderName}, ${date.toLocaleString()}`,
        sender: message.senderName,
        ownMessage,
        text: message.kind === 'text' ? message.text : undefined,
        attachmentUrl: message.kind === 'bill' ? message.attachmentUrl : undefined,
      };
    }
    if (item.kind === 'expense') {
      const expense = item.expense;
      return {
        id: item.id,
        kind: 'expense',
        date: formatDate(expense.occurredAt, expense.hasTime),
        accessibleLabel: `Shared expense: ${expense.title ?? 'Group expense'}`,
        title: expense.title ?? 'Group expense',
        amount: formatMinor(asMinor(expense.amountMinor), group.currency ?? 'INR'),
      };
    }
    const settlement = item.settlement;
    const from = memberName(String(settlement.fromUserId ?? ''));
    const to = memberName(String(settlement.toUserId ?? ''));
    return {
      id: item.id,
      kind: 'settlement',
      date: formatDate(settlement.occurredAt, true),
      accessibleLabel: `Settlement: ${from} paid ${to}`,
      title: `${from} paid ${to}`,
      amount: formatMinor(asMinor(settlement.amountMinor), group.currency ?? 'INR'),
    };
  });
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

  const detailMembers: GroupDetailMember[] = memberNames.map((member) => ({
    id: member.id,
    name: member.name,
    username: member.username,
    avatarUrl: member.avatarUrl,
  }));
  const detailActivities: GroupDetailActivity[] = recent.map((expense) => ({
    id: recordId(expense),
    title: expense.title ?? 'Group expense',
    amountMinor: asMinor(expense.amountMinor),
    currency: group.currency ?? 'INR',
    date: formatDate(expense.occurredAt, expense.hasTime),
  }));
  const detailSettlements: GroupDetailSettlement[] = recentSettlements.map((settlement) => ({
    id: recordId(settlement),
    description: `${memberName(String(settlement.fromUserId ?? ''))} paid ${memberName(String(settlement.toUserId ?? ''))}`,
    amount: formatMinor(asMinor(settlement.amountMinor), group.currency ?? 'INR'),
    date: settlement.occurredAt === undefined ? undefined : formatDate(settlement.occurredAt, true),
  }));
  const balanceMeaning =
    myBalance === 0n ? 'You are settled' : myBalance > 0n ? 'Owed to you' : 'You owe';
  return (
    <GroupDetailScreen
      group={{
        name: group.name ?? 'Group',
        currency: group.currency ?? 'INR',
        icon: remoteGroup?.icon ?? group.icon,
        color: remoteGroup?.color ?? group.color,
      }}
      canSettle={!ledgerUnavailable && myBalance !== 0n}
      balanceStatus={
        rangeStatus === 'loading' && !ledgerError
          ? 'loading'
          : ledgerUnavailable
            ? 'unavailable'
            : 'ready'
      }
      balance={formatMinor(myBalance, group.currency ?? 'INR')}
      balanceMeaning={balanceMeaning}
      balanceError={ledgerError || (rangeStatus === 'error' ? rangeError : undefined)}
      members={detailMembers}
      activities={detailActivities}
      settlements={detailSettlements}
      chat={{
        items: groupChatItems,
        loading: chatMessages === undefined,
        canSend: canUseGroupChat,
        connected: isConnected,
        draft: chatDraft,
        pending: chatPending,
        error: chatError || undefined,
        onDraftChange: setChatDraft,
        onSubmit: submitChatMessage,
        onUpload: uploadBillImage,
      }}
      onBack={() => router.push('/groups')}
      onOpenChat={() => router.push(`/group/${encodeURIComponent(localGroupId)}/chat`)}
      onOpenAnalytics={() => router.push(`/group/${encodeURIComponent(localGroupId)}/analytics`)}
      onOpenSettings={() => router.push(`/group/${encodeURIComponent(localGroupId)}/edit`)}
      onOpenBalances={() => router.push(`/group/${encodeURIComponent(localGroupId)}/balances`)}
      onSettle={() => router.push(`/settle/new?groupId=${encodeURIComponent(localGroupId)}`)}
      onAddExpense={() => router.push(`/group/${encodeURIComponent(localGroupId)}/new`)}
      onOpenPerson={(username) =>
        router.push(`/person/${encodeURIComponent(username.replace(/^@+/, ''))}`)
      }
      onOpenActivity={(activityId) => router.push(`/transaction/${encodeURIComponent(activityId)}`)}
    />
  );
}
