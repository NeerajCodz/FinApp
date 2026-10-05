'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
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
import { isGroupRangeCovered, readLocal } from '@/lib/offline/repository';
import {
  GroupDetailScreen,
  GroupChatScreen,
  type GroupDetailActivity,
  type GroupDetailMember,
  type GroupChatScreenProps,
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
  avatarId?: string;
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
  categoryId?: string;
  accountId?: string;
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
  const standaloneChat = usePathname().endsWith('/chat');
  const { userId, isConnected, fetchGroupRange } = useBrowserSync();
  const {
    records: groups,
    loading: groupsLoading,
    error: groupsError,
  } = useLocalRecords<Group>('group');
  const { records: members } = useLocalRecords<Member>('groupMember');
  const {
    records: transactions,
    loading: transactionsLoading,
    error: transactionsError,
  } = useLocalRecords<LedgerRecord>('transaction');
  const {
    records: payers,
    loading: payersLoading,
    error: payersError,
  } = useLocalRecords<LedgerRecord>('expensePayer');
  const {
    records: participants,
    loading: participantsLoading,
    error: participantsError,
  } = useLocalRecords<LedgerRecord>('expenseParticipant');
  const {
    records: settlements,
    loading: settlementsLoading,
    error: settlementsError,
  } = useLocalRecords<LedgerRecord>('settlement');
  const { records: categories } = useLocalRecords<LocalRecord>('category');
  const { records: accounts } = useLocalRecords<LocalRecord>('account');
  const [rangeStatus, setRangeStatus] = React.useState<
    'idle' | 'loading' | 'loaded' | 'uncached' | 'error'
  >('idle');
  const [rangeError, setRangeError] = React.useState('');
  const [coveredScope, setCoveredScope] = React.useState('');
  const [completeLedger, setCompleteLedger] = React.useState<{
    scope: string;
    transactions: LedgerRecord[];
    payers: LedgerRecord[];
    participants: LedgerRecord[];
    settlements: LedgerRecord[];
    error?: string;
  }>();
  const group = groups.find((item) => recordIds(item).includes(groupId));
  const groupIds = group ? recordIds(group) : [groupId];
  const localGroupId = group ? recordId(group) : groupId;
  const groupReady = Boolean(group);
  const groupOptions = groups
    .filter((candidate) => {
      if (candidate.deletedAt !== undefined || candidate.archivedAt !== undefined) return false;
      return members.some(
        (member) =>
          member.deletedAt === undefined &&
          (member.userId === userId || member.memberId === userId) &&
          typeof member.groupId === 'string' &&
          recordIds(candidate).includes(member.groupId),
      );
    })
    .map((candidate) => ({ id: recordId(candidate), name: candidate.name ?? 'Group' }))
    .filter((option) => option.id);
  const rangeEndAt = React.useMemo(() => Date.now() + 1, []);
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const ledgerScope = `${userId ?? ''}:${localGroupId}:${rangeEndAt}`;
  const cloudGroupId = groupIdentity;
  const canUseGroupChat = isConnected && Boolean(cloudGroupId);
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    canUseGroupChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const chatMessages = useQuery(
    api.groups.queries.chatMessages,
    canUseGroupChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const chatScopeState = useQuery(
    api.presence.queries.scopeState,
    canUseGroupChat && standaloneChat
      ? { scopeType: 'group', scopeId: cloudGroupId as Id<'groups'> }
      : 'skip',
  );
  const setChatTypingMutation = useMutation(api.presence.mutations.setTyping);
  const markGroupMessageSeen = useMutation(api.presence.mutations.markGroupSeen);
  const createChatUploadUrl = useMutation(api.groups.mutations.createChatUploadUrl);
  const sendChatText = useMutation(api.groups.mutations.sendChatText);
  const sendBillAttachment = useMutation(api.groups.mutations.sendBillAttachment);
  const [chatDraft, setChatDraft] = React.useState('');
  const [chatPending, setChatPending] = React.useState(false);
  const chatLock = React.useRef(false);
  const [chatError, setChatError] = React.useState('');
  const chatTypingTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chatTypingActive = React.useRef(false);
  const chatTypingLastSent = React.useRef(0);
  const markedSeenMessageIds = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!userId || !group) return;
    let active = true;
    if (!isConnected) {
      void isGroupRangeCovered(userId, localGroupId, 0, rangeEndAt).then(
        (covered) => {
          if (!active) return;
          if (covered) setCoveredScope(ledgerScope);
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
        if (active) {
          setCoveredScope(ledgerScope);
          setRangeStatus('loaded');
        }
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
  }, [fetchGroupRange, groupReady, isConnected, localGroupId, rangeEndAt, userId, ledgerScope]);

  React.useEffect(() => {
    if (!userId || rangeStatus !== 'loaded' || coveredScope !== ledgerScope) return;
    let active = true;
    void Promise.all([
      readLocal<LedgerRecord>(userId, 'transaction'),
      readLocal<LedgerRecord>(userId, 'expensePayer'),
      readLocal<LedgerRecord>(userId, 'expenseParticipant'),
      readLocal<LedgerRecord>(userId, 'settlement'),
    ]).then(
      ([completeTransactions, completePayers, completeParticipants, completeSettlements]) => {
        if (active)
          setCompleteLedger({
            scope: ledgerScope,
            transactions: completeTransactions,
            payers: completePayers,
            participants: completeParticipants,
            settlements: completeSettlements,
          });
      },
      (cause: unknown) => {
        if (active)
          setCompleteLedger({
            scope: ledgerScope,
            transactions: [],
            payers: [],
            participants: [],
            settlements: [],
            error:
              cause instanceof Error ? cause.message : 'Complete group records could not be read.',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [
    userId,
    rangeStatus,
    coveredScope,
    ledgerScope,
    transactions,
    payers,
    participants,
    settlements,
  ]);
  const updateChatTyping = React.useCallback(
    (typing: boolean) => {
      if (chatTypingTimer.current) clearTimeout(chatTypingTimer.current);
      chatTypingTimer.current = undefined;
      if (typing) {
        if (!canUseGroupChat) return;
        const now = Date.now();
        if (!chatTypingActive.current || now - chatTypingLastSent.current >= 4_000) {
          chatTypingActive.current = true;
          chatTypingLastSent.current = now;
          void setChatTypingMutation({
            scopeType: 'group',
            scopeId: cloudGroupId as Id<'groups'>,
            typing: true,
          }).catch(() => {
            chatTypingActive.current = false;
          });
        }
        chatTypingTimer.current = setTimeout(() => {
          chatTypingTimer.current = undefined;
          if (!chatTypingActive.current) return;
          chatTypingActive.current = false;
          void setChatTypingMutation({
            scopeType: 'group',
            scopeId: cloudGroupId as Id<'groups'>,
            typing: false,
          }).catch(() => undefined);
        }, 2_500);
        return;
      }
      if (!chatTypingActive.current) return;
      chatTypingActive.current = false;
      void setChatTypingMutation({
        scopeType: 'group',
        scopeId: cloudGroupId as Id<'groups'>,
        typing: false,
      }).catch(() => undefined);
    },
    [canUseGroupChat, cloudGroupId, setChatTypingMutation],
  );
  React.useEffect(() => () => updateChatTyping(false), [updateChatTyping]);
  React.useEffect(() => {
    if (!standaloneChat || !userId || !chatMessages) return;
    for (const message of chatMessages) {
      const messageId = String(message.id);
      if (
        message.senderId === userId ||
        message.seenBy?.some((seenById) => String(seenById) === String(userId)) ||
        markedSeenMessageIds.current.has(messageId)
      )
        continue;
      markedSeenMessageIds.current.add(messageId);
      void markGroupMessageSeen({ messageId: message.id }).catch(() => {
        markedSeenMessageIds.current.delete(messageId);
      });
    }
  }, [chatMessages, markGroupMessageSeen, standaloneChat, userId]);
  const chatTypingNames = (chatScopeState?.typingUserIds ?? [])
    .filter((id) => id !== userId)
    .map((id) => {
      const remoteMember = remoteGroup?.members.find((member) => member.id === id);
      const localMember = members.find((member) => member.userId === id || member.memberId === id);
      return (
        remoteMember?.displayName ??
        localMember?.displayName ??
        localMember?.name ??
        (localMember?.username ? `@${localMember.username}` : `Member ${id.slice(-6)}`)
      );
    });

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
    (member) =>
      member.deletedAt === undefined &&
      typeof member.groupId === 'string' &&
      groupIds.includes(member.groupId),
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
  const recordsLoading =
    transactionsLoading || payersLoading || participantsLoading || settlementsLoading;
  const rangeComplete =
    rangeStatus === 'loaded' &&
    coveredScope === ledgerScope &&
    completeLedger?.scope === ledgerScope &&
    !recordsLoading;
  let balanceByUser: Record<string, bigint> = {};
  let ledgerError =
    transactionsError ||
    payersError ||
    participantsError ||
    settlementsError ||
    (completeLedger?.scope === ledgerScope ? completeLedger.error : '') ||
    '';
  let totalSpendMinor = 0n;
  if (rangeComplete && completeLedger && !ledgerError) {
    try {
      const projected = projectGroupBalances(
        group,
        completeLedger.transactions,
        completeLedger.payers,
        completeLedger.participants,
        completeLedger.settlements,
      );
      balanceByUser = projected.balances;
      totalSpendMinor = projected.expenses.reduce(
        (sum, expense) => sum + asMinor(expense.amountMinor),
        0n,
      );
    } catch (cause) {
      ledgerError = cause instanceof Error ? cause.message : 'The group balance is incomplete.';
    }
  }
  const ledgerUnavailable = !rangeComplete || Boolean(ledgerError);
  const myBalance = ledgerUnavailable ? 0n : userId ? (balanceByUser[userId] ?? 0n) : 0n;
  const recent = [...activeExpenses]
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5);
  const memberNames: GroupDetailMember[] = remoteGroup?.members
    ? remoteGroup.members.map((member) => ({
        id: member.id,
        username: member.username,
        avatarId: member.avatarId,
        avatarUrl: member.avatarUrl,
        role: member.role,
        name: member.id === userId ? 'You' : member.displayName,
      }))
    : groupMembers.map((member) => ({
        id: String(member.userId ?? member.memberId ?? recordId(member)),
        username: member.username,
        avatarUrl: member.avatarUrl,
        avatarId: member.avatarId,
        role: member.role,
        name:
          member.userId === userId
            ? 'You'
            : String(
                member.displayName ??
                  member.name ??
                  (member.username
                    ? `@${member.username}`
                    : `Member ${String(member.userId ?? '').slice(-6)}`),
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
  const expenseMetadata = (expense: LedgerRecord) => {
    const category = categories.find(
      (record) => expense.categoryId && recordIds(record).includes(expense.categoryId),
    );
    const account = accounts.find(
      (record) => expense.accountId && recordIds(record).includes(expense.accountId),
    );
    return {
      category: typeof category?.name === 'string' ? category.name : undefined,
      account: typeof account?.name === 'string' ? account.name : undefined,
      icon: typeof category?.icon === 'string' ? category.icon : undefined,
      color: typeof category?.color === 'string' ? category.color : undefined,
    };
  };
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
        senderAvatarUrl: message.senderAvatarUrl,
        senderAvatarId: message.senderAvatarId,
        ownMessage,
        text: message.kind === 'text' ? message.text : undefined,
        attachmentUrl: message.kind === 'bill' ? message.attachmentUrl : undefined,
        readBy: message.seenBy
          ?.filter(
            (seenById) =>
              seenById !== userId && memberNames.some((member) => member.id === seenById),
          )
          .map((seenById) => memberName(seenById)),
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
        ...expenseMetadata(expense),
        onPress: () => router.push(`/transaction/${encodeURIComponent(recordId(expense))}`),
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
    if (!canUseGroupChat) {
      setChatError(
        isConnected
          ? 'Sync this group before sending messages.'
          : 'You are offline. Reconnect to send group messages.',
      );
      return;
    }
    if (!chatDraft.trim() || chatLock.current) return;
    chatLock.current = true;
    setChatPending(true);
    setChatError('');
    try {
      await sendChatText({
        groupId: cloudGroupId as Id<'groups'>,
        text: chatDraft.trim(),
      });
      setChatDraft('');
      updateChatTyping(false);
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      chatLock.current = false;
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
    if (!canUseGroupChat) {
      setChatError(
        isConnected
          ? 'Sync this group before uploading attachments.'
          : 'You are offline. Reconnect to upload a group attachment.',
      );
      return;
    }
    if (chatLock.current) return;
    chatLock.current = true;
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
      chatLock.current = false;
      setChatPending(false);
    }
  }

  const detailMembers = memberNames;
  const detailActivities: GroupDetailActivity[] = recent.map((expense) => ({
    id: recordId(expense),
    title: expense.title ?? 'Group expense',
    amountMinor: asMinor(expense.amountMinor),
    currency: group.currency ?? 'INR',
    date: formatDate(expense.occurredAt, expense.hasTime),
    ...expenseMetadata(expense),
  }));
  const detailSettlements: GroupDetailSettlement[] = recentSettlements.map((settlement) => ({
    id: recordId(settlement),
    description: `${memberName(String(settlement.fromUserId ?? ''))} paid ${memberName(String(settlement.toUserId ?? ''))}`,
    amount: formatMinor(asMinor(settlement.amountMinor), group.currency ?? 'INR'),
    date: settlement.occurredAt === undefined ? undefined : formatDate(settlement.occurredAt, true),
  }));
  const balanceMeaning =
    myBalance === 0n ? 'You are settled' : myBalance > 0n ? 'Owed to you' : 'You owe';
  const chat: GroupChatScreenProps = {
    group: {
      name: group.name ?? 'Group',
      currency: group.currency ?? 'INR',
      icon: remoteGroup?.icon ?? group.icon,
      color: remoteGroup?.color ?? group.color,
    },
    members: detailMembers.map((member) => ({
      ...member,
      avatarUrl: member.avatarUrl ?? undefined,
    })),
    typingNames: chatTypingNames,
    onTypingChange: updateChatTyping,
    onBack: () =>
      router.push(
        standaloneChat
          ? `/group/${encodeURIComponent(localGroupId)}`
          : `/group/${encodeURIComponent(localGroupId)}/chat`,
      ),
    embedded: !standaloneChat,
    onOpenGroup: () => router.push(`/group/${encodeURIComponent(localGroupId)}`),
    onAddExpense: () => router.push(`/group/${encodeURIComponent(localGroupId)}/new`),
    onOpenSettings: () => router.push(`/group/${encodeURIComponent(localGroupId)}/edit`),
    items: groupChatItems,
    loading: canUseGroupChat && chatMessages === undefined,
    canSend: canUseGroupChat,
    connected: isConnected,
    draft: chatDraft,
    pending: chatPending,
    error: chatError || undefined,
    onDraftChange: setChatDraft,
    onSubmit: submitChatMessage,
    onUpload: uploadBillImage,
  };
  if (standaloneChat) return <GroupChatScreen {...chat} />;
  return (
    <GroupDetailScreen
      group={{
        name: group.name ?? 'Group',
        currency: group.currency ?? 'INR',
        icon: remoteGroup?.icon ?? group.icon,
        color: remoteGroup?.color ?? group.color,
      }}
      groupOptions={groupOptions}
      currentGroupId={localGroupId}
      onSelectGroup={(selectedId) => router.push(`/group/${encodeURIComponent(selectedId)}`)}
      canSettle={!ledgerUnavailable && myBalance !== 0n}
      balanceStatus={
        (rangeStatus === 'loading' ||
          recordsLoading ||
          (rangeStatus === 'loaded' && !rangeComplete)) &&
        !ledgerError
          ? 'loading'
          : ledgerUnavailable
            ? 'unavailable'
            : 'ready'
      }
      balance={formatMinor(myBalance, group.currency ?? 'INR')}
      balanceMeaning={balanceMeaning}
      balanceError={ledgerError || (rangeStatus === 'error' ? rangeError : undefined)}
      totalSpend={
        ledgerUnavailable ? undefined : formatMinor(totalSpendMinor, group.currency ?? 'INR')
      }
      owed={
        ledgerUnavailable
          ? undefined
          : formatMinor(myBalance > 0n ? myBalance : 0n, group.currency ?? 'INR')
      }
      owing={
        ledgerUnavailable
          ? undefined
          : formatMinor(myBalance < 0n ? -myBalance : 0n, group.currency ?? 'INR')
      }
      memberBalances={
        ledgerUnavailable
          ? undefined
          : Object.entries(balanceByUser).map(([id, amount]) => ({
              id,
              name: memberName(id),
              amount: formatMinor(amount < 0n ? -amount : amount, group.currency ?? 'INR'),
              meaning: amount > 0n ? 'Owed by group' : amount < 0n ? 'Owes group' : 'Settled',
            }))
      }
      members={detailMembers}
      activities={detailActivities}
      settlements={detailSettlements}
      chat={chat}
      onBack={() => router.push('/groups')}
      onOpenChat={() => router.push(`/group/${encodeURIComponent(localGroupId)}/chat`)}
      onOpenAnalytics={() => router.push(`/group/${encodeURIComponent(localGroupId)}/analytics`)}
      onOpenSettings={() => router.push(`/group/${encodeURIComponent(localGroupId)}/edit`)}
      onOpenBalances={() => router.push(`/group/${encodeURIComponent(localGroupId)}/balances`)}
      onSettle={() => router.push(`/settle/new?groupId=${encodeURIComponent(localGroupId)}`)}
      onAddExpense={() => router.push(`/group/${encodeURIComponent(localGroupId)}/new`)}
      onOpenPerson={(username) =>
        router.push(`/@${encodeURIComponent(username.replace(/^@+/, ''))}`)
      }
      onOpenActivity={(activityId) => router.push(`/transaction/${encodeURIComponent(activityId)}`)}
    />
  );
}
