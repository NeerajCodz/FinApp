import React from 'react';
import { View } from 'react-native';

export const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <View accessibilityLabel={label}>{children}</View>
);
