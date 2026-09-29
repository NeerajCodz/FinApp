'use client';

import React from 'react';

export type NavigationMenuItem = {
  value: string;
  label: React.ReactNode;
  href?: string;
  disabled?: boolean;
  children?: readonly NavigationMenuItem[];
};

export type NavigationMenuProps = {
  items: readonly NavigationMenuItem[];
  activeValue?: string;
  defaultActiveValue?: string;
  onActiveChange?: (value: string, item: NavigationMenuItem) => void;
  onNavigate?: (item: NavigationMenuItem, index: number) => void;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function NavigationMenu({
  items,
  activeValue,
  defaultActiveValue,
  onActiveChange,
  onNavigate,
  ariaLabel = 'Main navigation',
  className,
  style,
}: NavigationMenuProps) {
  const [uncontrolledActive, setUncontrolledActive] = React.useState(defaultActiveValue);
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => new Set());
  const active = activeValue ?? uncontrolledActive;

  const activate = (item: NavigationMenuItem, index: number) => {
    if (item.disabled) return;
    if (activeValue === undefined) setUncontrolledActive(item.value);
    onActiveChange?.(item.value, item);
    onNavigate?.(item, index);
  };

  const renderItems = (entries: readonly NavigationMenuItem[], depth = 0) => (
    <ul
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        listStyle: 'none',
        margin: 0,
        padding: depth === 0 ? 0 : '4px 0 4px 16px',
      }}
    >
      {entries.map((item, index) => {
        const selected = active === item.value;
        const hasChildren = !!item.children?.length;
        const isExpanded = expanded.has(item.value);
        return (
          <li key={item.value}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <a
                href={item.href ?? '#'}
                aria-current={selected ? 'page' : undefined}
                aria-disabled={item.disabled || undefined}
                onClick={(event) => {
                  if (item.disabled || !item.href) event.preventDefault();
                  if (!item.disabled) activate(item, index);
                }}
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  minHeight: 40,
                  boxSizing: 'border-box',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: `1px solid ${selected ? 'var(--finapp-border)' : 'transparent'}`,
                  background: selected ? 'var(--finapp-surface-raised)' : 'transparent',
                  color: item.disabled
                    ? 'var(--finapp-foreground-disabled)'
                    : selected
                      ? 'var(--finapp-foreground)'
                      : 'var(--finapp-foreground-muted)',
                  fontWeight: selected ? 600 : 500,
                  textDecoration: 'none',
                  opacity: item.disabled ? 0.65 : 1,
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {item.label}
              </a>
              {hasChildren && (
                <button
                  type="button"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${typeof item.label === 'string' ? item.label : 'submenu'}`}
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((previous) => {
                      const next = new Set(previous);
                      if (next.has(item.value)) next.delete(item.value);
                      else next.add(item.value);
                      return next;
                    })
                  }
                  style={{
                    minWidth: 40,
                    minHeight: 40,
                    border: 0,
                    borderRadius: 10,
                    background: 'transparent',
                    color: 'var(--finapp-foreground-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                </button>
              )}
            </div>
            {hasChildren && isExpanded && renderItems(item.children!, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label={ariaLabel} className={className} style={style}>
      {renderItems(items)}
    </nav>
  );
}
