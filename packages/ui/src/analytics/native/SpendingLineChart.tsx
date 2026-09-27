import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Typography, useTheme } from '@finapp/ui/native';

export function SpendingLineChart({
  values,
  labels = ['1 Aug', 'Today'],
}: {
  values: readonly number[];
  labels?: readonly [string, string];
}) {
  const { tokens } = useTheme();
  const width = 350;
  const height = 132;
  const inset = 8;
  const maximum = Math.max(...values, 1);
  const minimum = Math.min(...values, 0);
  const range = Math.max(maximum - minimum, 1);
  const points = values.map((value, index) => ({
    x: inset + (index / Math.max(values.length - 1, 1)) * (width - inset * 2),
    y: inset + ((maximum - value) / range) * (height - inset * 2),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const lastPoint = points.at(-1);

  return (
    <View accessibilityLabel="Monthly spending line chart" style={{ gap: 8 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0.25, 0.5, 0.75].map((position) => (
          <Line
            key={position}
            x1={0}
            x2={width}
            y1={height * position}
            y2={height * position}
            stroke={tokens.borderSubtle}
            strokeWidth={1}
          />
        ))}
        <Path
          d={path}
          fill="none"
          stroke={tokens.primary}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {lastPoint && (
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4}
            fill={tokens.background}
            stroke={tokens.primary}
            strokeWidth={2}
          />
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Typography variant="caption">{labels[0]}</Typography>
        <Typography variant="caption">{labels[1]}</Typography>
      </View>
    </View>
  );
}
