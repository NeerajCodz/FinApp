import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type MenubarItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type MenubarProps = {
  items: MenubarItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Menubar({
  items,
  value: controlledValue,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  accessibilityLabel = 'Menu',
  style,
}: MenubarProps) {
  const { tokens } = useTheme();
  const enabledItems = items.filter((item) => !item.disabled);
  const initialValue = defaultValue ?? enabledItems[0]?.value ?? '';
  const [uncontrolledValue, setUncontrolledValue] = React.useState(initialValue);
  const value = controlledValue ?? uncontrolledValue;
  const selectedIndex = items.findIndex((item) => item.value === value && !item.disabled);
  const activeValue = selectedIndex >= 0 ? value : enabledItems[0]?.value;
  const refs = React.useRef(new Map<string, React.ElementRef<typeof Pressable>>());
  const horizontal = orientation === 'horizontal';

  const select = (nextValue: string) => {
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  };
  const focusRelative = (current: string, direction: 1 | -1) => {
    if (enabledItems.length === 0) return;
    const currentIndex = enabledItems.findIndex((item) => item.value === current);
    const next =
      enabledItems[
        currentIndex < 0
          ? 0
          : (currentIndex + direction + enabledItems.length) % enabledItems.length
      ];
    if (!next) return;
    refs.current.get(next.value)?.focus();
    select(next.value);
  };

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: horizontal ? 'row' : 'column',
          gap: 4,
          padding: 4,
          borderWidth: 1,
          borderColor: tokens.border,
          borderRadius: 14,
          backgroundColor: tokens.surfaceSubtle,
        },
        style,
      ]}
    >
      {items.map((item) => {
        const selected = item.value === activeValue;
        return (
          <Pressable
            key={item.value}
            ref={(node) => {
              if (node) refs.current.set(item.value, node);
              else refs.current.delete(item.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected, disabled: Boolean(item.disabled) }}
            disabled={item.disabled}
            focusable={!item.disabled}
            onPress={() => select(item.value)}
            accessibilityActions={[
              { name: 'increment', label: 'Next menu item' },
              { name: 'decrement', label: 'Previous menu item' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'increment') focusRelative(item.value, 1);
              if (event.nativeEvent.actionName === 'decrement') focusRelative(item.value, -1);
            }}
            style={({ pressed }) => ({
              minHeight: 40,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: selected
                ? tokens.primary
                : pressed
                  ? tokens.surfaceRaised
                  : 'transparent',
              opacity: item.disabled ? 0.45 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? tokens.primaryForeground : tokens.foreground,
                fontSize: 14,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
