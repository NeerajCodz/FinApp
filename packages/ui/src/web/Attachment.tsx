'use client';

import React from 'react';

export type AttachmentState = 'ready' | 'uploading' | 'failed';

export type AttachmentProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'title'> & {
  name: string;
  mimeType?: string;
  sizeLabel?: string;
  state?: AttachmentState;
  /** Upload completion percentage, from 0 to 100. Invalid values are not rendered. */
  progress?: number;
  onOpen?: () => void;
  onRemove?: () => void;
};

const stateLabels: Record<AttachmentState, string> = {
  ready: 'Ready',
  uploading: 'Uploading',
  failed: 'Failed',
};

export function Attachment({
  name,
  mimeType,
  sizeLabel,
  state = 'ready',
  progress,
  onOpen,
  onRemove,
  className,
  style,
  ...props
}: AttachmentProps) {
  const safeProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.min(100, Math.max(0, progress))
      : undefined;
  const metadata = [mimeType, sizeLabel].filter(Boolean).join(' · ');

  return (
    <div
      {...props}
      role="group"
      aria-label={`Attachment: ${name}`}
      className={['finapp-attachment', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        padding: '12px 14px',
        color: 'var(--finapp-foreground)',
        background: 'var(--finapp-surface-raised, var(--finapp-card))',
        border: '1px solid var(--finapp-border-subtle)',
        borderRadius: 14,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{ display: 'inline-flex', flex: '0 0 auto', color: 'var(--finapp-primary)' }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M13 2v7h7M8 14h8M8 18h5" />
        </svg>
      </span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 14,
            fontWeight: 600,
          }}
          title={name}
        >
          {name}
        </div>
        {metadata ? (
          <div style={{ color: 'var(--finapp-foreground-muted)', fontSize: 12 }}>{metadata}</div>
        ) : null}
        <div
          role="status"
          aria-live="polite"
          style={{
            color:
              state === 'failed' ? 'var(--finapp-destructive)' : 'var(--finapp-foreground-muted)',
            fontSize: 12,
          }}
        >
          {stateLabels[state]}
        </div>
        {safeProgress !== undefined ? (
          <div
            role="progressbar"
            aria-label={`Upload progress for ${name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safeProgress}
            style={{
              height: 3,
              marginTop: 6,
              overflow: 'hidden',
              borderRadius: 3,
              background: 'var(--finapp-border)',
            }}
          >
            <div
              style={{
                width: `${safeProgress}%`,
                height: '100%',
                background: 'var(--finapp-primary)',
                transition: 'width 160ms ease-out',
              }}
            />
          </div>
        ) : null}
      </div>
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={`Open ${name}`} style={actionStyle}>
          Open
        </button>
      ) : null}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`} style={actionStyle}>
          Remove
        </button>
      ) : null}
    </div>
  );
}

const actionStyle: React.CSSProperties = {
  flex: '0 0 auto',
  padding: '6px 9px',
  color: 'var(--finapp-foreground)',
  font: 'inherit',
  fontSize: 12,
  background: 'transparent',
  border: '1px solid var(--finapp-border)',
  borderRadius: 8,
  cursor: 'pointer',
};
