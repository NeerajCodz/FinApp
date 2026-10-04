'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from '@finapp/ui/web';
import { Image as ImageIcon, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { FinanceEmptyState } from './FinanceEmptyState';
import { GroupPage, Crumb, Tile, PersonAvatar, s } from './GroupUI';

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
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
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
};

export function GroupChatScreen(p: GroupChatScreenProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (p.canSend && p.items.length && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [p.canSend, p.items.length]);
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
        {p.items.map((item) => (
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
                    {item.text && <p>{item.text}</p>}
                    {item.attachmentUrl && (
                      <a href={item.attachmentUrl} target="_blank" rel="noreferrer">
                        <img
                          className={s.attachment}
                          src={item.attachmentUrl}
                          alt={`Bill shared by ${item.ownMessage ? 'you' : (item.sender ?? 'a member')}`}
                        />
                      </a>
                    )}
                    {!item.text && !item.attachmentUrl && (
                      <span className={s.muted}>Bill image is no longer available.</span>
                    )}
                  </>
                ) : item.onPress ? (
                  <button type="button" className={s.expenseBubble} onClick={item.onPress}>
                    <Tile
                      icon={
                        item.icon ??
                        (item.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight')
                      }
                      color={item.color ?? '#f4cd63'}
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
                        (item.kind === 'expense' ? 'phosphor:Receipt' : 'phosphor:ArrowsLeftRight')
                      }
                      color={item.color ?? '#f4cd63'}
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
        ))}
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
        <form onSubmit={p.onSubmit} className={s.composer} aria-describedby="group-chat-help">
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

  return (
    <GroupPage>
      <Crumb
        onBack={p.onBack ?? p.onOpenGroup ?? (() => {})}
        name={p.group?.name ?? 'Group'}
        current="Chat"
      />
      <header className={s.hero}>
        {p.group && <Tile large icon={p.group.icon} color={p.group.color} />}
        <div className={s.heroCopy}>
          <h1>{p.group?.name ?? 'Group chat'}</h1>
          <p className={s.subtitle}>Messages, activity and shared receipts.</p>
          <p className={s.muted}>
            {members.length} members{p.group?.currency ? ` · ${p.group.currency}` : ''}
          </p>
        </div>
        <span className={s.avatars}>
          {members.slice(0, 6).map((member) => (
            <PersonAvatar
              key={member.id}
              name={member.name}
              url={member.avatarUrl}
              avatarId={member.avatarId}
              size={38}
            />
          ))}
        </span>
        <div className={s.actions}>
          {p.onOpenGroup && (
            <Button variant="outline" onPress={p.onOpenGroup}>
              View group
            </Button>
          )}
          {p.onAddExpense && (
            <Button onPress={p.onAddExpense}>
              <Plus size={17} /> Add expense
            </Button>
          )}
          {p.onOpenSettings && (
            <Button variant="outline" onPress={p.onOpenSettings}>
              Edit group
            </Button>
          )}
        </div>
      </header>
      {timeline}
    </GroupPage>
  );
}
