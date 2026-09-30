import React from 'react';
import { Text } from 'react-native';
import { useTheme } from './ThemeProvider';

export type MarkerVariant =
  'default' | 'success' | 'warning' | 'destructive' | 'accent' | 'location';

export type MarkerProps = React.ComponentProps<typeof Text> & {
  variant?: MarkerVariant;
  children: React.ReactNode;
};

export function Marker({
  variant = 'default',
  children,
  style,
  accessibilityRole,
  ...props
}: MarkerProps) {
  const { tokens } = useTheme();
  const foreground = {
    default: tokens.foregroundMuted,
    success: tokens.positive,
    warning: tokens.warning,
    destructive: tokens.destructive,
    accent: tokens.accent,
    location: tokens.foreground,
  }[variant];
  const background =
    variant === 'default' || variant === 'location' ? tokens.surfaceRaised : `${foreground}1F`;
  const borderColor =
    variant === 'default' || variant === 'location' ? tokens.borderSubtle : `${foreground}52`;

  return (
    <Text
      {...props}
      accessibilityRole={accessibilityRole ?? (variant === 'location' ? 'text' : undefined)}
      style={[
        {
          alignSelf: 'flex-start',
          overflow: 'hidden',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderWidth: 1,
          borderColor,
          borderRadius: 999,
          backgroundColor: background,
          color: foreground,
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
