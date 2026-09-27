import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export function Card({
  children,
  style,
  variant = 'default',
  ...props
}: ViewProps & { variant?: 'default' | 'subtle' | 'outline' }) {
  const { tokens } = useTheme();
  const backgroundColor =
    variant === 'outline'
      ? 'transparent'
      : variant === 'subtle'
        ? tokens.surfaceSubtle
        : tokens.card;
  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: 18,
          padding: 18,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: tokens.borderSubtle,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export const Popover = ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
  visible ? <Card>{children}</Card> : null;

export const Calendar = ({ label = 'Calendar' }: { label?: string }) => (
  <Card>
    <Text accessibilityRole="header">{label}</Text>
  </Card>
);
