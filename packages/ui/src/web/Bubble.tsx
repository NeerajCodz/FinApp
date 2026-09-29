'use client';

import React from 'react';

export type BubbleAlignment = 'sent' | 'received';

export type BubbleProps = {
  children: React.ReactNode;
  alignment?: BubbleAlignment;
  author?: string;
  timestamp?: string | Date;
  className?: string;
  style?: React.CSSProperties;
};

function timestampText(timestamp: string | Date): string {
  return timestamp instanceof Date
    ? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : timestamp;
}

export function Bubble({
  children,
  alignment = 'received',
  author,
  timestamp,
  className,
  style,
}: BubbleProps) {
  const sent = alignment === 'sent';
  const timeLabel = timestamp === undefined ? undefined : timestampText(timestamp);
  const label = [
    typeof children === 'string' || typeof children === 'number' ? String(children) : undefined,
    author,
    timeLabel,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');

  return (
    <article
      aria-label={label || undefined}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignSelf: sent ? 'flex-end' : 'flex-start',
        alignItems: 'stretch',
        maxWidth: 'min(82%, 36rem)',
        padding: '0.65rem 0.8rem',
        border: '1px solid var(--finapp-border-subtle, rgba(255,255,255,.1))',
        borderRadius: sent ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
        color: sent
          ? 'var(--finapp-primary-foreground, #111)'
          : 'var(--finapp-foreground, #f5f5f5)',
        background: sent
          ? 'var(--finapp-primary, #b7ff4a)'
          : 'var(--finapp-surface-raised, #202020)',
        overflowWrap: 'anywhere',
        ...style,
      }}
    >
      {author ? (
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            lineHeight: 1.4,
            opacity: 0.78,
            marginBottom: '0.2rem',
          }}
        >
          {author}
        </span>
      ) : null}
      <div style={{ fontSize: '0.9rem', lineHeight: 1.45 }}>{children}</div>
      {timestamp !== undefined ? (
        <time
          dateTime={timestamp instanceof Date ? timestamp.toISOString() : undefined}
          style={{
            alignSelf: 'flex-end',
            marginTop: '0.3rem',
            fontSize: '0.7rem',
            lineHeight: 1.2,
            opacity: 0.68,
          }}
        >
          {timeLabel}
        </time>
      ) : null}
    </article>
  );
}
