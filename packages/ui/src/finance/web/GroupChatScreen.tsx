'use client';

import React, { useEffect, useRef } from 'react';
import { Button, useTheme } from '@finapp/ui/web';
import { ArrowLeft, Image as ImageIcon, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { FinanceEmptyState } from './FinanceEmptyState';
import { GroupPage, Tile, PersonAvatar, s } from './GroupUI';
import { ChatThread } from '../../chat/web/ChatThread';
import { FinaiSurface } from '../../ai/web/FinaiSurface';
import { ThinkingOrb } from '../../web/ThinkingOrb';
import {
  FINAI_MENTION,
  finaiErrorMessage,
  orbStateFor,
  finaiChatOverrides,
  finaiTypingNames,
  type ServerFinaiChatFields,
} from '../../ai/finai';
import {
  chatHeaderSubtitle,
  type ChatMessage,
  type ChatPerson,
  type ChatPin,
  type ChatReactionEmoji,
} from '../../chat/model';
import type { VoiceClip } from '../../chat/web/voice';
import { VoiceBubble } from '../../chat/web/voice';

export type GroupChatItem = {
  id: string;
  kind: 'message' | 'expense' | 'settlement';
  date: string;
  accessibleLabel: string;
  sender?: string;
  senderAvatarId?: string;
  senderAvatarUrl?: string | null;
  ownMessage?: boolean;
  text?: string;
  attachmentUrl?: string | null;
  title?: string;
  amount?: string;
  icon?: string;
  color?: string;
  readBy?: readonly string[];
  onPress?: () => void;
  createdAt?: number;
  senderId?: string;
  status?: 'sent' | 'pending' | 'failed';
  reactions?: readonly { emoji: string; count: number }[];
  myReaction?: string | null;
  pinned?: boolean;
  canPin?: boolean;
  seenByPeople?: readonly ChatPerson[];
  /** FinAI reply state when this message is an @finai answer. */
  ai?: ServerFinaiChatFields;
  /** Voice message: clip URL and length. */
  audioUrl?: string | null;
  durationMs?: number;
};

export type GroupChatScreenProps = {
  items: readonly GroupChatItem[];
  loading: boolean;
  canSend: boolean;
  connected: boolean;
  draft: string;
  pending: boolean;
  error?: string;
  onDraftChange: (value: string) => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Full chat screen: send the current draft (optimistic). */
  onSend?: () => void;
  onAttachFile?: (file: File) => void;
  /** Sends a recorded voice clip (an empty composer shows a mic). */
  onSendVoice?: (clip: VoiceClip) => void;
  /** Members currently online (presence), for the header line. */
  onlineCount?: number;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string;
  pinned?: readonly (ChatPin & { canUnpin?: boolean })[];
  onTogglePin?: (id: string, pinned: boolean) => void;
  onReact?: (id: string, emoji: ChatReactionEmoji) => void;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
  onSeenLatest?: (createdAt: number) => void;
  group?: { name: string; currency: string; icon?: string; color?: string };
  members?: readonly {
    id: string;
    name: string;
    username?: string;
    avatarId?: string;
    avatarUrl?: string | null;
  }[];
  typingNames?: readonly string[];
  onTypingChange?: (typing: boolean) => void;
  onBack?: () => void;
  onOpenGroup?: () => void;
  onAddExpense?: () => void;
  onOpenSettings?: () => void;
  embedded?: boolean;
  /** Confirms or cancels a FinAI card. */
  onFinaiDecide?: (actionId: string, decision: 'confirm' | 'cancel') => Promise<unknown>;
};

function threadMessages(items: readonly GroupChatItem[]): ChatMessage[] {
  return items.map((item) => {
    const base = {
      id: item.id,
      createdAt: item.createdAt ?? 0,
      mine: !!item.ownMessage,
      senderId: item.senderId,
      senderName: item.ownMessage ? 'You' : item.sender,
      senderAvatarUrl: item.senderAvatarUrl,
      senderAvatarId: item.senderAvatarId,
    };
    if (item.kind !== 'message')
      return {
        ...base,
        kind: 'event' as const,
        event: {
          label: item.kind === 'expense' ? 'Expense added' : 'Settlement recorded',
          title: item.title ?? '',
          amount: item.amount,
          icon: item.icon,
          color: item.color,
          onPress: item.onPress,
        },
      };
    return {
      ...base,
      kind:
        item.audioUrl !== undefined
          ? ('audio' as const)
          : item.text === undefined && item.attachmentUrl !== undefined
            ? ('image' as const)
            : ('text' as const),
      text: item.text,
      imageUrl: item.audioUrl !== undefined ? undefined : item.attachmentUrl,
      audioUrl: item.audioUrl,
      durationMs: item.durationMs,
      status: item.status,
      reactions: item.reactions,
      myReaction: item.myReaction,
      pinned: item.pinned,
      canPin: item.canPin,
      seenBy: item.seenByPeople,
      ...finaiChatOverrides(item.ai),
    };
  });
}

function EventCard({ item }: { item: GroupChatItem }) {
  const { tokens } = useTheme();
  const body = (
    <>
      <Tile
        icon={
          item.icon ?? (item.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight')
        }
        color={item.color ?? tokens.warning}
      />
      <span className={s.activityCopy}>
        <small>
          {item.kind === 'expense' ? 'Expense added' : 'Settlement recorded'} · {item.date}
        </small>
        <span>{item.title}</span>
        <strong>{item.amount}</strong>
        {item.onPress && <small>View ledger record →</small>}
      </span>
    </>
  );
  return item.onPress ? (
    <button type="button" className={s.expenseBubble} onClick={item.onPress}>
      {body}
    </button>
  ) : (
    <div className={s.expenseBubble}>{body}</div>
  );
}

export function GroupChatScreen(p: GroupChatScreenProps) {
  const { tokens } = useTheme();
  const timelineRef = useRef<HTMLDivElement>(null);
  const messages = React.useMemo(() => threadMessages(p.items), [p.items]);
  useEffect(() => {
    if (p.embedded && p.canSend && p.items.length && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [p.embedded, p.canSend, p.items.length]);
  const onTypingChangeRef = useRef(p.onTypingChange);
  onTypingChangeRef.current = p.onTypingChange;
  useEffect(() => {
    const stopTyping = () => onTypingChangeRef.current?.(false);
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') stopTyping();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', stopTyping);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', stopTyping);
      stopTyping();
    };
  }, []);

  const members = p.members ?? [];
  const timeline = (
    <section
      id="group-chat"
      className={`${s.panel} ${s.chat}`}
      style={
        p.embedded
          ? undefined
          : {
              height: 'calc(100dvh - 190px)',
              minHeight: 360,
              display: 'flex',
              flexDirection: 'column',
            }
      }
    >
      <div
        ref={timelineRef}
        className={s.timeline}
        role="log"
        aria-label="Group messages"
        aria-live="polite"
        style={!p.embedded ? { flex: 1, height: 'auto', minHeight: 0 } : undefined}
      >
        {p.loading && (
          <p className={s.muted} role="status">
            Loading saved messages…
          </p>
        )}
        {p.items.map((item) =>
          item.ai ? (
            <article key={item.id} className={s.message} aria-label="FinAI reply">
              <ThinkingOrb
                state={
                  item.ai.status === 'done' || item.ai.status === 'error'
                    ? 'idle'
                    : orbStateFor(item.ai)
                }
                size={38}
                paused={item.ai.status === 'done' || item.ai.status === 'error'}
              />
              <div className={s.messageCopy}>
                <div className={s.messageMeta}>
                  <strong>FinAI</strong>
                  <time>{item.date}</time>
                </div>
                <div className={s.bubble}>
                  {item.ai.status === 'error' ? (
                    <p>{finaiErrorMessage(item.ai.errorCode)}</p>
                  ) : item.text ? (
                    <p>{item.text}</p>
                  ) : (
                    <ThinkingOrb
                      state={orbStateFor(item.ai)}
                      size={18}
                      caption={item.ai.stageLabel ?? 'Thinking…'}
                      label="FinAI is working"
                    />
                  )}
                  <FinaiSurface
                    a2ui={item.ai.a2ui}
                    actions={item.ai.actions}
                    onDecide={p.onFinaiDecide}
                  />
                </div>
              </div>
            </article>
          ) : (
            <article
              key={item.id}
              className={`${s.message} ${item.ownMessage ? s.own : ''}`}
              aria-label={item.accessibleLabel}
            >
              {!item.ownMessage && (
                <PersonAvatar
                  name={item.sender ?? (item.kind === 'message' ? 'Member' : 'Group')}
                  url={item.senderAvatarUrl}
                  avatarId={item.senderAvatarId}
                  size={38}
                />
              )}
              <div className={s.messageCopy}>
                <div className={s.messageMeta}>
                  <strong>
                    {item.ownMessage
                      ? 'You'
                      : (item.sender ??
                        (item.kind === 'expense' ? 'Expense added' : 'Recorded settlement'))}
                  </strong>
                  <time>{item.date}</time>
                </div>
                <div className={s.bubble}>
                  {item.kind === 'message' ? (
                    <>
                      {!!item.text && <span>{item.text}</span>}
                      {item.audioUrl !== undefined && (
                        <VoiceBubble
                          src={item.audioUrl}
                          durationMs={item.durationMs}
                          mine={item.ownMessage}
                        />
                      )}
                      {item.attachmentUrl && (
                        <a href={item.attachmentUrl} target="_blank" rel="noreferrer">
                          <img
                            className={s.attachment}
                            src={item.attachmentUrl}
                            alt={`Bill shared by ${item.ownMessage ? 'you' : (item.sender ?? 'a member')}`}
                          />
                        </a>
                      )}
                      {!item.text && !item.attachmentUrl && item.audioUrl === undefined && (
                        <span className={s.muted}>Bill image is no longer available.</span>
                      )}
                    </>
                  ) : item.onPress ? (
                    <button type="button" className={s.expenseBubble} onClick={item.onPress}>
                      <Tile
                        icon={
                          item.icon ??
                          (item.kind === 'expense'
                            ? 'phosphor:Receipt'
                            : 'phosphor:ArrowsLeftRight')
                        }
                        color={item.color ?? tokens.warning}
                      />
                      <span className={s.activityCopy}>
                        <small>
                          {item.kind === 'expense' ? 'Expense added' : 'Settlement recorded'}
                        </small>
                        <span>{item.title}</span>
                        <strong>{item.amount}</strong>
                        <small>View ledger record →</small>
                      </span>
                    </button>
                  ) : (
                    <div className={s.expenseBubble}>
                      <Tile
                        icon={
                          item.icon ??
                          (item.kind === 'expense'
                            ? 'phosphor:Receipt'
                            : 'phosphor:ArrowsLeftRight')
                        }
                        color={item.color ?? tokens.warning}
                      />
                      <div className={s.activityCopy}>
                        <small>
                          {item.kind === 'expense' ? 'Expense added' : 'Settlement recorded'}
                        </small>
                        <span>{item.title}</span>
                        <strong>{item.amount}</strong>
                      </div>
                    </div>
                  )}
                </div>
                {item.ownMessage && !!item.readBy?.length && (
                  <small aria-label={`Seen by ${item.readBy.join(', ')}`}>
                    Seen by {item.readBy.join(', ')}
                  </small>
                )}
              </div>
            </article>
          ),
        )}
        {!!p.typingNames?.length && (
          <p className={s.muted} role="status">
            {p.typingNames.join(', ')} {p.typingNames.length === 1 ? 'is' : 'are'} typing…
          </p>
        )}
        {!p.loading && !p.error && !p.items.length && (
          <FinanceEmptyState
            kind="activity"
            title="Start the conversation"
            description="Share a note or attach a bill for the group."
          />
        )}
      </div>
      {p.canSend ? (
        <form
          onSubmit={(event) => (p.onSubmit ? p.onSubmit(event) : event.preventDefault())}
          className={s.composer}
          aria-describedby="group-chat-help"
        >
          <label className={s.upload} title="Attach bill image">
            <ImageIcon size={24} />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Attach bill image"
              disabled={p.pending}
              onChange={p.onUpload}
            />
          </label>
          <textarea
            aria-label="Group message"
            rows={1}
            value={p.draft}
            onChange={(event) => {
              const value = event.currentTarget.value;
              p.onDraftChange(value);
              p.onTypingChange?.(Boolean(value.trim()));
            }}
            onBlur={() => p.onTypingChange?.(false)}
            maxLength={4000}
            placeholder={`Message ${p.group?.name ?? 'the group'}…`}
            disabled={p.pending}
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={p.pending || !p.draft.trim()}
          >
            <PaperPlaneTilt size={23} />
          </Button>
        </form>
      ) : (
        <div className={s.panel}>
          <strong>{p.connected ? 'Chat is not synced yet' : 'Group chat is offline'}</strong>
          <p className={s.muted}>
            {p.connected
              ? 'Sync this saved group before sending messages or bill images.'
              : 'Connect to the internet to load and send messages. The group ledger remains available offline.'}
          </p>
        </div>
      )}
      <p className={s.chatHelp} id="group-chat-help">
        {p.pending
          ? 'Sending to the group…'
          : 'Messages and bill images save online and are not queued offline.'}{' '}
        {p.draft.length}/4,000
      </p>
      {p.error && (
        <p className={s.error} role="alert">
          {p.error}
        </p>
      )}
    </section>
  );

  if (p.embedded) return <GroupPage>{timeline}</GroupPage>;

  const typing = [...(p.typingNames ?? []), ...finaiTypingNames(p.items)];
  const subtitle = chatHeaderSubtitle({
    mode: 'group',
    typingNames: typing,
    memberCount: members.length,
    onlineCount: p.onlineCount,
  });
  const openDetails = p.onOpenSettings ?? p.onOpenGroup;
  return (
    <GroupPage>
      <div className={s.chatScreen} role="region" aria-label={`${p.group?.name ?? 'Group'} chat`}>
        <header className={s.chatHeader}>
          <button
            type="button"
            className={s.chatHeaderIcon}
            aria-label="Back"
            onClick={p.onBack ?? p.onOpenGroup}
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className={s.chatHeaderMain}
            aria-label={`${p.group?.name ?? 'Group'}, open group settings`}
            onClick={openDetails}
            disabled={!openDetails}
          >
            {p.group && <Tile icon={p.group.icon} color={p.group.color} />}
            <span className={s.chatHeaderCopy}>
              <strong>{p.group?.name ?? 'Group chat'}</strong>
              {subtitle ? (
                <small data-typing={typing.length ? '' : undefined}>{subtitle}</small>
              ) : null}
            </span>
          </button>
          {p.onAddExpense && (
            <button
              type="button"
              className={s.chatHeaderIcon}
              aria-label="Add expense"
              onClick={p.onAddExpense}
            >
              <Plus size={20} />
            </button>
          )}
        </header>
        <section id="group-chat" className={s.chatBody}>
          <ChatThread
            mode="group"
            messages={messages}
            loading={p.loading}
            canLoadOlder={p.canLoadOlder}
            loadingOlder={p.loadingOlder}
            onLoadOlder={p.onLoadOlder}
            firstUnreadId={p.firstUnreadId}
            typingNames={typing}
            renderAiContent={(message) => (
              <FinaiSurface
                a2ui={message.ai?.a2ui}
                actions={message.ai?.actions}
                onDecide={p.onFinaiDecide}
              />
            )}
            pinned={p.pinned}
            onTogglePin={p.onTogglePin}
            onReact={p.onReact}
            onRetry={p.onRetry}
            onDiscard={p.onDiscard}
            onSeenLatest={p.onSeenLatest}
            error={p.error}
            renderEvent={(message) => {
              const item = p.items.find((entry) => entry.id === message.id);
              return item ? <EventCard item={item} /> : null;
            }}
            emptyTitle="Start the conversation"
            emptyDescription="Share a note or attach a bill for the group."
            composer={
              p.canSend
                ? {
                    draft: p.draft,
                    onDraftChange: (value) => {
                      p.onDraftChange(value);
                      p.onTypingChange?.(Boolean(value.trim()));
                    },
                    onSend: () => p.onSend?.(),
                    onBlur: () => p.onTypingChange?.(false),
                    onAttachFile: p.onAttachFile,
                    onSendVoice: p.onSendVoice,
                    attachLabel: 'Attach bill image',
                    uploading: p.pending,
                    placeholder: `Message ${p.group?.name ?? 'the group'}… (@finai to ask FinAI)`,
                    mentions: [FINAI_MENTION],
                  }
                : undefined
            }
            footer={
              <div className={s.panel}>
                <strong>{p.connected ? 'Chat is not synced yet' : 'Group chat is offline'}</strong>
                <p className={s.muted}>
                  {p.connected
                    ? 'Sync this saved group before sending messages or bill images.'
                    : 'Connect to the internet to load and send messages. The group ledger remains available offline.'}
                </p>
              </div>
            }
          />
        </section>
      </div>
    </GroupPage>
  );
}
