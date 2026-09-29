'use client';

import React from 'react';

export type TableColumn<Row> = {
  key: keyof Row;
  header: React.ReactNode;
  render?: (row: Row) => React.ReactNode;
};

export type TableProps<Row> = {
  columns: TableColumn<Row>[];
  rows: Row[];
  emptyState?: React.ReactNode;
  rowKey?: keyof Row | ((row: Row, index: number) => React.Key);
  className?: string;
  style?: React.CSSProperties;
};

export function Table<Row extends Record<string, unknown>>({
  columns,
  rows,
  emptyState = 'No records found.',
  rowKey,
  className,
  style,
}: TableProps<Row>) {
  return (
    <div
      role="region"
      aria-label="Table"
      tabIndex={0}
      className={className}
      style={{
        maxWidth: '100%',
        overflowX: 'auto',
        border: '1px solid var(--finapp-border, #333)',
        borderRadius: 12,
        ...style,
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ background: 'var(--finapp-surface-subtle, #111)' }}>
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                style={{
                  padding: '0.8rem 1rem',
                  borderBottom: '1px solid var(--finapp-border-subtle, #333)',
                  color: 'var(--finapp-foreground-muted, #aaa)',
                  fontSize: '0.8rem',
                  fontWeight: 650,
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                style={{
                  padding: '1.25rem 1rem',
                  color: 'var(--finapp-foreground-muted, #aaa)',
                  textAlign: 'center',
                }}
              >
                {emptyState}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={
                  rowKey
                    ? typeof rowKey === 'function'
                      ? rowKey(row, index)
                      : String(row[rowKey])
                    : index
                }
              >
                {columns.map((column) => {
                  const value = row[column.key];
                  return (
                    <td
                      key={String(column.key)}
                      style={{
                        padding: '0.8rem 1rem',
                        borderBottom: '1px solid var(--finapp-border-subtle, #333)',
                        color: 'var(--finapp-foreground, #fff)',
                      }}
                    >
                      {column.render ? column.render(row) : String(value ?? '')}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
