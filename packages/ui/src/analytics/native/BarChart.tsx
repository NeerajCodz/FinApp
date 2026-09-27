import React from 'react';
import { View } from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';

export function BarChart({
  values,
  labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  highlightIndex,
}: {
  values: readonly number[];
  labels?: readonly string[];
  highlightIndex?: number;
}) {
  const maximum = Math.max(...values, 1);
  const { tokens } = useTheme();
  return (
    <View accessibilityLabel="Spending bar chart" style={{ gap: 10 }}>
      <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        {values.map((value, index) => {
          const highlighted = index === highlightIndex;
          return (
            <View
              key={`${labels[index] ?? index}-${index}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height: `${Math.max(4, (value / maximum) * 100)}%`,
                  borderRadius: 5,
                  backgroundColor: highlighted ? tokens.primary : tokens.foreground,
                  opacity: highlighted ? 1 : 0.72,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {values.map((_, index) => (
          <Typography
            key={`${labels[index] ?? index}-${index}`}
            variant="caption"
            style={{ flex: 1, textAlign: 'center' }}
          >
            {labels[index] ?? ''}
          </Typography>
        ))}
      </View>
    </View>
  );
}
