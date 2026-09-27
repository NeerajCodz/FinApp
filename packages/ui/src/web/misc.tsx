'use client';

import React, { useId, useState } from 'react';
import { Button } from './button';
import { Input } from './fields';

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={['finapp-collapsible', className].filter(Boolean).join(' ')}
      open={defaultOpen || undefined}
    >
      <summary>{title}</summary>
      <div className="finapp-collapsible__content">{children}</div>
    </details>
  );
}

export function Accordion(props: React.ComponentProps<typeof Collapsible>) {
  return (
    <Collapsible
      {...props}
      className={['finapp-accordion', props.className].filter(Boolean).join(' ')}
    />
  );
}

export function Command({
  onSubmit,
  placeholder = 'Search commands',
  className,
}: {
  onSubmit?: (text: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  return (
    <form
      role="search"
      className={['finapp-command', className].filter(Boolean).join(' ')}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(query);
      }}
    >
      <Input
        aria-label="Search commands"
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}

export function Toast({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={['finapp-toast', className].filter(Boolean).join(' ')}
    >
      {message}
    </div>
  );
}

export function Toggle({
  pressed,
  onPressedChange,
  children,
  className,
  disabled = false,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Button
      variant={pressed ? 'primary' : 'outline'}
      aria-pressed={pressed}
      disabled={disabled}
      onPress={() => onPressedChange(!pressed)}
      className={className}
    >
      {children}
    </Button>
  );
}

export function View({
  as: Component = 'div',
  className,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  accessibilityLabel?: string;
  accessibilityRole?: React.AriaRole;
  accessibilityHint?: string;
}) {
  return (
    <Component
      className={className}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-description={accessibilityHint}
      {...props}
    />
  );
}

export function Tooltip({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className={['finapp-tooltip', className].filter(Boolean).join(' ')}
      aria-describedby={id}
      data-open={open || undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
      <span id={id} role="tooltip" className="finapp-tooltip__content">
        {label}
      </span>
    </span>
  );
}
