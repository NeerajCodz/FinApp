'use client';

import React from 'react';
import { Typography } from './typography';

export type AlertVariant = 'default' | 'success' | 'warning' | 'destructive';

type AlertProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: AlertVariant;
  onDismiss?: () => void;
};

const variantColor: Record<AlertVariant, string> = {
  default: 'var(--finapp-primary)',
  success: 'var(--finapp-positive)',
  warning: 'var(--finapp-warning)',
  destructive: 'var(--finapp-destructive)',
};

export function Alert({
  title,
  description,
  icon,
  action,
  variant = 'default',
  onDismiss,
  className,
  role,
  style,
  ...props
}: AlertProps) {
  return (
    <div
      {...props}
      role={role ?? (variant === 'destructive' || variant === 'warning' ? 'alert' : 'status')}
      aria-live={variant === 'destructive' || variant === 'warning' ? 'assertive' : 'polite'}
      className={['finapp-alert', className].filter(Boolean).join(' ')}
      style={{ ...style, '--finapp-alert-accent': variantColor[variant] } as React.CSSProperties}
    >
      {icon ? (
        <span className="finapp-alert__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="finapp-alert__body">
        {title ? (
          <Typography variant="small" className="finapp-alert__title">
            {title}
          </Typography>
        ) : null}
        {description ? <Typography variant="caption">{description}</Typography> : null}
      </div>
      {action ? <div className="finapp-alert__action">{action}</div> : null}
      {onDismiss ? (
        <button
          className="finapp-alert__dismiss"
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
