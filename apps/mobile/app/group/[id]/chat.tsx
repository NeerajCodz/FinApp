import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { router, useLocalSearchParams } from 'expo-router';
import { formatTransactionDate, GroupChatScreen, type GroupChatItem } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { recordId, recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

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
  const chatMessages = useQuery(
    api.groups.queries.chatMessages,
    canUseChat ? { groupId: cloudGroupId as Id<'groups'> } : 'skip',
  );
  const createChatUploadUrl = useMutation(api.groups.mutations.createChatUploadUrl);
  const sendChatText = useMutation(api.groups.mutations.sendChatText);
  const sendBillAttachment = useMutation(api.groups.mutations.sendBillAttachment);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const members = remoteGroup?.members
    ? remoteGroup.members.map((member) => ({
        id: member.id,
        name: member.id === userId ? 'You' : member.displayName,
        username: member.username,
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
          avatarUrl: typeof member.avatarUrl === 'string' ? member.avatarUrl : undefined,
        }));
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
    ...(chatMessages ?? []).map((message) => ({
      id: `message:${message.id}`,
      kind: 'message' as const,
      timestamp: message.createdAt,
      date: new Date(message.createdAt).toLocaleString(),
      accessibleLabel: `${message.senderId === userId ? 'You' : message.senderName}, ${new Date(message.createdAt).toLocaleString()}`,
      sender: message.senderName,
      senderAvatarUrl: message.senderAvatarUrl,
      ownMessage: message.senderId === userId,
      text: message.kind === 'text' ? message.text : undefined,
      attachmentUrl: message.kind === 'bill' ? message.attachmentUrl : undefined,
    })),
  ]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map(({ timestamp: _timestamp, ...item }) => item);

  async function sendMessage() {
    if (!canUseChat || !draft.trim() || pending) return;
    setPending(true);
    setError('');
    try {
      await sendChatText({ groupId: cloudGroupId as Id<'groups'>, text: draft.trim() });
      setDraft('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      setPending(false);
    }
  }

  async function chooseBillImage() {
    if (!canUseChat || pending) return;
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
    setPending(true);
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
      setError(cause instanceof Error ? cause.message : 'Could not upload this bill image.');
    } finally {
      setPending(false);
    }
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
      onOpenGroup={() => router.push({ pathname: '/group/[id]', params: { id: id ?? '' } })}
      onAddExpense={() => router.push({ pathname: '/group/[id]/new', params: { id: id ?? '' } })}
      onOpenSettings={() => router.push({ pathname: '/group/[id]/edit', params: { id: id ?? '' } })}
      items={items}
      loading={groups.loading || transactions.loading || (canUseChat && chatMessages === undefined)}
      canSend={canUseChat}
      connected={isConnected}
      draft={draft}
      pending={pending}
      error={
        error || groups.error?.message || memberships.error?.message || transactions.error?.message
      }
      onDraftChange={setDraft}
      onSend={() => void sendMessage()}
      onChooseBillImage={() => void chooseBillImage()}
      onBack={() => router.back()}
    />
  );
}
