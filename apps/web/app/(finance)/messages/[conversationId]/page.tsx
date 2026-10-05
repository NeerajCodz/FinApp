'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft, ImagePlus, Send } from 'lucide-react';
import { Avatar } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

type Message = {
  id: string;
  senderId: string;
  senderName: string;
  kind: 'text' | 'image';
  text?: string;
  attachmentUrl?: string;
  mimeType?: string;
  createdAt: number;
  seen: boolean;
  reactions?: { emoji: string; count: number }[];
  myReaction?: string | null;
};
const reactionChoices = ['❤️', '👍', '😂', '😮'] as const;
type Conversation = {
  id: string;
  userId: string;
  username?: string;
  displayName?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};
type Presence = {
  participants: Array<{ userId: string; active: boolean | null; lastSeenAt: number | null }>;
  typingUserIds: string[];
};
const timeLabel = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(timestamp);
const presenceLabel = (presence?: Presence['participants'][number]) => {
  if (!presence) return '';
  if (presence.active === true) return 'Active now';
  if (presence.lastSeenAt)
    return `Last seen ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(presence.lastSeenAt)}`;
  return '';
};

export default function DirectConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId;
  const { userId, isConnected } = useBrowserSync();
  const [text, setText] = React.useState('');
  const [error, setError] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [reactionMenuId, setReactionMenuId] = React.useState<string | null>(null);
  const [reactingMessageId, setReactingMessageId] = React.useState<string | null>(null);
  const [typing, setTyping] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const seenRef = React.useRef(new Set<string>());
  const messageListRef = React.useRef<HTMLElement>(null);
  const conversations = useQuery(
    api.directMessages.queries.listConversations,
    userId ? {} : 'skip',
  ) as Conversation[] | undefined;
  const messages = useQuery(
    api.directMessages.queries.messages,
    userId ? { conversationId: conversationId as never } : 'skip',
  ) as Message[] | undefined;
  const presence = useQuery(
    api.presence.queries.scopeState,
    userId ? { scopeType: 'direct', scopeId: conversationId as never } : 'skip',
  ) as Presence | undefined;
  const sendText = useMutation(api.directMessages.mutations.sendText);
  const createImageUpload = useMutation(api.directMessages.mutations.createImageUpload);
  const sendImage = useMutation(api.directMessages.mutations.sendImage);
  const setTypingMutation = useMutation(api.presence.mutations.setTyping);
  const markDirectSeen = useMutation(api.presence.mutations.markDirectSeen);
  const toggleReaction = useMutation(api.directMessages.mutations.toggleReaction);
  const conversation = conversations?.find((row) => row.id === conversationId);
  const peerPresence = presence?.participants[0];
  const peerTyping = Boolean(conversation && presence?.typingUserIds.includes(conversation.userId));

  React.useEffect(() => {
    if (!userId || !messages) return;
    for (const message of messages) {
      if (message.senderId !== userId && !message.seen && !seenRef.current.has(message.id)) {
        seenRef.current.add(message.id);
        void markDirectSeen({ messageId: message.id as never }).catch(() => {
          seenRef.current.delete(message.id);
        });
      }
    }
  }, [markDirectSeen, messages, userId]);
  React.useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages?.length]);
  React.useEffect(() => {
    if (!userId || !typing) return;
    const publish = () =>
      void setTypingMutation({
        scopeType: 'direct',
        scopeId: conversationId as never,
        typing: true,
      }).catch(() => undefined);
    const stop = () =>
      void setTypingMutation({
        scopeType: 'direct',
        scopeId: conversationId as never,
        typing: false,
      }).catch(() => undefined);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') publish();
      else stop();
    };
    publish();
    const interval = window.setInterval(publish, 4_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', stop);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [conversationId, setTypingMutation, typing, userId]);
  async function react(messageId: string, emoji: (typeof reactionChoices)[number]) {
    if (reactingMessageId) return;
    setReactingMessageId(messageId);
    setError('');
    try {
      await toggleReaction({ messageId: messageId as never, emoji });
    } catch {
      setError('Could not update this reaction. Try again.');
    } finally {
      setReactingMessageId(null);
    }
  }

  async function submitText(event: React.FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError('');
    try {
      await sendText({ conversationId: conversationId as never, text: value });
      setText('');
      setTyping(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send this message.');
    } finally {
      setSending(false);
    }
  }

  async function submitImage(file?: File) {
    if (!file || sending) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setSending(true);
    setError('');
    try {
      const { uploadUrl, ticket } = await createImageUpload({
        conversationId: conversationId as never,
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
        conversationId: conversationId as never,
        storageId: storageId as never,
        ticket,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send this image.');
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--finance-background, #fff)',
        color: 'var(--finance-text, #111)',
      }}
      aria-label="Direct conversation"
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 18px',
          borderBottom: '1px solid var(--finance-line, #ddd)',
        }}
      >
        <Link href="/people" aria-label="Back to People" className="finance-secondary-action">
          <ArrowLeft size={19} />
        </Link>
        {conversation && (
          <Avatar
            label={conversation.displayName ?? 'Conversation'}
            initials={(conversation.displayName ?? '?').slice(0, 2).toUpperCase()}
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
          <small role="status">
            {presenceLabel(peerPresence)}
            {peerTyping ? ' · typing…' : ''}
          </small>
        </div>
      </header>
      {!isConnected && (
        <p className="finance-form-note" role="status" style={{ padding: '0 18px' }}>
          You’re offline. Messages cannot be loaded or sent.
        </p>
      )}
      {error && (
        <p className="finance-form-error" role="alert" style={{ padding: '0 18px' }}>
          {error}
        </p>
      )}
      {!userId ? (
        <p className="finance-form-error" role="alert" style={{ padding: 18 }}>
          Sign in to access direct messages. <Link href="/sign-in">Sign in</Link>
        </p>
      ) : !isConnected ? (
        <p className="finance-form-note" role="status" style={{ padding: 18 }}>
          Reconnect to load this conversation.
        </p>
      ) : conversations === undefined || messages === undefined ? (
        <p role="status" style={{ padding: 18 }}>
          Loading conversation…
        </p>
      ) : !conversation ? (
        <p className="finance-form-error" role="alert" style={{ padding: 18 }}>
          This conversation is unavailable or you don’t have access.
        </p>
      ) : (
        <section
          ref={messageListRef}
          aria-label="Messages"
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '16px max(16px, calc((100vw - 760px) / 2))',
          }}
        >
          {messages.length === 0 && (
            <p className="finance-muted" style={{ textAlign: 'center' }}>
              Start the conversation with a message.
            </p>
          )}
          {messages.map((message) => {
            const mine = message.senderId === userId;
            return (
              <article
                key={message.id}
                aria-label={`${mine ? 'You' : message.senderName}, ${timeLabel(message.createdAt)}`}
                style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: 'min(80%, 560px)',
                  padding: 12,
                  borderRadius: 14,
                  background: mine
                    ? 'var(--finance-panel-raise, #edf2ff)'
                    : 'var(--finance-panel, #f5f5f5)',
                }}
              >
                {!mine && <small>{message.senderName}</small>}
                {message.kind === 'image' && message.attachmentUrl ? (
                  <a href={message.attachmentUrl} target="_blank" rel="noreferrer">
                    <img
                      src={message.attachmentUrl}
                      alt="Image attachment"
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: 360,
                        borderRadius: 8,
                      }}
                    />
                  </a>
                ) : message.kind === 'image' ? (
                  <span>Image unavailable</span>
                ) : (
                  <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0' }}>
                    {message.text}
                  </p>
                )}
                <small>
                  {timeLabel(message.createdAt)}
                  {mine && message.seen ? ' · Seen' : ''}
                </small>
                <div className="direct-message-reactions">
                  {(message.reactions ?? []).map(({ emoji, count }) => (
                    <button
                      key={emoji}
                      type="button"
                      className={message.myReaction === emoji ? 'is-active' : ''}
                      aria-label={`${emoji} reaction, ${count} ${count === 1 ? 'person' : 'people'}${message.myReaction === emoji ? ', yours' : ''}`}
                      aria-pressed={message.myReaction === emoji}
                      disabled={!isConnected || reactingMessageId === message.id}
                      onClick={() =>
                        void react(message.id, emoji as (typeof reactionChoices)[number])
                      }
                    >
                      {emoji} <span>{count}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="direct-message-reaction-add"
                    aria-label="Add a reaction"
                    aria-expanded={reactionMenuId === message.id}
                    disabled={!isConnected || reactingMessageId === message.id}
                    onClick={() =>
                      setReactionMenuId((current) => (current === message.id ? null : message.id))
                    }
                  >
                    +
                  </button>
                  {reactionMenuId === message.id && (
                    <div
                      className="direct-message-reaction-picker"
                      role="group"
                      aria-label="Choose a reaction"
                    >
                      {reactionChoices.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`React with ${emoji}`}
                          aria-pressed={message.myReaction === emoji}
                          disabled={!isConnected || reactingMessageId === message.id}
                          onClick={() => {
                            void react(message.id, emoji);
                            setReactionMenuId(null);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {peerTyping && (
            <p className="finance-muted" role="status">
              {conversation.displayName} is typing…
            </p>
          )}
        </section>
      )}
      <form
        onSubmit={submitText}
        style={{
          display: 'flex',
          alignItems: 'end',
          gap: 8,
          padding: 12,
          borderTop: '1px solid var(--finance-line, #ddd)',
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(event) => void submitImage(event.target.files?.[0])}
          aria-label="Choose image attachment"
        />
        <button
          type="button"
          className="finance-secondary-action"
          disabled={!isConnected || sending || !conversation}
          onClick={() => fileRef.current?.click()}
          aria-label="Attach JPEG, PNG, or WebP image"
        >
          <ImagePlus size={20} />
        </button>
        <textarea
          aria-label="Message"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setTyping(Boolean(event.target.value.trim()));
          }}
          disabled={!isConnected || sending || !conversation}
          maxLength={4000}
          rows={1}
          placeholder="Write a message…"
          style={{ flex: 1, resize: 'vertical' }}
        />
        <button
          className="finance-primary-link"
          type="submit"
          disabled={!isConnected || sending || !conversation || !text.trim()}
          aria-label="Send message"
        >
          <Send size={18} /> Send
        </button>
      </form>
    </main>
  );
}
