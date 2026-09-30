import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type NativeSelectOption = { value: string; label: string; disabled?: boolean };

export type NativeSelectProps = {
  options: NativeSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function NativeSelect({
  options,
  value,
  onChange,
  label,
  disabled = false,
  style,
  accessibilityHint,
}: NativeSelectProps) {
  const { tokens } = useTheme();
  const [expanded, setExpanded] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={style}>
      <Text style={{ marginBottom: 6, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? (options.length ? 'Choose an option' : 'No options available')}`}
        accessibilityHint={accessibilityHint ?? 'Opens the available options'}
        accessibilityState={{ disabled, expanded }}
        disabled={disabled || options.length === 0}
        onPress={() => setExpanded((open) => !open)}
        style={({ pressed }) => ({
          minHeight: 48,
          paddingHorizontal: 13,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.input,
          opacity: disabled ? 0.55 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          ...(pressed ? { borderColor: tokens.primary } : {}),
        })}
      >
        <Text style={{ color: selected ? tokens.foreground : tokens.foregroundDisabled, flex: 1 }}>
          {selected?.label ?? (options.length ? 'Choose an option' : 'No options available')}
        </Text>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ color: tokens.foregroundMuted, marginLeft: 8 }}
        >
          {expanded ? '▲' : '▼'}
        </Text>
      </Pressable>
      {expanded && !disabled && options.length > 0 ? (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={`${label} options`}
          style={{
            marginTop: 6,
            padding: 4,
            gap: 2,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 12,
            backgroundColor: tokens.popover,
          }}
        >
          {options.map((option) => {
            const selectedOption = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selectedOption, disabled: Boolean(option.disabled) }}
                disabled={option.disabled}
                onPress={() => {
                  if (option.disabled) return;
                  onChange(option.value);
                  setExpanded(false);
                }}
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  justifyContent: 'center',
                  borderRadius: 8,
                  backgroundColor: pressed || selectedOption ? tokens.surfaceRaised : 'transparent',
                  opacity: option.disabled ? 0.45 : 1,
                })}
              >
                <Text style={{ color: selectedOption ? tokens.primary : tokens.foreground }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
