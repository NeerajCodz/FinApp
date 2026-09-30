import React, { useState } from 'react';
import {
  AccessibilityInfo,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Typography, useTheme } from '@finapp/ui/native';

type BarPoint = { label: string; value: number; amount?: string; detail?: string };

export function BarChart({
  values,
  labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  highlightIndex,
  details,
  amounts,
  orientation = 'vertical',
}: {
  values: readonly number[];
  labels?: readonly string[];
  highlightIndex?: number;
  details?: readonly string[];
  amounts?: readonly string[];
  orientation?: 'vertical' | 'horizontal';
}) {
  const { tokens } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [selected, setSelected] = useState<number | null>(null);
  const horizontal = orientation === 'horizontal';
  const data: BarPoint[] = values.map((value, index) => ({
    label: labels[index] ?? `Period ${index + 1}`,
    value,
    amount: amounts?.[index],
    detail: details?.[index],
  }));
  const maximum = Math.max(...values.map((value) => Math.max(0, value)), 1);
  const chartWidth = Math.max(screenWidth - 72, values.length * 40, 300);
  const selectedPoint = selected === null ? undefined : data[selected];

  if (!values.length) return null;
  const selectPoint = (point: BarPoint, index: number) => {
    const description = `${point.detail ?? point.label}: ${point.amount ?? point.value}`;
    setSelected(index);
    AccessibilityInfo.announceForAccessibility(description);
  };

  if (horizontal) {
    return (
      <View accessibilityLabel="Spending category bars" style={{ gap: 8 }}>
        {data.map((point, index) => (
          <TouchableOpacity
            key={`${point.label}-${index}`}
            accessibilityRole="button"
            accessibilityLabel={`${point.label}: ${point.detail ? `${point.detail}, ` : ''}${point.amount ?? `${point.value}%`}`}
            accessibilityState={{ selected: selected === index || highlightIndex === index }}
            onPress={() => selectPoint(point, index)}
            activeOpacity={0.65}
            style={{ minHeight: 48, justifyContent: 'center', gap: 7 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Typography variant="small" numberOfLines={1} style={{ flex: 1 }}>
                {point.label}
              </Typography>
              <Typography variant="caption" style={{ color: tokens.foregroundMuted }}>
                {point.amount ?? `${point.value}%`}
              </Typography>
            </View>
            <View
              style={{
                height: 6,
                overflow: 'hidden',
                borderRadius: 4,
                backgroundColor: tokens.borderSubtle,
              }}
            >
              <View
                style={{
                  width: `${Math.max(0, Math.min(100, (point.value / maximum) * 100))}%`,
                  height: '100%',
                  borderRadius: 4,
                  backgroundColor:
                    selected === index || highlightIndex === index
                      ? tokens.primary
                      : tokens.foreground,
                }}
              />
            </View>
          </TouchableOpacity>
        ))}
        {selectedPoint && (
          <Typography variant="small" accessibilityLiveRegion="polite">
            {selectedPoint.detail ?? selectedPoint.label} ·{' '}
            {selectedPoint.amount ?? `${selectedPoint.value}%`}
          </Typography>
        )}
      </View>
    );
  }

  const contentWidth: number | '100%' = values.length > 7 ? chartWidth : '100%';
  const itemWidth = values.length > 7 ? chartWidth / values.length : undefined;
  return (
    <View accessibilityLabel="Spending bar chart">
      <ScrollView horizontal={values.length > 7} showsHorizontalScrollIndicator={false}>
        <View style={{ width: contentWidth, minWidth: 300 }}>
          <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            {data.map((point, index) => {
              const highlighted = index === highlightIndex || index === selected;
              return (
                <TouchableOpacity
                  key={`${point.label}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${point.detail ?? point.label}: ${point.amount ?? `${point.value}%`}`}
                  accessibilityState={{ selected: highlighted }}
                  onPress={() => selectPoint(point, index)}
                  activeOpacity={0.65}
                  style={{
                    flex: itemWidth ? undefined : 1,
                    width: itemWidth,
                    height: '100%',
                    justifyContent: 'flex-end',
                    alignItems: 'stretch',
                  }}
                >
                  <View
                    style={{
                      height: `${Math.max(point.value > 0 ? 2 : 0, Math.min(100, (point.value / maximum) * 100))}%`,
                      borderRadius: 5,
                      backgroundColor: highlighted ? tokens.primary : tokens.foreground,
                      opacity: highlighted ? 1 : 0.72,
                    }}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {data.map((point, index) => (
              <Typography
                key={`${point.label}-${index}`}
                variant="caption"
                numberOfLines={1}
                style={{
                  flex: itemWidth ? undefined : 1,
                  width: itemWidth,
                  textAlign: 'center',
                  color: index === selected ? tokens.foreground : tokens.foregroundMuted,
                  fontSize: 10,
                }}
              >
                {point.label}
              </Typography>
            ))}
          </View>
        </View>
      </ScrollView>
      {selectedPoint && (
        <Typography variant="small" accessibilityLiveRegion="polite" style={{ marginTop: 8 }}>
          {selectedPoint.detail ?? selectedPoint.label} ·{' '}
          {selectedPoint.amount ?? `${selectedPoint.value}%`}
        </Typography>
      )}
    </View>
  );
}
