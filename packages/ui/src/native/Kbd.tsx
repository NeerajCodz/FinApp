import React from 'react';
import { Text } from 'react-native';
import { useTheme } from './ThemeProvider';

export type KbdProps = React.ComponentProps<typeof Text> & {
  children: React.ReactNode;
};

export function Kbd({ children, style, accessibilityRole, ...props }: KbdProps) {
  const { tokens } = useTheme();
  return (
    <Text
      {...props}
      accessibilityRole={accessibilityRole ?? 'text'}
      style={[
        {
          overflow: 'hidden',
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderWidth: 1,
          borderColor: tokens.border,
          borderBottomWidth: 2,
          borderRadius: 5,
          backgroundColor: tokens.surfaceRaised,
          color: tokens.foreground,
          fontSize: 12,
          fontWeight: '600',
          lineHeight: 17,
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
