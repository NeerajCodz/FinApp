'use client';

import React, { useEffect, useRef } from 'react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';

export type GroupChatItem = {
  id: string;
  kind: 'message' | 'expense' | 'settlement';
  date: string;
  accessibleLabel: string;
  sender?: string;
  ownMessage?: boolean;
  text?: string;
  attachmentUrl?: string | null;
  title?: string;
  amount?: string;
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
};

export function GroupChatScreen({
  items,
  loading,
  canSend,
  connected,
  draft,
  pending,
  error,
  onDraftChange,
  onSubmit,
  onUpload,
}: GroupChatScreenProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (canSend && items.length && timelineRef.current)
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
  }, [canSend, items.length]);
  return (
    <Card id="group-chat" className="finance-record-panel">
      <SectionHeader title="Group chat" />
      <p id="group-chat-help" className="finance-muted">
        Messages and bill images are saved to this group when you are online. They are not queued
        for offline sending.
      </p>
      {canSend ? (
        <>
          <div
            ref={timelineRef}
            role="log"
            aria-live="polite"
            aria-label="Group messages"
            style={{
              display: 'grid',
              gap: 10,
              minHeight: 180,
              maxHeight: 440,
              overflowY: 'auto',
              padding: 14,
              border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
              borderRadius: 16,
              background: 'var(--finance-surface, rgba(127,127,127,.1))',
            }}
          >
            {loading && (
              <p className="finance-muted" role="status">
                Loading saved messages…
              </p>
            )}
            {items.map((item) =>
              item.kind === 'message' ? (
                <article
                  key={item.id}
                  aria-label={item.accessibleLabel}
                  style={{
                    display: 'grid',
                    justifySelf: item.ownMessage ? 'end' : 'start',
                    width: 'fit-content',
                    maxWidth: 'min(88%, 560px)',
                    gap: 6,
                    padding: '10px 13px',
                    border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
                    borderRadius: item.ownMessage ? '16px 16px 5px 16px' : '16px 16px 16px 5px',
                    background: item.ownMessage
                      ? 'var(--finance-accent-subtle, rgba(190,255,0,.12))'
                      : 'var(--finance-surface, rgba(127,127,127,.1))',
                    overflowWrap: 'anywhere',
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{item.ownMessage ? 'You' : item.sender}</strong>
                  {item.attachmentUrl ? (
                    <a
                      href={item.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open bill shared by ${item.ownMessage ? 'you' : item.sender}`}
                    >
                      <img
                        src={item.attachmentUrl}
                        alt={`Bill shared by ${item.ownMessage ? 'you' : item.sender}`}
                        style={{
                          display: 'block',
                          maxWidth: '100%',
                          maxHeight: 320,
                          borderRadius: 10,
                          objectFit: 'contain',
                        }}
                      />
                    </a>
                  ) : item.text ? (
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {item.text}
                    </p>
                  ) : (
                    <p className="finance-muted" style={{ margin: 0 }}>
                      Bill image is no longer available.
                    </p>
                  )}
                  <time className="finance-muted" style={{ fontSize: 12 }}>
                    {item.date}
                  </time>
                </article>
              ) : (
                <article
                  key={item.id}
                  aria-label={item.accessibleLabel}
                  style={{
                    display: 'grid',
                    justifySelf: 'center',
                    width: 'min(100%, 540px)',
                    gap: 5,
                    padding: '11px 14px',
                    border: '1px solid var(--finance-border, rgba(127,127,127,.16))',
                    borderLeft: `3px solid var(--finapp-${item.kind})`,
                    borderRadius: 12,
                    background: 'var(--finance-surface-raised, rgba(127,127,127,.08))',
                  }}
                >
                  <strong style={{ fontSize: 12 }}>
                    {item.kind === 'expense' ? 'Shared expense · Split' : 'Settlement'}
                  </strong>
                  <span>{item.title}</span>
                  <strong>{item.amount}</strong>
                  <time className="finance-muted" style={{ fontSize: 12 }}>
                    {item.date}
                  </time>
                </article>
              ),
            )}
            {!loading && items.length === 0 && (
              <div
                style={{
                  alignSelf: 'center',
                  justifySelf: 'center',
                  padding: '18px 8px',
                  textAlign: 'center',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 5 }}>
                  Start the conversation
                </strong>
                <span className="finance-muted">Share a note or attach a bill for the group.</span>
              </div>
            )}
          </div>
          <form className="finance-form" onSubmit={onSubmit} aria-describedby="group-chat-help">
            <textarea
              aria-label="Group message"
              value={draft}
              onChange={(event) => onDraftChange(event.currentTarget.value)}
              maxLength={4_000}
              rows={3}
              placeholder="Write a message…"
              disabled={pending}
              style={{ resize: 'vertical', minHeight: 84 }}
            />
            <div className="finance-page-actions">
              <label className="finance-secondary-action">
                Attach bill image
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Attach bill image"
                  disabled={pending}
                  onChange={onUpload}
                />
              </label>
              <Button type="submit" disabled={pending || !draft.trim()}>
                {pending ? 'Sending…' : 'Send message'}
              </Button>
            </div>
            <p className="finance-muted" aria-live="polite">
              {pending ? 'Sending to the group…' : `${draft.length}/4,000 characters`}
            </p>
          </form>
        </>
      ) : (
        <div
          style={{
            padding: 16,
            border: '1px solid var(--finance-border, rgba(127,127,127,.2))',
            borderRadius: 14,
          }}
        >
          <strong>{connected ? 'Chat is not synced yet' : 'Group chat is offline'}</strong>
          <p className="finance-muted" style={{ marginBottom: 0 }}>
            {connected
              ? 'This saved group has no connected cloud ID. Sync the group before using server chat or sharing bill images.'
              : 'Connect to the internet to load saved messages or send a message and bill image. Group ledger data remains available offline.'}
          </p>
        </div>
      )}
      {!!error && (
        <p className="finance-form-error" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
