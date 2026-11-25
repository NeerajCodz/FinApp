import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { Avatar, IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import {
  ChatThread,
  firstUnreadMessageId,
  useLiveTypists,
  useLoadUnreadHistory,
  useOptimisticMessages,
  useReadMarker,
  useTypingSender,
  type ChatMessage,
} from '@finapp/ui/chat';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@/lib/toast';
import { useFinaiDecide } from '@/hooks/useFinaiDecide';
import { FinaiSurface } from '@finapp/ui/ai';
import { FINAI_MENTION, finaiChatOverrides, finaiTypingNames } from '@finapp/ui/ai/finai';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const PAGE_SIZE = 30;
const extensionMimeTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export default function DirectConversationScreen() {
  const { conversationId: routeId } = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = (
    Array.isArray(routeId) ? routeId[0] : routeId
  ) as Id<'directConversations'>;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const history = usePaginatedQuery(
    api.directMessages.queries.messagesPage,
    conversationId ? { conversationId } : 'skip',
    { initialNumItems: PAGE_SIZE },
  );
  const meta = useQuery(
    api.directMessages.queries.conversationMeta,
    conversationId ? { conversationId } : 'skip',
  );
  const conversations = useQuery(api.directMessages.queries.listConversations, {});
  const presence = useQuery(
    api.presence.queries.scopeState,
    conversationId ? { scopeType: 'direct', scopeId: conversationId } : 'skip',
  );
  const sendText = useMutation(api.directMessages.mutations.sendText);
  const createUpload = useMutation(api.directMessages.mutations.createImageUpload);
  const sendImage = useMutation(api.directMessages.mutations.sendImage);
  const markRead = useMutation(api.presence.mutations.markRead);
  const setTyping = useMutation(api.presence.mutations.setTyping);
  const toggleReaction = useMutation(api.directMessages.mutations.toggleReaction);
  const decideFinai = useFinaiDecide();
  const setPinned = useMutation(api.directMessages.mutations.setPinned);
  const optimistic = useOptimisticMessages((error) =>
    toast.error(error instanceof Error ? error.message : 'Message could not be sent'),
  );
  const typing = useTypingSender(
    conversationId
      ? (active) => setTyping({ scopeType: 'direct', scopeId: conversationId, typing: active })
      : undefined,
  );
  const typistIds = useLiveTypists(presence?.typing);
  const onSeenLatest = useReadMarker(
    conversationId
      ? (readAt) => markRead({ scopeType: 'direct', scopeId: conversationId, readAt })
      : undefined,
    meta?.myLastReadAt,
  );
  const conversation = useMemo(
    () => conversations?.find((row) => String(row.id) === String(conversationId)),
    [conversations, conversationId],
  );
  const participant = presence?.participants?.[0];
  const peerName = conversation?.displayName ?? 'Friend';
  const presenceLabel = typistIds.length
    ? 'Typing…'
    : participant?.active === true
      ? 'Active now'
      : participant?.lastSeenAt
        ? `Last seen ${new Date(participant.lastSeenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : '';

  const peerLastReadAt = meta?.peerLastReadAt ?? 0;
  const pinnedIds = useMemo(() => new Set((meta?.pinned ?? []).map((pin) => pin.id)), [meta]);
  const serverMessages = useMemo<ChatMessage[]>(
    () =>
      [...history.results].reverse().map((message) => {
        const mine = String(message.senderId) === String(userId);
        return {
          id: String(message.id),
          kind: message.kind,
          createdAt: message.createdAt,
          mine,
          senderId: String(message.senderId),
          senderName: mine ? 'You' : message.senderName,
          senderAvatarUrl: message.senderAvatarUrl,
          senderAvatarId: message.senderAvatarId,
          text: message.text,
          imageUrl: message.attachmentUrl,
          reactions: message.reactions,
          myReaction: message.myReaction,
          pinned: message.pinnedAt !== null || pinnedIds.has(message.id),
          canPin: true,
          seen: mine && peerLastReadAt >= message.createdAt,
          ...finaiChatOverrides(message.ai),
        };
      }),
    [history.results, peerLastReadAt, pinnedIds, userId],
  );
  const messages = useMemo(
    () => [...serverMessages, ...optimistic.messages],
    [optimistic.messages, serverMessages],
  );
  // Freeze the unread marker at open so it does not vanish as soon as the pointer advances.
  const [firstUnreadId, setFirstUnreadId] = useState<string | undefined | null>(null);
  const loadingUnread = useLoadUnreadHistory({
    active: firstUnreadId === null,
    createdAtOldestFirst: serverMessages.map((message) => message.createdAt),
    lastReadAt: meta?.myLastReadAt,
    unreadCount: meta?.unreadCount,
    status: history.status,
    loadMore: () => history.loadMore(PAGE_SIZE),
  });
  if (firstUnreadId === null && meta && history.status !== 'LoadingFirstPage' && !loadingUnread)
    setFirstUnreadId(firstUnreadMessageId(serverMessages, meta.myLastReadAt) ?? undefined);

  function submitText() {
    const value = text.trim();
    if (!value || !conversationId) return;
    setText('');
    typing.stop();
    optimistic.send({ kind: 'text', text: value, senderName: 'You' }, () =>
      sendText({ conversationId, text: value }),
    );
  }
  async function attachImage() {
    if (!conversationId || uploading) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const mimeType =
        asset.mimeType?.toLowerCase() ?? (extension ? extensionMimeTypes[extension] : undefined);
      if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        toast.error('Choose a JPEG, PNG, or WebP image');
        return;
      }
      setUploading(true);
      const image = await (await fetch(asset.uri)).blob();
      if (!image.size || image.size > 5 * 1024 * 1024) {
        setUploading(false);
        toast.error('Choose an image up to 5 MB.');
        return;
      }
      // Stay busy until the upload and message have settled, so one tap is one upload.
      await optimistic.send({ kind: 'image', imageUrl: asset.uri, senderName: 'You' }, async () => {
        const { uploadUrl, ticket } = await createUpload({ conversationId });
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': mimeType },
          body: image,
        });
        if (!response.ok) throw new Error('Image upload failed');
        const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
        await sendImage({ conversationId, storageId, ticket });
      });
      setUploading(false);
    } catch (error) {
      setUploading(false);
      toast.error(error instanceof Error ? error.message : 'Image could not be sent');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: tokens.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 12,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: tokens.borderSubtle,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        {conversation ? (
          <Avatar
            label={peerName}
            initials={peerName.slice(0, 2).toUpperCase()}
            size={40}
            avatarId={conversation.avatarId}
            imageUrl={conversation.avatarUrl}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Typography variant="label">{conversation?.displayName ?? 'Conversation'}</Typography>
          <Text
            style={{
              color: typistIds.length ? tokens.primary : tokens.foregroundMuted,
              fontSize: 12,
            }}
            accessibilityLiveRegion="polite"
          >
            {presenceLabel}
          </Text>
        </View>
      </View>
      {conversations !== undefined && !conversation ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Typography variant="body">
            This conversation is unavailable or you are not a participant.
          </Typography>
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            paddingHorizontal: 12,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 10),
          }}
        >
          <ChatThread
            mode="direct"
            messages={messages}
            loading={history.status === 'LoadingFirstPage' || loadingUnread}
            canLoadOlder={history.status === 'CanLoadMore'}
            loadingOlder={history.status === 'LoadingMore'}
            onLoadOlder={() => history.loadMore(PAGE_SIZE)}
            firstUnreadId={firstUnreadId ?? undefined}
            typingNames={[
              ...(typistIds.length ? [peerName] : []),
              ...finaiTypingNames(serverMessages),
            ]}
            renderAiContent={(message) => (
              <FinaiSurface
                a2ui={message.ai?.a2ui}
                actions={message.ai?.actions}
                onDecide={decideFinai}
              />
            )}
            pinned={(meta?.pinned ?? []).map((pin) => ({
              id: String(pin.id),
              text: pin.text,
              senderName: String(pin.senderId) === String(userId) ? 'You' : pin.senderName,
              canUnpin: true,
            }))}
            onTogglePin={(id, pinned) =>
              void setPinned({ messageId: id as Id<'directMessages'>, pinned }).catch((error) =>
                toast.error(error instanceof Error ? error.message : 'Could not update the pin'),
              )
            }
            onReact={(id, emoji) =>
              void toggleReaction({ messageId: id as Id<'directMessages'>, emoji }).catch((error) =>
                toast.error(
                  error instanceof Error ? error.message : 'Could not update this reaction',
                ),
              )
            }
            onRetry={optimistic.retry}
            onDiscard={optimistic.discard}
            onSeenLatest={onSeenLatest}
            emptyTitle={`Say hello to ${peerName}`}
            emptyDescription="Messages, photos and reactions appear here instantly."
            composer={{
              draft: text,
              onDraftChange: (value) => {
                setText(value);
                typing.onDraftChange(value);
              },
              onSend: submitText,
              onBlur: typing.stop,
              onAttach: () => void attachImage(),
              attachLabel: 'Attach image',
              uploading,
              placeholder: 'Message (@finai to ask FinAI)',
              mentions: [FINAI_MENTION],
            }}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
