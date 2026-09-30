import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, type ViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';
import { layoutTokens } from '../tokens';

export type DataTableColumn<Row> = {
  key: keyof Row;
  header: string;
  sortable?: boolean;
  sortValue?: (row: Row) => string | number | null | undefined;
  render?: (row: Row) => React.ReactNode;
};

export type DataTableProps<Row> = Omit<ViewProps, 'children'> & {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
  rowKey?: keyof Row | ((row: Row, index: number) => React.Key);
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
  style,
  accessibilityLabel,
  ...props
}: DataTableProps<Row>) {
  const { tokens } = useTheme();
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
    <View
      {...props}
      accessibilityLabel={accessibilityLabel ?? 'Data table'}
      style={[
        {
          borderColor: tokens.borderSubtle,
          borderWidth: 1,
          borderRadius: layoutTokens.radiusControl,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel="Scrollable table">
        <View>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: tokens.surfaceSubtle,
              borderBottomWidth: 1,
              borderBottomColor: tokens.borderSubtle,
            }}
          >
            {columns.map((column) => (
              <View
                key={String(column.key)}
                accessibilityRole="header"
                style={{ width: 152, paddingVertical: 12, paddingHorizontal: 14 }}
              >
                {column.sortable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${column.header}`}
                    accessibilityHint={
                      sort?.key === column.key
                        ? `Currently sorted ${sort.direction}`
                        : 'Sort table rows by this column'
                    }
                    accessibilityState={{ selected: sort?.key === column.key }}
                    onPress={() => toggleSort(column.key)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                  >
                    <Text style={{ color: tokens.foreground, fontSize: 13, fontWeight: '700' }}>
                      {column.header}
                      {sort?.key === column.key
                        ? sort.direction === 'ascending'
                          ? ' ▲'
                          : ' ▼'
                        : ' ↕'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    accessibilityRole="header"
                    style={{ color: tokens.foreground, fontSize: 13, fontWeight: '700' }}
                  >
                    {column.header}
                  </Text>
                )}
              </View>
            ))}
          </View>
          {sortedRows.length ? (
            sortedRows.map((row, index) => {
              const key =
                typeof rowKey === 'function'
                  ? rowKey(row, index)
                  : rowKey
                    ? (row[rowKey] as React.Key)
                    : index;
              return (
                <View
                  key={key}
                  style={{
                    flexDirection: 'row',
                    borderBottomWidth: index === sortedRows.length - 1 ? 0 : 1,
                    borderBottomColor: tokens.borderSubtle,
                  }}
                >
                  {columns.map((column) => (
                    <View
                      key={String(column.key)}
                      style={{
                        width: 152,
                        minHeight: 46,
                        justifyContent: 'center',
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                      }}
                    >
                      {column.render ? (
                        column.render(row)
                      ) : (
                        <Text style={{ color: tokens.foreground }}>
                          {String(row[column.key] ?? '')}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              );
            })
          ) : (
            <Text accessibilityRole="text" style={{ color: tokens.foregroundMuted, padding: 16 }}>
              {emptyMessage}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
