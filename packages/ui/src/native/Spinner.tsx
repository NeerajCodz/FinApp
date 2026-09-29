import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type SpinnerProps = {
  size?: number | 'small' | 'large';
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Spinner({ size = 'small', label = 'Loading', style }: SpinnerProps) {
  const { tokens } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} aria-busy={true} style={style}>
      <ActivityIndicator size={size} color={tokens.primary} />
    </View>
  );
}
