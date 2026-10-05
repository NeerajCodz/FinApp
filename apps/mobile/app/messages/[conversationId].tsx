import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, ArrowRight, Plus } from '@finapp/ui/icons/native';
import { Avatar, IconButton, Text, Typography, useTheme } from '@finapp/ui/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@/lib/toast';
import { useLocalSync } from '@/providers/LocalSyncProvider';

type Message = {
  id: Id<'directMessages'>;
  senderId: Id<'users'>;
  kind: 'text' | 'image';
  text?: string;
  attachmentUrl?: string;
  createdAt: number;
  seen: boolean;
  senderName: string;
  reactions?: { emoji: string; count: number }[];
  myReaction?: string | null;
};
const reactionChoices = ['❤️', '👍', '😂', '😮'] as const;
type Conversation = {
  id: Id<'directConversations'>;
  userId: Id<'users'>;
  displayName?: string;
  username?: string;
  avatarId?: string;
};

export default function DirectConversationScreen() {
  const { conversationId: routeId } = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = (
    Array.isArray(routeId) ? routeId[0] : routeId
  ) as Id<'directConversations'>;
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const listRef = useRef<ScrollView>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [reactionMenuId, setReactionMenuId] = useState<Id<'directMessages'> | null>(null);
  const [reactingMessageId, setReactingMessageId] = useState<Id<'directMessages'> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingActive = useRef(false);
  const typingLastSent = useRef(0);
  const messages = useQuery(
    api.directMessages.queries.messages,
    conversationId ? { conversationId } : 'skip',
  ) as Message[] | undefined;
  const conversations = useQuery(api.directMessages.queries.listConversations, {}) as
    Conversation[] | undefined;
  const presence = useQuery(
    api.presence.queries.scopeState,
    conversationId ? { scopeType: 'direct', scopeId: conversationId } : 'skip',
  );
  const sendText = useMutation(api.directMessages.mutations.sendText);
  const createUpload = useMutation(api.directMessages.mutations.createImageUpload);
  const sendImage = useMutation(api.directMessages.mutations.sendImage);
  const markSeen = useMutation(api.presence.mutations.markDirectSeen);
  const setTyping = useMutation(api.presence.mutations.setTyping);
  const toggleReaction = useMutation(api.directMessages.mutations.toggleReaction);
  const conversation = useMemo(
    () => conversations?.find((row) => String(row.id) === String(conversationId)),
    [conversations, conversationId],
  );
  const participant = presence?.participants?.[0];
  const presenceLabel =
    participant?.active === true
      ? 'Active now'
      : participant?.lastSeenAt
        ? `Last seen ${new Date(participant.lastSeenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : '';
  async function react(messageId: Id<'directMessages'>, emoji: (typeof reactionChoices)[number]) {
    if (reactingMessageId) return;
    setReactingMessageId(messageId);
    try {
      await toggleReaction({ messageId, emoji });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update this reaction');
    } finally {
      setReactingMessageId(null);
    }
  }

  useEffect(() => {
    if (!messages?.length || !userId) return;
    for (const message of messages) {
      if (String(message.senderId) !== String(userId) && !message.seen)
        void markSeen({ messageId: message.id }).catch(() => undefined);
    }
  }, [messages, userId, markSeen]);
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (conversationId && typingActive.current) {
        typingActive.current = false;
        void setTyping({
          scopeType: 'direct',
          scopeId: conversationId,
          typing: false,
        }).catch(() => undefined);
      }
    },
    [conversationId, setTyping],
  );
  function stopTyping() {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = undefined;
    if (typingActive.current) {
      typingActive.current = false;
      void setTyping({ scopeType: 'direct', scopeId: conversationId, typing: false }).catch(
        () => undefined,
      );
    }
  }
  function updateText(value: string) {
    setText(value);
    const active = Boolean(value.trim());
    if (!active) {
      stopTyping();
      return;
    }
    const now = Date.now();
    if (!typingActive.current || now - typingLastSent.current >= 4_000) {
      typingActive.current = true;
      typingLastSent.current = now;
      void setTyping({ scopeType: 'direct', scopeId: conversationId, typing: true }).catch(
        () => undefined,
      );
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      typingTimer.current = undefined;
      typingActive.current = false;
      void setTyping({ scopeType: 'direct', scopeId: conversationId, typing: false }).catch(
        () => undefined,
      );
    }, 1_800);
  }
  async function submitText() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      await sendText({ conversationId, text: value });
      setText('');
      stopTyping();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Message could not be sent');
    } finally {
      setSending(false);
    }
  }
  async function attachImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const extensionMimeTypes: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      };
      const extension = asset.fileName?.split('.').pop()?.toLowerCase();
      const mimeType =
        asset.mimeType?.toLowerCase() ?? (extension ? extensionMimeTypes[extension] : undefined);
      if (!mimeType || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
        toast.error('Choose a JPEG, PNG, or WebP image');
        return;
      }
      setSending(true);
      const image = await (await fetch(asset.uri)).blob();
      if (!image.size || image.size > 5 * 1024 * 1024)
        throw new Error('Choose an image up to 5 MB.');
      const { uploadUrl, ticket } = await createUpload({ conversationId });
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': mimeType },
        body: image,
      });
      if (!response.ok) throw new Error('Image upload failed');
      const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
      await sendImage({ conversationId, storageId, ticket });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Image could not be sent');
    } finally {
      setSending(false);
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
            label={conversation.displayName ?? 'Friend'}
            initials={(conversation.displayName ?? 'F').slice(0, 2).toUpperCase()}
            size={40}
            avatarId={conversation.avatarId}
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Typography variant="label">{conversation?.displayName ?? 'Conversation'}</Typography>
          <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
            {presence?.typingUserIds?.length ? 'Typing…' : presenceLabel}
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
        <>
          {messages === undefined ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <ActivityIndicator color={tokens.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 18 }}>
              <Typography variant="body">No messages yet. Say hello.</Typography>
            </View>
          ) : null}
          <ScrollView
            ref={listRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          >
            {(messages ?? []).map((message) => {
              const mine = String(message.senderId) === String(userId);
              return (
                <View
                  key={String(message.id)}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '82%',
                    padding: message.kind === 'image' ? 4 : 12,
                    borderRadius: 18,
                    backgroundColor: mine ? tokens.primary : tokens.surfaceSubtle,
                  }}
                >
                  {message.kind === 'image' && message.attachmentUrl ? (
                    <Image
                      source={{ uri: message.attachmentUrl }}
                      resizeMode="cover"
                      style={{ width: 220, height: 220, borderRadius: 14 }}
                    />
                  ) : (
                    <Text style={{ color: mine ? tokens.primaryForeground : tokens.foreground }}>
                      {message.text}
                    </Text>
                  )}
                  <Text
                    style={{
                      color: mine ? tokens.primaryForeground : tokens.foregroundMuted,
                      fontSize: 10,
                      marginTop: 5,
                      textAlign: 'right',
                    }}
                  >
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                    {mine && message.seen ? ' · Seen' : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {message.reactions?.map(({ emoji, count }) => (
                      <TouchableOpacity
                        key={emoji}
                        accessibilityRole="button"
                        accessibilityLabel={`${emoji} reaction, ${count} ${count === 1 ? 'person' : 'people'}`}
                        accessibilityState={{ selected: message.myReaction === emoji }}
                        disabled={reactingMessageId === message.id}
                        onPress={() =>
                          void react(message.id, emoji as (typeof reactionChoices)[number])
                        }
                        style={{
                          borderWidth: 1,
                          borderColor:
                            message.myReaction === emoji ? tokens.primary : tokens.borderSubtle,
                          borderRadius: 14,
                          paddingHorizontal: 7,
                          paddingVertical: 3,
                          backgroundColor: tokens.surfaceRaised,
                        }}
                      >
                        <Text style={{ color: tokens.foreground, fontSize: 12 }}>
                          {emoji} {count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Add a reaction"
                      accessibilityState={{ expanded: reactionMenuId === message.id }}
                      onPress={() =>
                        setReactionMenuId((current) => (current === message.id ? null : message.id))
                      }
                      style={{
                        borderWidth: 1,
                        borderColor: tokens.borderSubtle,
                        borderRadius: 14,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        backgroundColor: tokens.surfaceRaised,
                      }}
                    >
                      <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>+</Text>
                    </TouchableOpacity>
                    {reactionMenuId === message.id &&
                      reactionChoices.map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          accessibilityRole="button"
                          accessibilityLabel={`React with ${emoji}`}
                          accessibilityState={{ selected: message.myReaction === emoji }}
                          disabled={reactingMessageId === message.id}
                          onPress={() => {
                            void react(message.id, emoji);
                            setReactionMenuId(null);
                          }}
                          style={{
                            borderWidth: 1,
                            borderColor:
                              message.myReaction === emoji ? tokens.primary : tokens.borderSubtle,
                            borderRadius: 14,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            backgroundColor: tokens.surfaceRaised,
                          }}
                        >
                          <Text style={{ fontSize: 12 }}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 8,
              paddingBottom: Math.max(insets.bottom, 10),
              borderTopWidth: 1,
              borderTopColor: tokens.borderSubtle,
              flexDirection: 'row',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <TouchableOpacity
              accessibilityLabel="Attach image"
              disabled={sending}
              onPress={() => void attachImage()}
              style={{ padding: 10 }}
            >
              <Plus size={21} color={tokens.foregroundMuted} />
            </TouchableOpacity>
            <TextInput
              value={text}
              onChangeText={updateText}
              onBlur={stopTyping}
              placeholder="Message"
              placeholderTextColor={tokens.foregroundSubtle}
              multiline
              maxLength={4000}
              style={{
                flex: 1,
                maxHeight: 110,
                minHeight: 42,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 10,
                color: tokens.foreground,
                backgroundColor: tokens.surfaceSubtle,
              }}
              onSubmitEditing={() => void submitText()}
            />
            <TouchableOpacity
              accessibilityLabel="Send message"
              disabled={sending || !text.trim()}
              onPress={() => void submitText()}
              style={{ padding: 10, opacity: sending || !text.trim() ? 0.5 : 1 }}
            >
              <ArrowRight size={20} color={tokens.primary} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
