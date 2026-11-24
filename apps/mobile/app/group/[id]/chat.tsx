import React, { useMemo, useState } from 'react';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { router, useLocalSearchParams } from 'expo-router';
import { formatTransactionDate, GroupChatScreen, type GroupChatItem } from '@finapp/ui/finance';
import {
  firstUnreadMessageId,
  readersOf,
  useLiveTypists,
  useOptimisticMessages,
  useReadMarker,
  useTypingSender,
} from '@finapp/ui/chat';
import { toast } from '@/lib/toast';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { recordId, recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const PAGE_SIZE = 30;

type Group = LocalRecord & { name?: string; currency?: string; icon?: string; color?: string };

export default function GroupChatRoute() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId, isConnected } = useLocalSync();
  const groups = useLocalRecords<Group>(userId, 'group');
  const memberships = useLocalRecords(userId, 'groupMember');
  const transactions = useLocalRecords(userId, 'transaction');
  const categories = useLocalRecords(userId, 'category');
  const group = groups.data?.find((record) => id && recordIds(record).includes(id));
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const cloudGroupId = groupIdentity;
  const canUseChat = Boolean(userId && isConnected && cloudGroupId);
  const remoteGroup = useQuery(
    api.groups.queries.detail,
    canUseChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const history = usePaginatedQuery(
    api.groups.queries.chatMessagesPage,
    canUseChat ? { groupId: cloudGroupId } : 'skip',
    { initialNumItems: PAGE_SIZE },
  );
  const chatMeta = useQuery(
    api.groups.queries.chatMeta,
    canUseChat ? { groupId: cloudGroupId } : 'skip',
  );
  const scopeState = useQuery(
    api.presence.queries.scopeState,
    canUseChat ? { scopeType: 'group', scopeId: cloudGroupId } : 'skip',
  );
  const setTypingMutation = useMutation(api.presence.mutations.setTyping);
  const markRead = useMutation(api.presence.mutations.markRead);
  const setPinned = useMutation(api.groups.mutations.setChatMessagePinned);
  const toggleReaction = useMutation(api.groups.mutations.toggleChatReaction);
  const typing = useTypingSender(
    canUseChat
      ? (active) =>
          setTypingMutation({
            scopeType: 'group',
            scopeId: cloudGroupId as Id<'groups'>,
            typing: active,
          })
      : undefined,
  );
  const onSeenLatest = useReadMarker(
    canUseChat
      ? (readAt) => markRead({ scopeType: 'group', scopeId: cloudGroupId, readAt })
      : undefined,
    chatMeta?.myLastReadAt,
  );
  const optimistic = useOptimisticMessages((cause) =>
    toast.error(cause instanceof Error ? cause.message : 'Could not send this message.'),
  );
  const typistIds = useLiveTypists(scopeState?.typing);
  const createChatUploadUrl = useMutation(api.groups.mutations.createChatUploadUrl);
  const sendChatText = useMutation(api.groups.mutations.sendChatText);
  const sendBillAttachment = useMutation(api.groups.mutations.sendBillAttachment);
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const members = remoteGroup?.members
    ? remoteGroup.members.map((member) => ({
        id: member.id,
        name: member.id === userId ? 'You' : member.displayName,
        username: member.username,
        avatarId: member.avatarId,
        avatarUrl: member.avatarUrl ?? undefined,
      }))
    : (memberships.data ?? [])
        .filter(
          (member) =>
            member.deletedAt === undefined &&
            typeof member.groupId === 'string' &&
            recordIds(group ?? {}).includes(member.groupId),
        )
        .map((member) => ({
          id: String(member.userId ?? member.memberId ?? recordId(member)),
          name:
            member.userId === userId
              ? 'You'
              : String(member.displayName ?? member.name ?? member.username ?? 'Member'),
          username: typeof member.username === 'string' ? member.username : undefined,
          avatarId: typeof member.avatarId === 'string' ? member.avatarId : undefined,
          avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : undefined,
        }));
  const memberName = (memberId: string) =>
    memberId === userId
      ? 'You'
      : (members.find((member) => member.id === memberId)?.name ?? 'Group member');
  const typingNames = typistIds
    .filter(
      (typingUserId) =>
        typingUserId !== userId && members.some((member) => member.id === typingUserId),
    )
    .map(memberName);
  const people = members.map((member) => ({
    id: member.id,
    name: member.name,
    avatarUrl: member.avatarUrl,
    avatarId: member.avatarId,
  }));
  const pointers = useMemo(
    () => (chatMeta?.readPointers ?? []).map((row) => ({ ...row, userId: String(row.userId) })),
    [chatMeta?.readPointers],
  );
  const pinnedIds = new Set((chatMeta?.pinned ?? []).map((pin) => String(pin.id)));
  const canPinAny = chatMeta?.canPinAny ?? false;
  const expenseEvents = (transactions.data ?? [])
    .filter(
      (expense) =>
        typeof expense.groupId === 'string' &&
        recordIds(group ?? {}).includes(expense.groupId) &&
        expense.type === 'expense' &&
        expense.status === 'posted' &&
        expense.deletedAt === undefined &&
        expense.currency === group?.currency &&
        typeof expense.amountMinor === 'bigint',
    )
    .sort((left, right) => Number(right.occurredAt ?? 0) - Number(left.occurredAt ?? 0))
    .slice(0, 20)
    .map((expense) => {
      const category = categories.data?.find(
        (record) =>
          typeof expense.categoryId === 'string' && recordIds(record).includes(expense.categoryId),
      );
      return {
        id: `expense:${recordId(expense)}`,
        kind: 'expense' as const,
        timestamp: Number(expense.occurredAt ?? 0),
        date: formatTransactionDate(Number(expense.occurredAt ?? 0), Boolean(expense.hasTime)),
        accessibleLabel: `Shared expense: ${String(expense.title ?? 'Group expense')}`,
        title: String(expense.title ?? 'Group expense'),
        amountMinor: expense.amountMinor as bigint,
        currency: group?.currency ?? '',
        icon: typeof category?.icon === 'string' ? category.icon : undefined,
        color: typeof category?.color === 'string' ? category.color : undefined,
        onPress: () =>
          router.push({ pathname: '/transaction/[id]', params: { id: recordId(expense) } }),
      };
    });
  const items: GroupChatItem[] = [
    ...expenseEvents,
    ...[...history.results].reverse().map((message) => {
      const ownMessage = String(message.senderId) === String(userId);
      return {
        id: String(message.id),
        kind: 'message' as const,
        timestamp: message.createdAt,
        createdAt: message.createdAt,
        date: new Date(message.createdAt).toLocaleString(),
        accessibleLabel: `${ownMessage ? 'You' : message.senderName}, ${new Date(message.createdAt).toLocaleString()}`,
        senderId: String(message.senderId),
        sender: message.senderName,
        senderAvatarUrl: message.senderAvatarUrl,
        senderAvatarId: message.senderAvatarId,
        ownMessage,
        text: message.kind === 'text' ? message.text : undefined,
        attachmentUrl: message.kind === 'bill' ? message.attachmentUrl : undefined,
        reactions: message.reactions,
        myReaction: message.myReaction,
        pinned: message.pinnedAt !== null || pinnedIds.has(String(message.id)),
        canPin: canPinAny || ownMessage,
        seenByPeople: ownMessage
          ? readersOf(message.createdAt, String(message.senderId), pointers, people).filter(
              (person) => person.id !== userId,
            )
          : undefined,
      };
    }),
    ...optimistic.messages.map((message) => ({
      id: message.id,
      kind: 'message' as const,
      timestamp: message.createdAt,
      createdAt: message.createdAt,
      date: new Date(message.createdAt).toLocaleString(),
      accessibleLabel: `You, ${message.status === 'failed' ? 'not sent' : 'sending'}`,
      senderId: userId ? String(userId) : undefined,
      ownMessage: true,
      text: message.text,
      attachmentUrl: message.imageUrl,
      status: message.status,
    })),
  ]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ timestamp: _timestamp, ...item }) => ({ ...item, createdAt: _timestamp }));

  const [firstUnreadId, setFirstUnreadId] = useState<string | undefined | null>(null);
  if (firstUnreadId === null && chatMeta && history.status !== 'LoadingFirstPage')
    setFirstUnreadId(
      firstUnreadMessageId(
        items
          .filter((item) => item.kind === 'message')
          .map((item) => ({
            id: item.id,
            kind: 'text' as const,
            createdAt: item.createdAt ?? 0,
            mine: !!item.ownMessage,
            status: item.status,
          })),
        chatMeta.myLastReadAt,
      ) ?? undefined,
    );

  function sendMessage() {
    if (!canUseChat) {
      setError(
        isConnected
          ? 'Sync this group before sending messages.'
          : 'You are offline. Reconnect to send group messages.',
      );
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setError('');
    setDraft('');
    typing.stop();
    optimistic.send({ kind: 'text', text, senderName: 'You' }, () =>
      sendChatText({ groupId: cloudGroupId as Id<'groups'>, text }),
    );
  }
  async function chooseBillImage() {
    if (!canUseChat) {
      setError(
        isConnected
          ? 'Sync this group before uploading attachments.'
          : 'You are offline. Reconnect to upload a group attachment.',
      );
      return;
    }
    if (uploading) return;
    setError('');
    let selection: ImagePicker.ImagePickerResult;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('MEDIA_LIBRARY_PERMISSION_REQUIRED');
      selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the image library.');
      return;
    }
    if (selection.canceled || !selection.assets[0]) return;
    const asset = selection.assets[0];
    const mimeType =
      asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      setError('Choose a JPEG, PNG, or WebP bill image up to 5 MB.');
      return;
    }
    setUploading(true);
    let image: Blob;
    try {
      image = await (await fetch(asset.uri)).blob();
    } catch {
      setUploading(false);
      setError('Could not read this image.');
      return;
    }
    setUploading(false);
    if (!image.size || image.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG, or WebP bill image up to 5 MB.');
      return;
    }
    optimistic.send({ kind: 'image', imageUrl: asset.uri, senderName: 'You' }, async () => {
      const uploadUrl = await createChatUploadUrl({ groupId: cloudGroupId as Id<'groups'> });
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
    });
  }

  return (
    <GroupChatScreen
      group={
        group
          ? {
              name: group.name ?? 'Group',
              currency: group.currency ?? '',
              icon: remoteGroup?.icon ?? group.icon,
              color: remoteGroup?.color ?? group.color,
            }
          : undefined
      }
      members={members}
      typingNames={typingNames}
      onTypingChange={(active) => (active ? typing.onDraftChange('typing') : typing.stop())}
      onOpenGroup={() => router.push({ pathname: '/group/[id]', params: { id: id ?? '' } })}
      onAddExpense={() => router.push({ pathname: '/group/[id]/new', params: { id: id ?? '' } })}
      onOpenSettings={() => router.push({ pathname: '/group/[id]/edit', params: { id: id ?? '' } })}
      items={items}
      loading={
        groups.loading ||
        transactions.loading ||
        (canUseChat && history.status === 'LoadingFirstPage')
      }
      canLoadOlder={history.status === 'CanLoadMore'}
      loadingOlder={history.status === 'LoadingMore'}
      onLoadOlder={() => history.loadMore(PAGE_SIZE)}
      firstUnreadId={firstUnreadId ?? undefined}
      pinned={(chatMeta?.pinned ?? []).map((pin) => ({
        id: String(pin.id),
        text: pin.text,
        senderName: String(pin.senderId) === String(userId) ? 'You' : pin.senderName,
        canUnpin: canPinAny || String(pin.senderId) === String(userId),
      }))}
      onTogglePin={(messageId, pinned) =>
        void setPinned({ messageId: messageId as Id<'groupMessages'>, pinned }).catch((cause) =>
          toast.error(cause instanceof Error ? cause.message : 'Could not update the pin.'),
        )
      }
      onReact={(messageId, emoji) =>
        void toggleReaction({ messageId: messageId as Id<'groupMessages'>, emoji }).catch((cause) =>
          toast.error(cause instanceof Error ? cause.message : 'Could not update this reaction.'),
        )
      }
      onRetry={optimistic.retry}
      onDiscard={optimistic.discard}
      onSeenLatest={onSeenLatest}
      canSend={canUseChat}
      connected={isConnected}
      draft={draft}
      pending={uploading}
      error={
        error || groups.error?.message || memberships.error?.message || transactions.error?.message
      }
      onDraftChange={setDraft}
      onSend={sendMessage}
      onChooseBillImage={() => void chooseBillImage()}
      onBack={() => router.back()}
    />
  );
}
