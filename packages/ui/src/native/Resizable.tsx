import React from 'react';
import {
  PanResponder,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';

export type ResizableOrientation = 'horizontal' | 'vertical';
export type ResizableProps = {
  children: readonly [React.ReactNode, React.ReactNode];
  orientation?: ResizableOrientation;
  initialSize?: number;
  minSize?: number;
  maxSize?: number;
  step?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Resizable({
  children,
  orientation = 'horizontal',
  initialSize = 50,
  minSize = 15,
  maxSize = 85,
  step = 3,
  accessibilityLabel = 'Resize panels',
  style,
}: ResizableProps) {
  const { tokens } = useTheme();
  const [size, setSize] = React.useState(Math.min(maxSize, Math.max(minSize, initialSize)));
  const [extent, setExtent] = React.useState(0);
  const startSize = React.useRef(size);
  const sizeRef = React.useRef(size);
  sizeRef.current = size;
  const horizontal = orientation === 'horizontal';
  const update = (value: number) => setSize(Math.min(maxSize, Math.max(minSize, value)));
  const onLayout = (event: LayoutChangeEvent) =>
    setExtent(horizontal ? event.nativeEvent.layout.width : event.nativeEvent.layout.height);
  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startSize.current = sizeRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          if (!extent) return;
          const next = startSize.current + ((horizontal ? gesture.dx : gesture.dy) / extent) * 100;
          setSize(Math.min(maxSize, Math.max(minSize, next)));
        },
      }),
    [extent, horizontal, maxSize, minSize],
  );
  const adjust = (direction: number) => update(size + direction * step);
  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          flexDirection: horizontal ? 'row' : 'column',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          [horizontal ? 'width' : 'height']: `${size}%`,
          minWidth: horizontal ? 0 : undefined,
          minHeight: horizontal ? undefined : 0,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {children[0]}
      </View>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{
          min: minSize,
          max: maxSize,
          now: Math.round(size),
          text: `${Math.round(size)}%`,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Expand first panel' },
          { name: 'decrement', label: 'Shrink first panel' },
        ]}
        onAccessibilityAction={(event) =>
          adjust(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
        style={{
          [horizontal ? 'width' : 'height']: 28,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.surfaceSubtle,
        }}
      >
        <View
          style={{
            [horizontal ? 'width' : 'height']: 4,
            [horizontal ? 'height' : 'width']: '45%',
            minHeight: horizontal ? 28 : undefined,
            minWidth: horizontal ? undefined : 28,
            borderRadius: 3,
            backgroundColor: tokens.border,
          }}
        />
        <View
          style={{ position: 'absolute', flexDirection: horizontal ? 'column' : 'row', gap: 2 }}
        >
          <Text
            onPress={() => adjust(-1)}
            accessibilityRole="button"
            accessibilityLabel="Shrink first panel"
            style={{ color: tokens.foregroundMuted, fontSize: 10 }}
          >
            −
          </Text>
          <Text
            onPress={() => adjust(1)}
            accessibilityRole="button"
            accessibilityLabel="Expand first panel"
            style={{ color: tokens.foregroundMuted, fontSize: 10 }}
          >
            +
          </Text>
        </View>
      </View>
      <View
        style={{
          flex: 1,
          minWidth: horizontal ? 0 : undefined,
          minHeight: horizontal ? undefined : 0,
          overflow: 'hidden',
        }}
      >
        {children[1]}
      </View>
    </View>
  );
}
