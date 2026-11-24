'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@finapp/ui/web';
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
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useFinaiDecide } from '@/lib/finai/useFinaiDecide';
import { FinaiSurface } from '@finapp/ui/ai';
import { FINAI_MENTION, finaiChatOverrides, finaiTypingNames } from '@finapp/ui/ai/finai';

const PAGE_SIZE = 30;
type Presence = {
  participants: Array<{ userId: string; active: boolean | null; lastSeenAt: number | null }>;
};
const presenceLabel = (presence?: Presence['participants'][number]) => {
  if (!presence) return '';
  if (presence.active === true) return 'Active now';
  if (presence.lastSeenAt)
    return `Last seen ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(presence.lastSeenAt)}`;
  return '';
};
const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message : fallback;

export default function DirectConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { userId, isConnected } = useBrowserSync();
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState('');
  const live = Boolean(userId && isConnected);
  const conversations = useQuery(api.directMessages.queries.listConversations, live ? {} : 'skip');
  const history = usePaginatedQuery(
    api.directMessages.queries.messagesPage,
    live ? { conversationId } : 'skip',
    { initialNumItems: PAGE_SIZE },
  );
  const meta = useQuery(
    api.directMessages.queries.conversationMeta,
    live ? { conversationId } : 'skip',
  );
  const presence = useQuery(
    api.presence.queries.scopeState,
    live ? { scopeType: 'direct', scopeId: conversationId } : 'skip',
  );
  const sendText = useMutation(api.directMessages.mutations.sendText);
  const createImageUpload = useMutation(api.directMessages.mutations.createImageUpload);
  const sendImage = useMutation(api.directMessages.mutations.sendImage);
  const setTypingMutation = useMutation(api.presence.mutations.setTyping);
  const markRead = useMutation(api.presence.mutations.markRead);
  const toggleReaction = useMutation(api.directMessages.mutations.toggleReaction);
  const decideFinai = useFinaiDecide();
  const setPinned = useMutation(api.directMessages.mutations.setPinned);
  const typedConversationId = conversationId as Id<'directConversations'>;
  const typing = useTypingSender(
    live
      ? (active) =>
          setTypingMutation({ scopeType: 'direct', scopeId: typedConversationId, typing: active })
      : undefined,
  );
  const onSeenLatest = useReadMarker(
    live
      ? (readAt) => markRead({ scopeType: 'direct', scopeId: conversationId, readAt })
      : undefined,
    meta?.myLastReadAt,
  );
  const optimistic = useOptimisticMessages((cause) =>
    toast.error(errorText(cause, 'Could not send this message.')),
  );
  const typistIds = useLiveTypists(presence?.typing);
  const conversation = conversations?.find((row) => row.id === conversationId);
  const peerName = conversation?.displayName ?? 'Friend';
  const peerTyping = Boolean(conversation && typistIds.includes(conversation.userId));
  const peerLastReadAt = meta?.peerLastReadAt ?? 0;
  const pinnedIds = React.useMemo(
    () => new Set((meta?.pinned ?? []).map((pin) => String(pin.id))),
    [meta?.pinned],
  );
  const serverMessages = React.useMemo<ChatMessage[]>(
    () =>
      [...history.results].reverse().map((message) => {
        const mine = message.senderId === userId;
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
          pinned: message.pinnedAt !== null || pinnedIds.has(String(message.id)),
          canPin: true,
          seen: mine && peerLastReadAt >= message.createdAt,
          ...finaiChatOverrides(message.ai),
        };
      }),
    [history.results, peerLastReadAt, pinnedIds, userId],
  );
  const messages = React.useMemo(
    () => [...serverMessages, ...optimistic.messages],
    [optimistic.messages, serverMessages],
  );
  const [firstUnreadId, setFirstUnreadId] = React.useState<string | undefined | null>(null);
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
    if (!value) return;
    setText('');
    setError('');
    typing.stop();
    optimistic.send({ kind: 'text', text: value, senderName: 'You' }, () =>
      sendText({ conversationId: typedConversationId, text: value }),
    );
  }
  function submitImage(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }
    setError('');
    optimistic.send(
      { kind: 'image', imageUrl: URL.createObjectURL(file), senderName: 'You' },
      async () => {
        const { uploadUrl, ticket } = await createImageUpload({
          conversationId: typedConversationId,
        });
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!response.ok) throw new Error(`Image upload failed (${response.status}).`);
        const uploaded: unknown = await response.json();
        const storageId =
          uploaded && typeof uploaded === 'object' && 'storageId' in uploaded
            ? uploaded.storageId
            : null;
        if (typeof storageId !== 'string')
          throw new Error('The image upload did not return a storage ID.');
        await sendImage({
          conversationId: typedConversationId,
          storageId: storageId as Id<'_storage'>,
          ticket,
        });
      },
    );
  }

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--finapp-background)',
        color: 'var(--finapp-foreground)',
      }}
      aria-label="Direct conversation"
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          borderBottom: '1px solid var(--finapp-border-subtle)',
        }}
      >
        <Link href="/people" aria-label="Back to People" className="finance-secondary-action">
          <ArrowLeft size={19} />
        </Link>
        {conversation && (
          <Avatar
            label={peerName}
            initials={peerName.slice(0, 2).toUpperCase()}
            size={40}
            avatarId={conversation.avatarId}
            imageUrl={conversation.avatarUrl}
          />
        )}
        <div>
          <strong>{conversation?.displayName ?? 'Conversation'}</strong>
          {conversation?.username && (
            <div>
              <small>@{conversation.username}</small>
            </div>
          )}
          <small
            role="status"
            style={{
              color: peerTyping ? 'var(--finapp-primary)' : 'var(--finapp-foreground-muted)',
            }}
          >
            {peerTyping ? 'typing…' : presenceLabel(presence?.participants[0])}
          </small>
        </div>
      </header>
      {!userId ? (
        <p className="finance-form-error" role="alert" style={{ padding: 18 }}>
          Sign in to access direct messages. <Link href="/sign-in">Sign in</Link>
        </p>
      ) : !isConnected ? (
        <p className="finance-form-note" role="status" style={{ padding: 18 }}>
          You’re offline. Reconnect to load and send messages in this conversation.
        </p>
      ) : conversations !== undefined && !conversation ? (
        <p className="finance-form-error" role="alert" style={{ padding: 18 }}>
          This conversation is unavailable or you don’t have access.
        </p>
      ) : (
        <ChatThread
          mode="direct"
          style={{ padding: '8px max(16px, calc((100vw - 760px) / 2)) 12px' }}
          messages={messages}
          loading={history.status === 'LoadingFirstPage' || conversations === undefined}
          canLoadOlder={history.status === 'CanLoadMore'}
          loadingOlder={history.status === 'LoadingMore'}
          onLoadOlder={() => history.loadMore(PAGE_SIZE)}
          firstUnreadId={firstUnreadId ?? undefined}
          typingNames={[...(peerTyping ? [peerName] : []), ...finaiTypingNames(serverMessages)]}
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
            senderName: pin.senderId === userId ? 'You' : pin.senderName,
            canUnpin: true,
          }))}
          onTogglePin={(id, pinned) =>
            void setPinned({ messageId: id as Id<'directMessages'>, pinned }).catch(
              (cause: unknown) => toast.error(errorText(cause, 'Could not update the pin.')),
            )
          }
          onReact={(id, emoji) =>
            void toggleReaction({ messageId: id as Id<'directMessages'>, emoji }).catch(
              (cause: unknown) => toast.error(errorText(cause, 'Could not update this reaction.')),
            )
          }
          onRetry={optimistic.retry}
          onDiscard={optimistic.discard}
          onSeenLatest={onSeenLatest}
          emptyTitle={`Say hello to ${peerName}`}
          emptyDescription="Messages, photos and reactions appear here instantly."
          error={error || undefined}
          composer={{
            draft: text,
            onDraftChange: (value) => {
              setText(value);
              typing.onDraftChange(value);
            },
            onSend: submitText,
            onBlur: typing.stop,
            onAttachFile: submitImage,
            attachLabel: 'Attach JPEG, PNG, or WebP image',
            placeholder: 'Write a message… (@finai to ask FinAI)',
            mentions: [FINAI_MENTION],
          }}
        />
      )}
    </main>
  );
}
