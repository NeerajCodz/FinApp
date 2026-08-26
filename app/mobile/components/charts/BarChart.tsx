import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

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

export function InsightBars({
  items,
}: {
  items: readonly { label: string; value: number; amount: string; color?: string }[];
}) {
  const { tokens } = useTheme();
  const maximum = Math.max(...items.map((item) => item.value), 1);
  return (
    <View accessibilityLabel="Spending categories" style={{ gap: 20 }}>
      {items.map((item) => (
        <View key={item.label} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Typography variant="small" style={{ color: tokens.foreground }}>
              {item.label}
            </Typography>
            <Text style={{ fontVariant: ['tabular-nums'], fontFamily: 'SpaceGrotesk_500Medium' }}>
              {item.amount}
            </Text>
          </View>
          <View
            style={{
              height: 5,
              backgroundColor: tokens.borderSubtle,
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, (item.value / maximum) * 100))}%`,
                height: '100%',
                backgroundColor: item.color ?? tokens.foreground,
                borderRadius: 3,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
