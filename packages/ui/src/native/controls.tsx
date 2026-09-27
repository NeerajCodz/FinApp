import React from 'react';
import { Platform, Pressable, Switch as NativeSwitch, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { getTouchTargetStyle } from './touch-target';
import { useTheme } from './ThemeProvider';
import { Button } from './button';
import { Label } from './typography';
import { Text } from './typography';

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      activeOpacity={0.88}
      style={getTouchTargetStyle({ flexDirection: 'row', alignItems: 'center', gap: 10 })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: checked ? tokens.primary : tokens.border,
          backgroundColor: checked ? tokens.primary : tokens.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked && <Check size={15} strokeWidth={2.4} color={tokens.background} />}
      </View>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
}

export function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ selected: option.value === value }}
          onPress={() => onChange(option.value)}
          style={getTouchTargetStyle({ flexDirection: 'row', alignItems: 'center', gap: 10 })}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              borderWidth: 2,
              borderColor: option.value === value ? tokens.primary : tokens.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {option.value === value && (
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.primary }}
              />
            )}
          </View>
          <Text>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const Switch = ({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
}) => {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 56,
      }}
    >
      <Label
        style={{
          flex: 1,
          paddingRight: 16,
          marginBottom: 0,
          color: tokens.foreground,
        }}
      >
        {label}
      </Label>
      <View
        style={{
          width: 56,
          height: 44,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <NativeSwitch
          accessibilityLabel={label}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: tokens.border, true: tokens.primary }}
          thumbColor={value ? tokens.background : tokens.foregroundMuted}
          style={Platform.OS === 'android' ? { transform: [{ scale: 0.85 }] } : undefined}
        />
      </View>
    </View>
  );
};

export const Tabs = ({
  tabs,
  value,
  onChange,
}: {
  tabs: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) => {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: 12,
        backgroundColor: tokens.surfaceRaised,
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Button
            key={tab.value}
            size="sm"
            variant={selected ? 'primary' : 'ghost'}
            onPress={() => onChange(tab.value)}
            style={{ flex: 1, borderRadius: 10 }}
          >
            {tab.label}
          </Button>
        );
      })}
    </View>
  );
};

export const Select = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
}) => (
  <View>
    <Label>{label}</Label>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={option === value ? 'primary' : 'outline'}
          onPress={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </View>
  </View>
);

export function Slider({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="adjustable"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      onPress={() => onValueChange(value >= 100 ? 0 : value + 10)}
      style={{ height: 9, backgroundColor: tokens.muted, borderRadius: 5 }}
    >
      <View
        style={{
          width: `${value}%`,
          height: '100%',
          backgroundColor: tokens.primary,
          borderRadius: 5,
        }}
      />
    </Pressable>
  );
}
