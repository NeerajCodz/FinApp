import React, { useState } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Button } from './button';

export type CarouselProps = {
  children: React.ReactNode;
  initialIndex?: number;
  index?: number;
  onIndexChange?: (index: number) => void;
  loop?: boolean;
  style?: ViewStyle;
  label?: string;
};

function normalizeIndex(index: number, count: number): number {
  if (count === 0 || !Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(index)));
}

export function Carousel({
  children,
  initialIndex = 0,
  index,
  onIndexChange,
  loop = false,
  style,
  label = 'Carousel',
}: CarouselProps) {
  const { tokens } = useTheme();
  const items = React.Children.toArray(children);
  const [uncontrolledIndex, setUncontrolledIndex] = useState(() =>
    normalizeIndex(initialIndex, items.length),
  );
  const currentIndex = normalizeIndex(
    index === undefined ? uncontrolledIndex : index,
    items.length,
  );
  const count = items.length;

  const move = (direction: -1 | 1) => {
    if (!count) return;
    const nextIndex = currentIndex + direction;
    const destination = loop ? (nextIndex + count) % count : normalizeIndex(nextIndex, count);
    if (destination === currentIndex) return;
    if (index === undefined) setUncontrolledIndex(destination);
    onIndexChange?.(destination);
  };

  return (
    <View style={style}>
      {count > 0 ? (
        <View
          accessibilityRole="adjustable"
          accessibilityLabel={`${label}, slide ${currentIndex + 1} of ${count}`}
          accessibilityValue={{ min: 1, max: count, now: currentIndex + 1 }}
        >
          {items[currentIndex]}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginTop: 10,
        }}
      >
        <Button
          accessibilityLabel="Previous slide"
          variant="outline"
          size="sm"
          disabled={count === 0 || (!loop && currentIndex === 0)}
          onPress={() => move(-1)}
        >
          Previous
        </Button>
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: tokens.foregroundMuted, fontSize: 12 }}
        >
          {count ? `${currentIndex + 1} / ${count}` : '0 / 0'}
        </Text>
        <Button
          accessibilityLabel="Next slide"
          variant="outline"
          size="sm"
          disabled={count === 0 || (!loop && currentIndex === count - 1)}
          onPress={() => move(1)}
        >
          Next
        </Button>
      </View>
    </View>
  );
}
