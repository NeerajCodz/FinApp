import React from 'react';
import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { formatMinor } from '@convex/shared/money';
import { router, useLocalSearchParams } from 'expo-router';
import { useGroupLedger } from '@/hooks/useGroupLedger';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import {
  formatTransactionDate,
  type GroupChatItem,
  GroupDetailScreen,
  type GroupDetailActivity,
  type GroupDetailMember,
  type GroupDetailSettlement,
} from '@finapp/ui/finance';
import { recordId, recordIds } from '@/lib/ledger';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';

export default function GroupHomeScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { group, members, ledger, error, loading, retry, userId } = useGroupLedger(id);
  const { isConnected } = useLocalSync();
  const savedGroups = useLocalRecords(userId, 'group');
  const savedMemberships = useLocalRecords(userId, 'groupMember');
  const groupOptions = (savedGroups.data ?? [])
    .filter(
      (candidate) =>
        candidate.deletedAt === undefined &&
        candidate.archivedAt === undefined &&
        (savedMemberships.data ?? []).some(
          (membership) =>
            membership.deletedAt === undefined &&
            (membership.userId === userId || membership.memberId === userId) &&
            typeof membership.groupId === 'string' &&
            recordIds(candidate).includes(membership.groupId),
        ),
    )
    .map((candidate) => ({ id: recordId(candidate), name: String(candidate.name ?? 'Group') }))
    .filter((option) => option.id);
  const localGroupId = group ? recordId(group) : (id ?? '');
  const localSettlements = useLocalRecords(userId, 'settlement');
  const categories = useLocalRecords(userId, 'category');
  const accounts = useLocalRecords(userId, 'account');
  const groupMembers =
    members?.filter(
      (record) =>
        record.deletedAt === undefined &&
        typeof record.groupId === 'string' &&
        recordIds(group ?? {}).includes(record.groupId),
    ) ?? [];
  const recent = [...(ledger?.expenses ?? [])]
    .sort((a, b) => Number(b.occurredAt) - Number(a.occurredAt))
    .slice(0, 5);
  const balance = userId ? (ledger?.balances[userId] ?? 0n) : 0n;
  const groupIdentity = String(
    (group as { cloudId?: string; _id?: string } | undefined)?.cloudId ??
      (group as { _id?: string } | undefined)?._id ??
      '',
  );
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
  const createChatUploadUrl = useMutation(api.groups.mutations.createChatUploadUrl);
  const sendChatText = useMutation(api.groups.mutations.sendChatText);
  const sendBillAttachment = useMutation(api.groups.mutations.sendBillAttachment);
  const [chatDraft, setChatDraft] = React.useState('');
  const [chatPending, setChatPending] = React.useState(false);
  const [chatError, setChatError] = React.useState('');
  const expenseMetadata = (expense: LocalRecord) => {
    const category = categories.data?.find(
      (record) =>
        typeof expense.categoryId === 'string' && recordIds(record).includes(expense.categoryId),
    );
    const account = accounts.data?.find(
      (record) =>
        typeof expense.accountId === 'string' && recordIds(record).includes(expense.accountId),
    );
    return {
      category: typeof category?.name === 'string' ? category.name : undefined,
      account: typeof account?.name === 'string' ? account.name : undefined,
      icon: typeof category?.icon === 'string' ? category.icon : undefined,
      color: typeof category?.color === 'string' ? category.color : undefined,
    };
  };

  async function submitChatMessage() {
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

  async function pickBillImage() {
    if (!canUseGroupChat || chatPending) return;
    setChatError('');
    let selection: ImagePicker.ImagePickerResult;
    try {
      selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
      });
    } catch (cause) {
      setChatError(cause instanceof Error ? cause.message : 'Could not open the image picker.');
      return;
    }
    if (selection.canceled) return;
    const asset = selection.assets[0];
    const mimeType = asset?.mimeType?.toLowerCase();
    if (
      !asset ||
      !mimeType ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) ||
      (asset.fileSize !== undefined && asset.fileSize > 5 * 1024 * 1024)
    ) {
      setChatError('Choose a JPEG, PNG, or WebP bill image up to 5 MB.');
      return;
    }
    setChatPending(true);
    try {
      const uploadUrl = await createChatUploadUrl({ groupId: cloudGroupId as Id<'groups'> });
      const image = await (await fetch(asset.uri)).blob();
      if (!image.size || image.size > 5 * 1024 * 1024) throw new Error('INVALID_BILL_IMAGE');
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: image,
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
  const groupSettlementIds = recordIds(group ?? {});
  const recentSettlements = (localSettlements.data ?? [])
    .filter(
      (record) =>
        typeof record.groupId === 'string' &&
        groupSettlementIds.includes(record.groupId) &&
        typeof record.currency === 'string' &&
        record.currency === ledger?.currency &&
        record.deletedAt === undefined &&
        typeof record.fromUserId === 'string' &&
        typeof record.toUserId === 'string' &&
        typeof record.amountMinor === 'bigint',
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 5);
  const settlementMemberName = (memberId: string) => {
    if (memberId === userId) return 'You';
    const member = groupMembers.find((record) => (record.userId ?? record.memberId) === memberId);
    return String(
      member?.displayName ?? member?.name ?? member?.username ?? `Member ${memberId.slice(-6)}`,
    );
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
    const date = new Date(item.createdAt).toLocaleString();
    if (item.kind === 'message') {
      const message = item.message;
      const ownMessage = message.senderId === userId;
      return {
        id: item.id,
        kind: 'message',
        date,
        accessibleLabel: `${ownMessage ? 'You' : message.senderName}, ${date}`,
        sender: message.senderName,
        senderAvatarUrl: message.senderAvatarUrl,
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
        date: formatTransactionDate(Number(expense.occurredAt ?? 0), Boolean(expense.hasTime)),
        accessibleLabel: `Shared expense: ${String(expense.title ?? 'Group expense')}`,
        title: String(expense.title ?? 'Group expense'),
        amountMinor: expense.amountMinor as bigint,
        currency: String(group?.currency ?? ledger?.currency ?? ''),
        ...expenseMetadata(expense),
        onPress: () =>
          router.push({ pathname: '/transaction/[id]', params: { id: recordId(expense) } }),
      };
    }
    const settlement = item.settlement;
    const from = settlementMemberName(String(settlement.fromUserId));
    const to = settlementMemberName(String(settlement.toUserId));
    return {
      id: item.id,
      kind: 'settlement',
      date: formatTransactionDate(Number(settlement.occurredAt ?? 0), true),
      accessibleLabel: `Settlement: ${from} paid ${to}`,
      title: `${from} paid ${to}`,
      amountMinor: settlement.amountMinor as bigint,
      currency: String(group?.currency ?? ledger?.currency ?? ''),
    };
  });
  const detailMembers: GroupDetailMember[] = remoteGroup?.members
    ? remoteGroup.members.map((member) => ({
        id: member.id,
        name: member.id === userId ? 'You' : member.displayName,
        username: member.username,
        avatarUrl: member.avatarUrl,
        role: member.role,
      }))
    : groupMembers.map((member) => ({
        id: String(member.userId ?? member.memberId ?? recordId(member)),
        name:
          member.userId === userId
            ? 'You'
            : String(member.displayName ?? member.name ?? member.username ?? 'Member'),
        username: typeof member.username === 'string' ? member.username : undefined,
        avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : null,
        role: typeof member.role === 'string' ? member.role : undefined,
      }));
  const detailActivities: GroupDetailActivity[] = recent.map((expense) => ({
    id: recordId(expense),
    title: String(expense.title ?? 'Group expense'),
    amountMinor: expense.amountMinor as bigint,
    currency: String(group?.currency ?? ledger?.currency ?? ''),
    date: formatTransactionDate(Number(expense.occurredAt ?? 0), Boolean(expense.hasTime)),
    ...expenseMetadata(expense),
  }));
  const detailSettlements: GroupDetailSettlement[] = recentSettlements.map((settlement) => ({
    id: recordId(settlement),
    description: `${settlementMemberName(String(settlement.fromUserId))} paid ${settlementMemberName(String(settlement.toUserId))}`,
    amountMinor: settlement.amountMinor as bigint,
    currency: String(group?.currency ?? ledger?.currency ?? ''),
    date:
      typeof settlement.occurredAt === 'number'
        ? formatTransactionDate(settlement.occurredAt, true)
        : undefined,
  }));
  const ledgerComplete = Boolean(ledger) && !loading && !error;
  const currency = ledger?.currency ?? '';
  return (
    <GroupDetailScreen
      group={
        group
          ? {
              name: String(group.name ?? 'Group'),
              currency: String(group.currency ?? ledger?.currency ?? ''),
              icon:
                typeof remoteGroup?.icon === 'string'
                  ? remoteGroup.icon
                  : typeof group.icon === 'string'
                    ? group.icon
                    : undefined,
              color:
                typeof remoteGroup?.color === 'string'
                  ? remoteGroup.color
                  : typeof group.color === 'string'
                    ? group.color
                    : undefined,
            }
          : undefined
      }
      groupOptions={groupOptions}
      currentGroupId={localGroupId}
      onSelectGroup={(selectedId) =>
        router.push({ pathname: '/group/[id]', params: { id: selectedId } })
      }
      loading={loading}
      balanceStatus={error ? 'unavailable' : loading || !ledger ? 'loading' : 'ready'}
      balanceMinor={balance}
      balanceCurrency={ledger?.currency ?? ''}
      balanceMeaning={balance > 0n ? 'Owed to you' : balance < 0n ? 'You owe' : 'You are settled'}
      balanceError={error?.message}
      canSettle={ledgerComplete && balance !== 0n}
      totalSpend={
        ledgerComplete && ledger
          ? formatMinor(
              ledger.expenses.reduce((sum, expense) => sum + (expense.amountMinor as bigint), 0n),
              currency,
            )
          : undefined
      }
      owed={ledgerComplete ? formatMinor(balance > 0n ? balance : 0n, currency) : undefined}
      owing={ledgerComplete ? formatMinor(balance < 0n ? -balance : 0n, currency) : undefined}
      memberBalances={
        ledgerComplete && ledger
          ? Object.entries(ledger.balances).map(([memberId, amount]) => ({
              id: memberId,
              name:
                detailMembers.find((member) => member.id === memberId)?.name ??
                settlementMemberName(memberId),
              amount: formatMinor(amount < 0n ? -amount : amount, currency),
              meaning: amount > 0n ? 'Owed by group' : amount < 0n ? 'Owes group' : 'Settled',
            }))
          : undefined
      }
      members={detailMembers}
      activities={detailActivities}
      settlements={detailSettlements}
      settlementsLoading={localSettlements.loading}
      settlementsError={localSettlements.error?.message}
      chat={{
        embedded: true,
        group: group
          ? {
              name: String(group.name ?? 'Group'),
              currency: String(group.currency ?? ledger?.currency ?? ''),
              icon: remoteGroup?.icon ?? (typeof group.icon === 'string' ? group.icon : undefined),
              color:
                remoteGroup?.color ?? (typeof group.color === 'string' ? group.color : undefined),
            }
          : undefined,
        members: detailMembers.map((member) => ({
          ...member,
          avatarUrl: member.avatarUrl ?? undefined,
        })),
        items: groupChatItems,
        loading: canUseGroupChat && chatMessages === undefined,
        canSend: canUseGroupChat,
        connected: isConnected,
        draft: chatDraft,
        pending: chatPending,
        error: chatError || undefined,
        onDraftChange: setChatDraft,
        onSend: () => void submitChatMessage(),
        onChooseBillImage: () => void pickBillImage(),
      }}
      onBack={() => router.back()}
      onOpenChat={() => router.push({ pathname: '/group/[id]/chat', params: { id: id ?? '' } })}
      onOpenAnalytics={() =>
        router.push({ pathname: '/group/[id]/analytics', params: { id: id ?? '' } })
      }
      onOpenSettings={() => router.push({ pathname: '/group/[id]/edit', params: { id: id ?? '' } })}
      onOpenBalances={() =>
        router.push({ pathname: '/group/[id]/balances', params: { id: id ?? '' } })
      }
      onSettle={() => router.push({ pathname: '/settle/new', params: { groupId: id ?? '' } })}
      onAddExpense={() => router.push({ pathname: '/group/[id]/new', params: { id: id ?? '' } })}
      onOpenActivity={(activityId) =>
        router.push({ pathname: '/transaction/[id]', params: { id: activityId } })
      }
      onRetry={retry}
    />
  );
}
