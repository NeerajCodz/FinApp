'use client';

import React from 'react';

export type MessageType = 'chat' | 'system' | 'success' | 'warning' | 'error';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageProps = {
  children?: React.ReactNode;
  text?: string;
  author?: string;
  timestamp?: string | Date;
  status?: MessageStatus;
  type?: MessageType;
  className?: string;
  style?: React.CSSProperties;
};

const statusLabels: Record<MessageStatus, string> = {
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

const typeColors: Record<MessageType, string> = {
  chat: 'var(--finapp-border-subtle, rgba(255,255,255,.12))',
  system: 'var(--finapp-border, rgba(255,255,255,.2))',
  success: 'var(--finapp-positive, #7fd45c)',
  warning: 'var(--finapp-warning, #f2bd42)',
  error: 'var(--finapp-destructive, #ff5c5c)',
};

function timestampText(timestamp: string | Date): string {
  return timestamp instanceof Date
    ? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : timestamp;
}

export function Message({
  children,
  text,
  author,
  timestamp,
  status,
  type = 'chat',
  className,
  style,
}: MessageProps) {
  const timeLabel = timestamp === undefined ? undefined : timestampText(timestamp);
  const content = children ?? text;

  return (
    <article
      aria-label={
        [
          type === 'chat' ? undefined : type,
          author,
          timeLabel,
          status ? statusLabels[status] : undefined,
        ]
          .filter(Boolean)
          .join(', ') || undefined
      }
      className={className}
      data-message-type={type}
      data-message-status={status}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        maxWidth: 'min(100%, 42rem)',
        padding: '0.75rem 0.9rem',
        border: `1px solid ${typeColors[type]}`,
        borderRadius: 12,
        background:
          type === 'system'
            ? 'var(--finapp-surface-subtle, #171717)'
            : 'var(--finapp-surface-raised, #202020)',
        color: 'var(--finapp-foreground, #f5f5f5)',
        overflowWrap: 'anywhere',
        ...style,
      }}
    >
      {author ? (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 650,
            color: 'var(--finapp-foreground-muted, #aaa)',
          }}
        >
          {author}
        </span>
      ) : null}
      {type !== 'chat' ? (
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 650,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: typeColors[type],
          }}
        >
          {type}
        </span>
      ) : null}
      {content !== undefined && content !== null ? (
        <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{content}</div>
      ) : null}
      {timestamp !== undefined || status ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 2,
            color: 'var(--finapp-foreground-muted, #aaa)',
            fontSize: '0.7rem',
          }}
        >
          {timestamp !== undefined ? (
            <time dateTime={timestamp instanceof Date ? timestamp.toISOString() : undefined}>
              {timeLabel}
            </time>
          ) : null}
          {status ? (
            <span aria-label={`Message ${statusLabels[status].toLowerCase()}`}>
              {statusLabels[status]}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
