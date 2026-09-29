import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './typography';
import { useTheme } from './ThemeProvider';
import { layoutTokens } from '../tokens';

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
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function CellContent({ children }: { children: React.ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return <Text>{children}</Text>;
  }
  return <>{children}</>;
}

export function Table<Row extends Record<string, unknown>>({
  columns,
  rows,
  emptyState = 'No records found.',
  rowKey,
  accessibilityLabel = 'Table',
  style,
}: TableProps<Row>) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: layoutTokens.radiusControl,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', backgroundColor: tokens.surfaceSubtle }}>
        {columns.map((column) => (
          <View
            key={String(column.key)}
            accessibilityRole="header"
            style={{
              flex: 1,
              minWidth: 0,
              padding: 12,
              borderBottomWidth: 1,
              borderColor: tokens.borderSubtle,
            }}
          >
            <CellContent>{column.header}</CellContent>
          </View>
        ))}
      </View>
      {rows.length === 0 ? (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <CellContent>{emptyState}</CellContent>
        </View>
      ) : (
        rows.map((row, index) => (
          <View
            key={
              rowKey
                ? typeof rowKey === 'function'
                  ? rowKey(row, index)
                  : String(row[rowKey])
                : index
            }
            style={{
              flexDirection: 'row',
              backgroundColor: index % 2 === 1 ? tokens.surfaceSubtle : tokens.card,
            }}
          >
            {columns.map((column) => (
              <View
                key={String(column.key)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: 12,
                  borderBottomWidth: 1,
                  borderColor: tokens.borderSubtle,
                }}
              >
                <CellContent>
                  {column.render ? column.render(row) : String(row[column.key] ?? '')}
                </CellContent>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}
