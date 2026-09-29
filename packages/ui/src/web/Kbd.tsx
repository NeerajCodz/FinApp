'use client';

import React from 'react';

export type KbdProps = React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
};

export function Kbd({ children, className, style, ...props }: KbdProps) {
  return (
    <kbd
      {...props}
      className={['finapp-kbd', className].filter(Boolean).join(' ')}
      style={{
        display: 'inline-block',
        padding: '0.1em 0.42em',
        border: '1px solid var(--finapp-border)',
        borderBottomWidth: 2,
        borderRadius: 5,
        background: 'var(--finapp-surface-raised, var(--finapp-card))',
        color: 'var(--finapp-foreground)',
        fontFamily: 'inherit',
        fontSize: '0.82em',
        fontWeight: 600,
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}
