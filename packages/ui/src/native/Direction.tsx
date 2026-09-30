import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

export type DirectionProps = {
  dir: 'ltr' | 'rtl';
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Sets layout direction for this subtree; React Native descendants inherit it. */
export function Direction({ dir, children, style }: DirectionProps) {
  return <View style={[style, { direction: dir }]}>{children}</View>;
}
