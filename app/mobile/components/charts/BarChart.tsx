import React from 'react';
import { View } from 'react-native';

export function BarChart({ values }: { values: readonly number[] }) {
  const maximum = Math.max(...values, 1);
  return (
    <View
      accessibilityLabel="Spending bar chart"
      style={{ height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 16 }}
    >
      {values.map((value, index) => (
        <View
          key={`${index}-${value}`}
          accessibilityLabel={`${value}`}
          style={{
            flex: 1,
            height: `${Math.max(4, (value / maximum) * 100)}%`,
            backgroundColor: '#315CFF',
            borderRadius: 6,
          }}
        />
      ))}
    </View>
  );
}
