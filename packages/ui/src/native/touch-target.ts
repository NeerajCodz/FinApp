import type { ViewStyle } from 'react-native';

export function getTouchTargetStyle(style: ViewStyle = {}): ViewStyle {
  return { minWidth: 44, minHeight: 44, ...style };
}
