import React, { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export function Input({
  style,
  onFocus,
  onBlur,
  error = false,
  ...props
}: TextInputProps & { error?: boolean }) {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={tokens.foregroundDisabled}
      selectionColor={tokens.primary}
      cursorColor={tokens.primary}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        {
          minHeight: 56,
          borderWidth: 1,
          borderColor: error ? tokens.destructive : focused ? tokens.ring : tokens.borderSubtle,
          borderRadius: 14,
          paddingHorizontal: 16,
          color: tokens.foreground,
          backgroundColor: focused ? tokens.surfaceRaised : tokens.input,
          fontFamily: 'SpaceGrotesk_400Regular',
          fontSize: 15,
          lineHeight: 22,
        },
        style,
      ]}
      {...props}
    />
  );
}

export const Textarea = (props: TextInputProps) => (
  <Input
    multiline
    textAlignVertical="top"
    {...props}
    style={[{ minHeight: 100, paddingTop: 14 }, props.style]}
  />
);

export const Command = ({ onSubmit }: { onSubmit?: (text: string) => void }) => (
  <Input
    accessibilityLabel="Search commands"
    placeholder="Search"
    onSubmitEditing={(e) => onSubmit?.(e.nativeEvent.text)}
  />
);

export function InputOTP({
  value,
  onChangeText,
  length = 6,
}: {
  value: string;
  onChangeText: (v: string) => void;
  length?: number;
}) {
  const { tokens } = useTheme();
  const inputRef = React.useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const cells = Array.from({ length }, (_, index) => value[index] ?? '');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Enter six-digit verification code"
      onPress={() => inputRef.current?.focus()}
      style={{ position: 'relative' }}
    >
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}>
        {cells.map((character, index) => {
          const active = focused && index === Math.min(value.length, length - 1);
          return (
            <View
              key={index}
              style={{
                width: 48,
                height: 56,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? tokens.ring : tokens.borderSubtle,
                backgroundColor: active ? tokens.surfaceRaised : tokens.surfaceSubtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontFamily: 'SpaceGrotesk_600SemiBold',
                  fontSize: 22,
                  lineHeight: 28,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {character}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        accessibilityLabel="One-time password"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      />
    </Pressable>
  );
}
