'use client';

import React from 'react';

export type BreadcrumbItem = {
  label: React.ReactNode;
  href?: string;
  current?: boolean;
};

export type BreadcrumbProps = {
  items: readonly BreadcrumbItem[];
  onNavigate?: (item: BreadcrumbItem, index: number) => void;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Breadcrumb({
  items,
  onNavigate,
  label = 'Breadcrumb',
  className,
  style,
}: BreadcrumbProps) {
  const currentIndex = items.findIndex((item) => item.current);
  return (
    <nav aria-label={label} className={className} style={style}>
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {items.map((item, index) => {
          const current = item.current ?? (currentIndex < 0 && index === items.length - 1);
          const navigable = !current && (!!item.href || !!onNavigate);
          const content = navigable ? (
            <a
              href={item.href ?? '#'}
              onClick={(event) => {
                if (!item.href) event.preventDefault();
                onNavigate?.(item, index);
              }}
              style={{
                color: 'var(--finapp-foreground-muted)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {item.label}
            </a>
          ) : (
            <span
              aria-current={current ? 'page' : undefined}
              style={{
                color: current ? 'var(--finapp-foreground)' : 'var(--finapp-foreground-muted)',
                fontWeight: current ? 600 : 400,
              }}
            >
              {item.label}
            </span>
          );
          return (
            <li key={`${index}-${item.href ?? ''}`} style={{ display: 'contents' }}>
              {index > 0 && (
                <span aria-hidden="true" style={{ color: 'var(--finapp-foreground-subtle)' }}>
                  /
                </span>
              )}
              {content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
