import React, { useState } from 'react';
import { View } from 'react-native';
import { Eye, EyeOff } from '@finapp/ui/icons/native';
import { Button } from './button';
import { Input } from './input';
import { Label, Typography } from './typography';
import { useTheme } from './ThemeProvider';

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
          style={[props.style, { paddingRight: 54 }]}
        />
        <Button
          size="sm"
          variant="ghost"
          accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((current) => !current)}
          disabled={props.editable === false}
          style={{
            position: 'absolute',
            right: 4,
            top: 6,
            minWidth: 44,
            height: 44,
            minHeight: 44,
          }}
        >
          {visible ? (
            <EyeOff size={18} color={tokens.primary} />
          ) : (
            <Eye size={18} color={tokens.primary} />
          )}
        </Button>
      </View>
      {error ? (
        <Typography variant="small" style={{ color: tokens.destructive }}>
          {error}
        </Typography>
      ) : null}
      {newPassword && !error ? (
        <Typography variant="caption">At least 8 characters. Make it unique to Finapp.</Typography>
      ) : null}
    </View>
  );
}
