import React from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';
import { layoutTokens } from '../tokens';

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type ChartProps = Omit<ViewProps, 'children'> & {
  data: ChartDataPoint[];
  title?: string;
  valueFormatter?: (value: number) => string;
};

export function Chart({
  data,
  title,
  valueFormatter = (value) => String(value),
  style,
  accessibilityLabel,
  ...props
}: ChartProps) {
  const { tokens } = useTheme();
  const maxValue = data.reduce((max, { value }) => Math.max(max, value), 0);

  return (
    <View
      {...props}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? title ?? 'Bar chart'}
      style={[
        {
          padding: 16,
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.borderSubtle,
          borderWidth: 1,
          borderRadius: layoutTokens.radiusControl,
        },
        style,
      ]}
    >
      {title ? (
        <Text
          accessibilityRole="header"
          style={{ color: tokens.foreground, fontSize: 16, fontWeight: '700', marginBottom: 14 }}
        >
          {title}
        </Text>
      ) : null}
      {data.length ? (
        data.map(({ label, value }, index) => {
          const width =
            `${maxValue === 0 ? 0 : Math.max(0, (value / maxValue) * 100)}%` as `${number}%`;
          return (
            <View
              key={`${label}-${index}`}
              accessible
              accessibilityLabel={`${label}, ${valueFormatter(value)}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: index === data.length - 1 ? 0 : 12,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: tokens.foreground, width: 88, marginRight: 10, fontSize: 13 }}
              >
                {label}
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 10,
                  overflow: 'hidden',
                  backgroundColor: tokens.surfaceRaised,
                  borderRadius: 8,
                }}
              >
                <View
                  style={{
                    width,
                    height: '100%',
                    backgroundColor: tokens.primary,
                    borderRadius: 8,
                  }}
                />
              </View>
              <Text
                style={{
                  color: tokens.foreground,
                  minWidth: 52,
                  marginLeft: 10,
                  textAlign: 'right',
                  fontSize: 13,
                }}
              >
                {valueFormatter(value)}
              </Text>
            </View>
          );
        })
      ) : (
        <Text style={{ color: tokens.foregroundMuted }}>No data to display.</Text>
      )}
    </View>
  );
}
