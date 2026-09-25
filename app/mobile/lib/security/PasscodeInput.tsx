import React from 'react';
import { TextInput } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';

export function PasscodeInput({ value, onChangeText, label }: {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
}) {
  const { tokens } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, 6))}
      accessibilityLabel={label}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      placeholder="Six-digit passcode"
      placeholderTextColor={tokens.foregroundMuted}
      style={{
        minHeight: 52,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        borderRadius: 12,
        paddingHorizontal: 16,
        color: tokens.foreground,
        fontSize: 20,
        letterSpacing: 5,
      }}
    />
  );
}
