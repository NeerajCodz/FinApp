import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';

export type AspectRatioProps = Omit<ViewProps, 'children'> & {
  ratio?: number;
  children: React.ReactNode;
};

export function AspectRatio({ ratio = 1, children, style, ...props }: AspectRatioProps) {
  const { tokens } = useTheme();
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;

  return (
    <View
      {...props}
      style={[
        {
          aspectRatio: safeRatio,
          overflow: 'hidden',
          backgroundColor: tokens.surfaceSubtle,
          borderColor: tokens.borderSubtle,
          borderWidth: 1,
          borderRadius: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
