'use client';

import React from 'react';

export type MenubarItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type MenubarProps = {
  items: MenubarItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Menubar({
  items,
  value: controlledValue,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  ariaLabel = 'Menu',
  className,
  style,
}: MenubarProps) {
  const enabledItems = items.filter((item) => !item.disabled);
  const initialValue = defaultValue ?? enabledItems[0]?.value ?? '';
  const [uncontrolledValue, setUncontrolledValue] = React.useState(initialValue);
  const value = controlledValue ?? uncontrolledValue;
  const activeValue = enabledItems.some((item) => item.value === value)
    ? value
    : enabledItems[0]?.value;
  const refs = React.useRef(new Map<string, HTMLButtonElement>());
  const horizontal = orientation === 'horizontal';

  const select = (nextValue: string) => {
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  };

  const moveFocus = (current: string, direction: 1 | -1) => {
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.findIndex((item) => item.value === current);
    const nextIndex =
      currentIndex < 0 ? 0 : (currentIndex + direction + enabledItems.length) % enabledItems.length;
    const next = enabledItems[nextIndex];
    if (!next) return;
    refs.current.get(next.value)?.focus();
    select(next.value);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={className}
      style={{
        display: 'inline-flex',
        flexDirection: horizontal ? 'row' : 'column',
        gap: 4,
        padding: 4,
        border: '1px solid var(--finapp-border, rgba(255,255,255,.14))',
        borderRadius: 14,
        background: 'var(--finapp-surface-subtle, #171717)',
        ...style,
      }}
    >
      {items.map((item) => {
        const selected = item.value === activeValue;
        return (
          <button
            key={item.value}
            ref={(node) => {
              if (node) refs.current.set(item.value, node);
              else refs.current.delete(item.value);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={item.disabled || undefined}
            tabIndex={selected && !item.disabled ? 0 : -1}
            disabled={item.disabled}
            onClick={() => select(item.value)}
            onKeyDown={(event) => {
              if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                const next =
                  event.key === 'Home' ? enabledItems[0] : enabledItems[enabledItems.length - 1];
                if (next) {
                  refs.current.get(next.value)?.focus();
                  select(next.value);
                }
              } else if (
                (horizontal && event.key === 'ArrowRight') ||
                (!horizontal && event.key === 'ArrowDown')
              ) {
                event.preventDefault();
                moveFocus(item.value, 1);
              } else if (
                (horizontal && event.key === 'ArrowLeft') ||
                (!horizontal && event.key === 'ArrowUp')
              ) {
                event.preventDefault();
                moveFocus(item.value, -1);
              } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                select(item.value);
              }
            }}
            style={{
              minHeight: 40,
              padding: '0.5rem 0.85rem',
              border: 0,
              borderRadius: 10,
              background: selected ? 'var(--finapp-primary)' : 'transparent',
              color: selected
                ? 'var(--finapp-primary-foreground, #101010)'
                : 'var(--finapp-foreground, #f5f5f5)',
              font: 'inherit',
              fontWeight: selected ? 650 : 500,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.45 : 1,
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
