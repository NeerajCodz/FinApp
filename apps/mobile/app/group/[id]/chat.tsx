import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@finapp/ui/native';
import { GroupChatScreen, type GroupChatItem } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { recordIds } from '@/lib/ledger';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Group = LocalRecord & { icon?: string; color?: string };

export default function GroupChatRoute() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { userId, isConnected } = useLocalSync();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const groups = useLocalRecords<Group>(userId, 'group');
  const group = groups.data?.find((record) => id && recordIds(record).includes(id));
  const groupIdentity = group ? String(group.cloudId ?? group._id ?? '') : '';
  const cloudGroupId = groupIdentity.startsWith('local-') ? '' : groupIdentity;
  const canUseChat = Boolean(userId && isConnected && cloudGroupId);
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
  const items: GroupChatItem[] = (chatMessages ?? []).map((message) => ({
    id: `message:${message.id}`,
    kind: 'message',
    date: new Date(message.createdAt).toLocaleString(),
    accessibleLabel: `${message.senderId === userId ? 'You' : message.senderName}, ${new Date(message.createdAt).toLocaleString()}`,
    sender: message.senderName,
    ownMessage: message.senderId === userId,
    text: message.kind === 'text' ? message.text : undefined,
    attachmentUrl: message.kind === 'bill' ? message.attachmentUrl : undefined,
  }));

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
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
      }}
    >
      <GroupChatScreen
        items={items}
        loading={chatMessages === undefined}
        canSend={canUseChat}
        connected={isConnected}
        draft={draft}
        pending={pending}
        error={error || undefined}
        onDraftChange={setDraft}
        onSend={() => void sendMessage()}
        onChooseBillImage={() => void chooseBillImage()}
        onBack={() => router.back()}
      />
    </ScrollView>
  );
}
