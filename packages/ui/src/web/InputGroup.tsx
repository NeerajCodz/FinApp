'use client';

import React from 'react';
import type { InputHTMLAttributes } from 'react';

export type InputGroupProps = {
  children: React.ReactElement<InputHTMLAttributes<HTMLInputElement>>;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
};

export function InputGroup({
  children,
  leading,
  trailing,
  className,
  accessibilityLabel,
  disabled = false,
}: InputGroupProps) {
  const input = React.cloneElement(children, {
    disabled: disabled || children.props.disabled,
    style: {
      ...children.props.style,
      flex: '1 1 auto',
      minWidth: 0,
      minHeight: 52,
      border: 0,
      borderRadius: 0,
      background: 'transparent',
      boxShadow: 'none',
      outline: 'none',
    },
  });
  return (
    <div
      role="group"
      aria-label={accessibilityLabel}
      aria-disabled={disabled || undefined}
      className={['finapp-input-group', className].filter(Boolean).join(' ')}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        minWidth: 0,
        overflow: 'hidden',
        border: '1px solid var(--finapp-border)',
        borderRadius: 14,
        background: 'var(--finapp-input)',
        opacity: disabled ? 0.6 : undefined,
      }}
    >
      {leading != null && (
        <span
          className="finapp-input-group__leading"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            paddingInline: 14,
            color: 'var(--finapp-foreground-muted)',
            borderRight: '1px solid var(--finapp-border-subtle)',
          }}
        >
          {leading}
        </span>
      )}
      <div
        className="finapp-input-group__control"
        style={{ display: 'flex', flex: '1 1 auto', minWidth: 0, alignItems: 'center' }}
      >
        {input}
      </div>
      {trailing != null && (
        <span
          className="finapp-input-group__trailing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
            paddingInline: 14,
            color: 'var(--finapp-foreground-muted)',
            borderLeft: '1px solid var(--finapp-border-subtle)',
          }}
        >
          {trailing}
        </span>
      )}
    </div>
  );
}
