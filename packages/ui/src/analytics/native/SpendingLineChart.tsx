import React, { useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Typography, useTheme } from '@finapp/ui/native';

type LinePoint = { value: number; axisLabel: string; detail: string; amount?: string };

export function SpendingLineChart({
  values,
  labels = ['1 Aug', 'Today'],
  xLabels,
  details,
  amounts,
}: {
  values: readonly number[];
  labels?: readonly [string, string];
  xLabels?: readonly string[];
  details?: readonly string[];
  amounts?: readonly string[];
}) {
  const { tokens } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const width = Math.max(screenWidth - 72, values.length * 42, 300);
  const height = 154;
  const inset = 9;
  const maximum = Math.max(...values, 0);
  const minimum = Math.min(...values, 0);
  const range = Math.max(maximum - minimum, 1);
  const data: LinePoint[] = values.map((value, index) => ({
    value,
    axisLabel:
      xLabels?.[index] ?? (index === 0 ? labels[0] : index === values.length - 1 ? labels[1] : ''),
    detail:
      details?.[index] ??
      (index === 0
        ? labels[0]
        : index === values.length - 1
          ? labels[1]
          : `Period ${index + 1} of ${values.length} · ${labels[0]} to ${labels[1]}`),
    amount: amounts?.[index],
  }));
  const points = values.map((value, index) => ({
    x: inset + (index / Math.max(values.length - 1, 1)) * (width - inset * 2),
    y: inset + ((maximum - value) / range) * (height - inset * 2),
  }));
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const dateFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }),
    [],
  );
  const selectedPoint = selected === null ? undefined : data[selected];

  if (!values.length) return null;
  const selectPoint = (point: LinePoint, index: number) => {
    const description = `${point.detail}: ${point.amount ?? dateFormatter.format(point.value)}`;
    setSelected(index);
    AccessibilityInfo.announceForAccessibility(description);
  };

  return (
    <View accessibilityLabel="Spending over time" style={{ gap: 8 }}>
      <ScrollView horizontal={values.length > 7} showsHorizontalScrollIndicator={false}>
        <View style={{ width, gap: 4 }}>
          <View style={{ height }}>
            <Svg
              width={width}
              height={height}
              viewBox={`0 0 ${width} ${height}`}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
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
              {points.map((point, index) => (
                <Circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r={selected === index ? 5 : 3}
                  fill={tokens.background}
                  stroke={tokens.primary}
                  strokeWidth={2}
                />
              ))}
            </Svg>
          </View>
          <View style={{ flexDirection: 'row', width, alignItems: 'stretch' }}>
            {data.map((point, index) => (
              <TouchableOpacity
                key={`${point.axisLabel}-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`${point.detail}: ${point.amount ?? dateFormatter.format(point.value)}`}
                accessibilityState={{ selected: selected === index }}
                onPress={() => selectPoint(point, index)}
                activeOpacity={0.65}
                style={{
                  width: width / data.length,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  variant="caption"
                  numberOfLines={1}
                  style={{
                    color: selected === index ? tokens.foreground : tokens.foregroundMuted,
                    fontSize: 10,
                  }}
                >
                  {point.axisLabel}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      {selectedPoint && (
        <Typography variant="small" accessibilityLiveRegion="polite">
          {selectedPoint.detail} ·{' '}
          {selectedPoint.amount ?? dateFormatter.format(selectedPoint.value)}
        </Typography>
      )}
    </View>
  );
}
