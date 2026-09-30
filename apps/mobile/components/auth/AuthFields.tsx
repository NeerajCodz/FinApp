import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ArrowRight } from '@finapp/ui/icons/native';
import { Button, Input, Label, Text, Typography, useTheme } from '@finapp/ui/native';

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const isIdentifier = (value: string) =>
  isEmail(value) || /^@?[a-z0-9_]{3,32}$/i.test(value.trim());

export function AuthError({ message }: { message?: string }) {
  const { tokens } = useTheme();
  if (!message) return null;
  return (
    <Typography
      variant="small"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: tokens.destructive }}
    >
      {message}
    </Typography>
  );
}

export function PasswordField({
  label = 'Password',
  error,
  newPassword = false,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'secureTextEntry' | 'error'> & {
  label?: string;
  error?: string;
  newPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label style={{ marginBottom: 0 }}>{label}</Label>
      <View>
        <Input
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          textContentType={newPassword ? 'newPassword' : 'password'}
          {...props}
          error={!!error}
          secureTextEntry={!visible}
          style={[props.style, { paddingRight: 82 }]}
        />
        <Button
          size="sm"
          variant="ghost"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((current) => !current)}
          style={{
            position: 'absolute',
            right: 4,
            top: 6,
            minWidth: 66,
            height: 44,
            minHeight: 44,
          }}
        >
          <Text
            style={{ color: tokens.primary, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13 }}
          >
            {visible ? 'Hide' : 'Show'}
          </Text>
        </Button>
      </View>
      <AuthError message={error} />
      {newPassword && !error && (
        <Typography variant="caption">At least 8 characters. Make it unique to Finapp.</Typography>
      )}
    </View>
  );
}

export function AuthSubmit({
  label,
  pending = false,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'children'> & { label: string; pending?: boolean }) {
  const { tokens } = useTheme();
  const disabled = pending || props.disabled;
  const color = disabled ? tokens.controlDisabledForeground : tokens.primaryForeground;
  return (
    <Button
      {...props}
      size="lg"
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityState={{ busy: pending, disabled: !!disabled }}
      style={[styles.submit, props.style]}
    >
      <Text style={{ color, flex: 1, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 16 }}>
        {label}
      </Text>
      <View style={[styles.arrow, { backgroundColor: '#00000012' }]}>
        {pending ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <ArrowRight size={19} color={color} />
        )}
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  submit: { borderRadius: 32, height: 60, minHeight: 60, paddingLeft: 24, paddingRight: 10 },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
