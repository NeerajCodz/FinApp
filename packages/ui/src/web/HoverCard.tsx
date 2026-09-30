'use client';

import React from 'react';

export type HoverCardProps = {
  children: React.ReactNode;
  content: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
  triggerLabel?: string;
  className?: string;
};

/** Hover/focus details that stay in the local stacking context (no portal). */
export function HoverCard({
  children,
  content,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  label = 'Additional information',
  triggerLabel = 'Show additional information',
  className,
}: HoverCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const pointerInside = React.useRef(false);
  const focusInside = React.useRef(false);

  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    if (next !== open) onOpenChange?.(next);
  };
  const closeIfOutside = () => {
    if (!pointerInside.current && !focusInside.current) setOpen(false);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
    }
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(!open);
    }
  };

  return (
    <div
      className={className}
      onPointerEnter={() => {
        pointerInside.current = true;
        setOpen(true);
      }}
      onPointerLeave={() => {
        pointerInside.current = false;
        closeIfOutside();
      }}
      onFocus={() => {
        focusInside.current = true;
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          focusInside.current = false;
          closeIfOutside();
        }
      }}
      onKeyDown={onKeyDown}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {children}
      </div>
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: '100%',
            insetInlineStart: 0,
            minWidth: 220,
            maxWidth: 'min(360px, calc(100vw - 24px))',
            marginTop: 8,
            padding: 16,
            color: 'var(--finapp-popover-foreground, #ffffff)',
            background: 'var(--finapp-popover, #080808)',
            border: '1px solid var(--finapp-border, #ffffff1f)',
            borderRadius: 14,
            boxShadow: '0 16px 48px #00000080',
          }}
        >
          <button
            type="button"
            aria-label="Close additional information"
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              insetBlockStart: 6,
              insetInlineEnd: 8,
              border: 0,
              padding: '2px 6px',
              color: 'var(--finapp-foreground-muted, #ffffffa3)',
              background: 'transparent',
              font: 'inherit',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
          {content}
        </div>
      ) : null}
    </div>
  );
}
