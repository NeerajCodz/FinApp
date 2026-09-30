'use client';

import React from 'react';

export type ItemProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  className?: string;
  accessibilityLabel?: string;
};

export function Item({
  title,
  description,
  leading,
  trailing,
  onPress,
  disabled = false,
  className,
  accessibilityLabel,
}: ItemProps) {
  const content = (
    <>
      {leading != null && (
        <span
          className="finapp-item__leading"
          aria-hidden="true"
          style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        >
          {leading}
        </span>
      )}
      <span
        className="finapp-item__body"
        style={{
          display: 'flex',
          flex: '1 1 auto',
          minWidth: 0,
          flexDirection: 'column',
          gap: 2,
          textAlign: 'left',
        }}
      >
        <span
          className="finapp-item__title"
          style={{ color: 'var(--finapp-foreground)', fontWeight: 500 }}
        >
          {title}
        </span>
        {description != null && (
          <span
            className="finapp-item__description"
            style={{ color: 'var(--finapp-foreground-muted)', fontSize: 14 }}
          >
            {description}
          </span>
        )}
      </span>
      {trailing != null && (
        <span
          className="finapp-item__trailing"
          style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        >
          {trailing}
        </span>
      )}
    </>
  );
  const style: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    minWidth: 0,
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    border: 0,
    borderBottom: '1px solid var(--finapp-border-subtle)',
    borderRadius: 0,
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
    opacity: disabled ? 0.55 : undefined,
    cursor: onPress && !disabled ? 'pointer' : undefined,
  };
  const classNames = [
    'finapp-item',
    onPress && 'finapp-item--interactive',
    disabled && 'is-disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onPress) {
    return (
      <button
        type="button"
        className={classNames}
        style={style}
        onClick={onPress}
        disabled={disabled}
        aria-label={accessibilityLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={classNames} style={style} aria-label={accessibilityLabel}>
      {content}
    </div>
  );
}
