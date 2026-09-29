'use client';

import React, { useMemo, useState } from 'react';

export type DataTableColumn<Row> = {
  key: keyof Row;
  header: string;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | null | undefined;
  render?: (row: Row) => React.ReactNode;
};

export type DataTableProps<Row> = {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
  rowKey?: keyof Row | ((row: Row, index: number) => React.Key);
  className?: string;
  style?: React.CSSProperties;
};

type SortState<Row> = { key: keyof Row; direction: 'ascending' | 'descending' };

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export function DataTable<Row>({
  columns,
  rows,
  emptyMessage = 'No records found.',
  rowKey,
  className,
  style,
}: DataTableProps<Row>) {
  const [sort, setSort] = useState<SortState<Row> | null>(null);
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find(({ key }) => key === sort.key);
    if (!column) return rows;
    const direction = sort.direction === 'ascending' ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const aValue = column.sortValue ? column.sortValue(a.row) : a.row[column.key];
        const bValue = column.sortValue ? column.sortValue(b.row) : b.row[column.key];
        return compareValues(aValue, bValue) * direction || a.index - b.index;
      })
      .map(({ row }) => row);
  }, [columns, rows, sort]);

  const toggleSort = (key: keyof Row) => {
    setSort((current) => ({
      key,
      direction:
        current?.key === key && current.direction === 'ascending' ? 'descending' : 'ascending',
    }));
  };

  return (
    <div
      className={className}
      role="region"
      aria-label="Data table"
      tabIndex={0}
      style={{
        maxWidth: '100%',
        overflowX: 'auto',
        color: 'var(--finapp-foreground, #fff)',
        border: '1px solid var(--finapp-border-subtle, rgba(255,255,255,.08))',
        borderRadius: '0.75rem',
        ...style,
      }}
    >
      <table
        style={{
          width: '100%',
          minWidth: 'max-content',
          borderCollapse: 'collapse',
          textAlign: 'left',
        }}
      >
        <thead style={{ background: 'var(--finapp-surface-subtle, rgba(255,255,255,.04))' }}>
          <tr>
            {columns.map((column) => {
              const activeSort = sort?.key === column.key;
              return (
                <th
                  key={String(column.key)}
                  scope="col"
                  aria-sort={activeSort ? sort.direction : column.sortable ? 'none' : undefined}
                  style={{
                    padding: '0.8rem 1rem',
                    borderBottom: '1px solid var(--finapp-border-subtle, rgba(255,255,255,.08))',
                    fontSize: '0.8rem',
                    fontWeight: 650,
                  }}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      style={{
                        padding: 0,
                        border: 0,
                        color: 'inherit',
                        background: 'transparent',
                        font: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      {column.header}
                      {activeSort ? (sort.direction === 'ascending' ? ' ▲' : ' ▼') : ' ↕'}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length ? (
            sortedRows.map((row, index) => {
              const key =
                typeof rowKey === 'function'
                  ? rowKey(row, index)
                  : rowKey
                    ? (row[rowKey] as React.Key)
                    : index;
              return (
                <tr key={key}>
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      style={{
                        padding: '0.8rem 1rem',
                        borderBottom:
                          '1px solid var(--finapp-border-subtle, rgba(255,255,255,.08))',
                      }}
                    >
                      {column.render ? column.render(row) : String(row[column.key] ?? '')}
                    </td>
                  ))}
                </tr>
              );
            })
          ) : (
            <tr>
              <td
                colSpan={Math.max(columns.length, 1)}
                style={{
                  padding: '1.25rem 1rem',
                  color: 'var(--finapp-foreground-muted, #aaa)',
                  textAlign: 'center',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
