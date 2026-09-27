'use client';

import React, { useId } from 'react';
import { Label } from './fields';
import { Typography } from './typography';

export function DropdownMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="group" className={['finapp-dropdown-menu', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function Calendar({
  label = 'Calendar',
  value,
  onChange,
  min,
  max,
  className,
}: {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={['finapp-field', 'finapp-calendar', className].filter(Boolean).join(' ')}>
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        className="finapp-input"
        type="date"
        value={value ?? ''}
        min={min}
        max={max}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      />
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = 18,
  className,
}: {
  width?: number | `${number}%`;
  height?: number;
  className?: string;
}) {
  return (
    <span
      className={['finapp-skeleton', className].filter(Boolean).join(' ')}
      role="status"
      aria-label="Loading"
      style={{ width, height }}
    />
  );
}

export function Empty({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={['finapp-empty', className].filter(Boolean).join(' ')}
      aria-label="Empty state"
    >
      {icon && (
        <div className="finapp-empty__icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <Typography variant="heading">{title}</Typography>
      {description && <p className="finapp-empty__description">{description}</p>}
      {action && <div className="finapp-empty__action">{action}</div>}
    </section>
  );
}

export function ScrollArea({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={['finapp-scroll-area', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label = 'Value',
  className,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <input
      className={['finapp-slider', className].filter(Boolean).join(' ')}
      aria-label={label}
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => onValueChange(Number(event.currentTarget.value))}
    />
  );
}
