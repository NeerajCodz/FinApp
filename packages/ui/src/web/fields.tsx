'use client';

import React from 'react';
import { Typography } from './typography';

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  error?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onChangeText?: (value: string) => void;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
};

export function Input({
  error = false,
  className,
  onChange,
  onChangeText,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  'aria-label': ariaLabel,
  role,
  'aria-description': ariaDescription,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange?.(event);
    onChangeText?.(event.currentTarget.value);
  };
  return (
    <input
      {...props}
      onChange={handleChange}
      role={accessibilityRole ?? role}
      aria-label={accessibilityLabel ?? ariaLabel}
      aria-description={accessibilityHint ?? ariaDescription}
      aria-invalid={ariaInvalid ?? (error || undefined)}
      className={['finapp-input', error && 'is-error', className].filter(Boolean).join(' ')}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={['finapp-label', className].filter(Boolean).join(' ')} {...props} />;
}

export function Badge({
  children,
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'success' | 'danger' | 'neutral';
}) {
  return (
    <span
      {...props}
      className={['finapp-badge', `finapp-badge--${variant}`, className].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  label,
  size = 42,
  className,
}: {
  initials: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label ?? initials}
      className={['finapp-avatar', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={['finapp-section-header', className].filter(Boolean).join(' ')}>
      <Typography variant="heading">{title}</Typography>
      {action}
    </header>
  );
}

export function Separator(props: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr {...props} className={['finapp-separator', props.className].filter(Boolean).join(' ')} />
  );
}

export function Progress({
  value,
  color,
  height = 6,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: number; color?: string; height?: number }) {
  const normalized = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div
      {...props}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={normalized}
      className={['finapp-progress', className].filter(Boolean).join(' ')}
      style={{ height, ...props.style }}
    >
      <span
        className="finapp-progress__fill"
        style={{ width: `${normalized}%`, backgroundColor: color ?? 'var(--finapp-foreground)' }}
      />
    </div>
  );
}
