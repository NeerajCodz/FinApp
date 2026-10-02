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
  members?: readonly { id: string; name: string; username?: string; avatarId?: string; avatarUrl?: string | null }[];
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

  const members = p.members ?? [];
  const media = p.items.filter((item) => item.attachmentUrl);
  const timeline = (
    <section id="group-chat" className={`${s.panel} ${s.chat}`}>
      <div
        ref={timelineRef}
        className={s.timeline}
        role="log"
        aria-label="Group messages"
        aria-live="polite"
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
            </div>
          </article>
        ))}
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
            onChange={(event) => p.onDraftChange(event.currentTarget.value)}
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

  if (p.embedded || !p.group) return <GroupPage>{timeline}</GroupPage>;

  return (
    <GroupPage>
      <Crumb onBack={p.onOpenGroup ?? (() => {})} name={p.group.name} current="Chat" />
      <header className={s.hero}>
        <Tile large icon={p.group.icon} color={p.group.color} />
        <div className={s.heroCopy}>
          <h1>{p.group.name}</h1>
          <p className={s.subtitle}>Shared plans, expenses and receipts.</p>
          <p className={s.muted}>
            {members.length} members · {p.group.currency}
          </p>
        </div>
        <span className={s.avatars}>
          {members.slice(0, 6).map((member) => (
            <PersonAvatar key={member.id} name={member.name} url={member.avatarUrl} avatarId={member.avatarId} size={38} />
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
        </div>
      </header>
      <div className={s.columns}>
        {timeline}
        <aside className={s.stack}>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <h3>Group info</h3>
              {p.onOpenSettings && (
                <Button size="sm" variant="outline" onPress={p.onOpenSettings}>
                  Edit
                </Button>
              )}
            </div>
            <div className={s.tip}>
              <Tile icon={p.group.icon} color={p.group.color} />
              <div>
                <h3>{p.group.name}</h3>
                <p>{p.group.currency} · Shared ledger</p>
              </div>
            </div>
            <p className={s.muted}>Only saved group records and messages appear here.</p>
          </section>
          <section className={s.panel}>
            <h3>Members ({members.length})</h3>
            {members.map((member) => (
              <div className={s.member} key={member.id}>
                <PersonAvatar name={member.name} url={member.avatarUrl} avatarId={member.avatarId} />
                <span className={s.activityCopy}>{member.name}</span>
                <span className={s.badge}>Member</span>
              </div>
            ))}
            {!members.length && <p className={s.muted}>Membership is not cached yet.</p>}
            <p className={s.muted}>Live presence and read receipts are not available.</p>
          </section>
          <section className={s.panel}>
            <h3>Balances &amp; settlements</h3>
            <p className={s.muted}>
              Open the group to see complete member balances and record payments.
            </p>
            {p.onOpenGroup && (
              <Button size="sm" variant="outline" onPress={p.onOpenGroup}>
                View balances →
              </Button>
            )}
          </section>
          <section className={s.panel}>
            <h3>Shared media &amp; receipts</h3>
            {p.loading ? (
              <p className={s.muted} role="status">
                Loading shared images…
              </p>
            ) : p.error ? null : media.length ? (
              <div className={s.media}>
                {media.map((item) => (
                  <a key={item.id} href={item.attachmentUrl!} target="_blank" rel="noreferrer">
                    <img
                      src={item.attachmentUrl!}
                      alt={`Receipt shared by ${item.sender ?? 'a member'}`}
                    />
                  </a>
                ))}
              </div>
            ) : (
              <FinanceEmptyState
                kind="activity"
                compact
                title="No shared images yet"
                description="Bills and receipts shared in chat will collect here."
              />
            )}
          </section>
        </aside>
      </div>
    </GroupPage>
  );
}
