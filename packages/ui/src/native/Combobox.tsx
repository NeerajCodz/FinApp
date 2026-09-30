import React from 'react';
import {
  Pressable,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type ComboboxOption = { value: string; label: string; disabled?: boolean };

export type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  inputProps?: Pick<TextInputProps, 'autoCapitalize' | 'autoCorrect' | 'testID'>;
  noResultsText?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = 'Search options',
  disabled = false,
  style,
  inputProps,
  noResultsText = 'No results found',
}: ComboboxProps) {
  const { tokens } = useTheme();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <View style={style}>
      <Text style={{ marginBottom: 6, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        accessibilityHint="Type to filter options, then select a result below"
        accessibilityState={{ disabled }}
        editable={!disabled}
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder}
        placeholderTextColor={tokens.foregroundDisabled}
        selectionColor={tokens.primary}
        cursorColor={tokens.primary}
        onFocus={() => {
          if (!disabled) {
            setQuery('');
            setOpen(true);
          }
        }}
        onBlur={() => {
          setOpen(false);
          setQuery('');
        }}
        onChangeText={(text) => {
          setQuery(text);
          setOpen(true);
        }}
        style={{
          minHeight: 48,
          paddingHorizontal: 13,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.input,
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_400Regular',
          fontSize: 15,
          opacity: disabled ? 0.55 : 1,
        }}
      />
      {open && !disabled ? (
        <View
          accessibilityRole="list"
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
          {filtered.length ? (
            filtered.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{
                  disabled: Boolean(option.disabled),
                  selected: option.value === value,
                }}
                disabled={option.disabled}
                onPressIn={() => {
                  if (!option.disabled) {
                    onChange(option.value);
                    setQuery('');
                    setOpen(false);
                  }
                }}
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  justifyContent: 'center',
                  borderRadius: 8,
                  backgroundColor: pressed ? tokens.surfaceRaised : 'transparent',
                  opacity: option.disabled ? 0.45 : 1,
                })}
              >
                <Text
                  style={{ color: option.value === value ? tokens.primary : tokens.foreground }}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))
          ) : (
            <Text
              accessibilityLiveRegion="polite"
              style={{ padding: 10, color: tokens.foregroundDisabled }}
            >
              {noResultsText}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
