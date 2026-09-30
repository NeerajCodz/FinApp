'use client';

import React from 'react';

export type ContextMenuItem = {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

export type ContextMenuProps = {
  children: React.ReactNode;
  items: ContextMenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  menuLabel?: string;
};

export function ContextMenu({
  children,
  items,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  menuLabel = 'Context menu',
}: ContextMenuProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const rootRef = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const enabledIndices = items.flatMap((item, index) => (item.disabled ? [] : [index]));

  React.useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    first?.focus();
  }, [open]);

  const focusRelative = (currentIndex: number, direction: 1 | -1) => {
    if (!enabledIndices.length) return;
    const currentPosition = enabledIndices.indexOf(currentIndex);
    const nextPosition =
      currentPosition < 0
        ? direction === 1
          ? 0
          : enabledIndices.length - 1
        : (currentPosition + direction + enabledIndices.length) % enabledIndices.length;
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    buttons?.[nextPosition]?.focus();
  };
  const select = (item: ContextMenuItem) => {
    if (item.disabled) return;
    item.onSelect();
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={['finapp-context-menu', className].filter(Boolean).join(' ')}
      style={{ display: 'contents' }}
      onContextMenu={(event) => {
        event.preventDefault();
        setPosition({ x: event.clientX, y: event.clientY });
        setOpen(true);
      }}
      onKeyDown={(event) => {
        if (!open && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
          event.preventDefault();
          const target = event.target instanceof HTMLElement ? event.target : rootRef.current;
          const rect = target?.getBoundingClientRect();
          setPosition({ x: rect?.left ?? 0, y: rect?.bottom ?? 0 });
          setOpen(true);
        }
      }}
    >
      {children}
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={menuLabel}
          onKeyDown={(event) => {
            const target = event.target as HTMLButtonElement;
            const index = Number(target.dataset.menuIndex);
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              focusRelative(index, 1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              focusRelative(index, -1);
            } else if (event.key === 'Home') {
              event.preventDefault();
              focusRelative(-1, 1);
            } else if (event.key === 'End') {
              event.preventDefault();
              focusRelative(-1, -1);
            } else if (event.key === 'Tab') setOpen(false);
          }}
          style={{
            position: 'fixed',
            zIndex: 1000,
            top: position.y,
            left: position.x,
            minWidth: 176,
            maxWidth: 280,
            padding: 4,
            border: '1px solid var(--finapp-border)',
            borderRadius: 10,
            background: 'var(--finapp-popover)',
            boxShadow: '0 12px 32px #0006',
          }}
        >
          {items.map((item, index) => (
            <button
              key={`${item.label}-${index}`}
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-menu-index={index}
              disabled={item.disabled}
              onClick={() => select(item)}
              style={{
                display: 'block',
                width: '100%',
                padding: '9px 10px',
                border: 0,
                borderRadius: 7,
                background: 'transparent',
                color: item.destructive ? 'var(--finapp-destructive)' : 'var(--finapp-foreground)',
                textAlign: 'left',
                font: 'inherit',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
