'use client';

import React from 'react';

export type MarkerVariant =
  'default' | 'success' | 'warning' | 'destructive' | 'accent' | 'location';

export type MarkerProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: MarkerVariant;
  children: React.ReactNode;
};

const markerColors: Record<
  MarkerVariant,
  { foreground: string; background: string; border: string }
> = {
  default: {
    foreground: 'var(--finapp-foreground-muted)',
    background: 'var(--finapp-surface-raised, var(--finapp-card))',
    border: 'var(--finapp-border-subtle)',
  },
  success: {
    foreground: 'var(--finapp-positive)',
    background: 'color-mix(in srgb, var(--finapp-positive) 12%, transparent)',
    border: 'color-mix(in srgb, var(--finapp-positive) 30%, transparent)',
  },
  warning: {
    foreground: 'var(--finapp-warning)',
    background: 'color-mix(in srgb, var(--finapp-warning) 12%, transparent)',
    border: 'color-mix(in srgb, var(--finapp-warning) 30%, transparent)',
  },
  destructive: {
    foreground: 'var(--finapp-destructive)',
    background: 'color-mix(in srgb, var(--finapp-destructive) 12%, transparent)',
    border: 'color-mix(in srgb, var(--finapp-destructive) 30%, transparent)',
  },
  accent: {
    foreground: 'var(--finapp-accent)',
    background: 'color-mix(in srgb, var(--finapp-accent) 12%, transparent)',
    border: 'color-mix(in srgb, var(--finapp-accent) 30%, transparent)',
  },
  location: {
    foreground: 'var(--finapp-foreground)',
    background: 'var(--finapp-surface-raised, var(--finapp-card))',
    border: 'var(--finapp-border)',
  },
};

export function Marker({ variant = 'default', children, className, style, ...props }: MarkerProps) {
  const colors = markerColors[variant];
  return (
    <span
      role={props.role ?? (variant === 'location' ? 'note' : 'status')}
      {...props}
      className={['finapp-marker', `finapp-marker--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        maxWidth: '100%',
        padding: '0.16em 0.55em',
        border: `1px solid ${colors.border}`,
        borderRadius: 999,
        background: colors.background,
        color: colors.foreground,
        fontSize: '0.75rem',
        fontWeight: 600,
        lineHeight: 1.4,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
