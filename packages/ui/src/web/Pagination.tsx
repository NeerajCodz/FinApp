'use client';

import React from 'react';

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  ariaLabel = 'Pagination',
  className,
  style,
}: PaginationProps) {
  const pageCount = Number.isFinite(totalPages) ? Math.max(0, Math.floor(totalPages)) : 0;
  const requestedPage = Number.isFinite(currentPage) ? Math.floor(currentPage) : 1;
  const page = pageCount === 0 ? 0 : Math.min(pageCount, Math.max(1, requestedPage));
  const previousDisabled = page <= 1;
  const nextDisabled = pageCount === 0 || page >= pageCount;
  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 40,
    minHeight: 40,
    padding: '0 10px',
    border: '1px solid var(--finapp-border)',
    borderRadius: 10,
    background: 'var(--finapp-surface-subtle)',
    color: 'var(--finapp-foreground)',
    font: 'inherit',
    cursor: 'pointer',
  };
  const disabledStyle: React.CSSProperties = {
    color: 'var(--finapp-foreground-disabled)',
    background: 'var(--finapp-surface-subtle)',
    cursor: 'not-allowed',
    opacity: 0.6,
  };

  return (
    <nav aria-label={ariaLabel} className={className} style={style}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <button
          type="button"
          aria-label="Previous page"
          disabled={previousDisabled}
          onClick={() => onPageChange(page - 1)}
          style={{ ...buttonStyle, ...(previousDisabled ? disabledStyle : {}) }}
        >
          Previous
        </button>
        {Array.from({ length: pageCount }, (_, index) => {
          const pageNumber = index + 1;
          const selected = pageNumber === page;
          return (
            <button
              key={pageNumber}
              type="button"
              aria-label={`Page ${pageNumber}`}
              aria-current={selected ? 'page' : undefined}
              onClick={() => {
                if (!selected) onPageChange(pageNumber);
              }}
              style={{
                ...buttonStyle,
                ...(selected
                  ? {
                      borderColor: 'var(--finapp-primary)',
                      background: 'var(--finapp-primary)',
                      color: 'var(--finapp-primary-foreground)',
                      fontWeight: 600,
                    }
                  : {}),
              }}
            >
              {pageNumber}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Next page"
          disabled={nextDisabled}
          onClick={() => onPageChange(page + 1)}
          style={{ ...buttonStyle, ...(nextDisabled ? disabledStyle : {}) }}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
