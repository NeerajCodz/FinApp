import React, { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type ToggleGroupOption = {
  value: string;
  label: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
};

type ToggleGroupBaseProps = {
  options: ToggleGroupOption[];
  label: string;
  minSelected?: number;
  maxSelected?: number;
  style?: StyleProp<ViewStyle>;
};

export type SingleToggleGroupProps = ToggleGroupBaseProps & {
  type: 'single';
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
};

export type MultipleToggleGroupProps = ToggleGroupBaseProps & {
  type: 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
};

export type ToggleGroupProps = SingleToggleGroupProps | MultipleToggleGroupProps;

export function ToggleGroup(props: ToggleGroupProps) {
  const { tokens } = useTheme();
  const [internalValue, setInternalValue] = useState<string | string[] | undefined>(
    props.defaultValue ?? (props.type === 'single' ? undefined : []),
  );
  const controlled = Object.prototype.hasOwnProperty.call(props, 'value');
  const selected: string[] =
    props.type === 'multiple'
      ? controlled
        ? ((props.value as string[] | undefined) ?? [])
        : (internalValue as string[])
      : controlled
        ? props.value
          ? [props.value as string]
          : []
        : internalValue
          ? [internalValue as string]
          : [];
  const update = (next: string[]) => {
    if (!controlled) setInternalValue(props.type === 'multiple' ? next : next[0]);
    if (props.type === 'multiple') props.onValueChange?.(next);
    else props.onValueChange?.(next[0]);
  };
  const activate = (value: string) => {
    const option = props.options.find((item) => item.value === value);
    if (!option || option.disabled) return;
    const next =
      props.type === 'single'
        ? selected.includes(value)
          ? []
          : [value]
        : selected.includes(value)
          ? selected.filter((item) => item !== value)
          : [...selected, value];
    const min = props.minSelected ?? 0;
    const max = props.maxSelected ?? (props.type === 'single' ? 1 : props.options.length);
    if (next.length < min || next.length > max) return;
    update(next);
  };

  return (
    <View
      accessibilityRole={props.type === 'single' ? 'radiogroup' : 'toolbar'}
      accessibilityLabel={props.label}
      style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, props.style]}
    >
      {props.options.map((option) => {
        const isSelected = selected.includes(option.value);
        const foreground = isSelected ? tokens.primaryForeground : tokens.foreground;
        return (
          <Pressable
            key={option.value}
            accessibilityRole={props.type === 'single' ? 'radio' : 'button'}
            accessibilityLabel={
              option.accessibilityLabel ??
              (typeof option.label === 'string' ? option.label : option.value)
            }
            accessibilityState={{
              selected: isSelected,
              checked: props.type === 'single' ? isSelected : undefined,
              disabled: Boolean(option.disabled),
            }}
            disabled={option.disabled}
            onPress={() => activate(option.value)}
            style={({ pressed }) => ({
              minHeight: 40,
              paddingHorizontal: 14,
              paddingVertical: 9,
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: isSelected ? tokens.primary : tokens.border,
              borderRadius: 999,
              backgroundColor: isSelected ? tokens.primary : tokens.surfaceSubtle,
              opacity: option.disabled ? 0.5 : pressed ? 0.75 : 1,
            })}
          >
            {typeof option.label === 'string' || typeof option.label === 'number' ? (
              <Text style={{ color: foreground, fontWeight: '600' }}>{option.label}</Text>
            ) : (
              option.label
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
