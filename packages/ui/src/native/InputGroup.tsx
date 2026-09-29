import React from 'react';
import { Text, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type InputGroupProps = {
  children: React.ReactElement<TextInputProps>;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function InputGroup({
  children,
  leading,
  trailing,
  accessibilityLabel,
  disabled = false,
  style,
}: InputGroupProps) {
  const { tokens } = useTheme();
  const input = React.cloneElement(children, {
    editable: disabled ? false : children.props.editable,
    style: [
      children.props.style,
      {
        flex: 1,
        minWidth: 0,
        minHeight: 52,
        borderWidth: 0,
        borderRadius: 0,
        paddingHorizontal: 12,
        backgroundColor: 'transparent',
      },
    ],
  });
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="none"
      accessibilityState={{ disabled }}
      style={[
        {
          minWidth: 0,
          minHeight: 54,
          flexDirection: 'row',
          alignItems: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: 14,
          backgroundColor: tokens.input,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      {leading != null && (
        <View
          style={{
            minHeight: 52,
            justifyContent: 'center',
            paddingHorizontal: 14,
            borderRightWidth: 1,
            borderRightColor: tokens.borderSubtle,
          }}
        >
          {typeof leading === 'string' || typeof leading === 'number' ? (
            <Text style={{ color: tokens.foregroundMuted }}>{leading}</Text>
          ) : (
            leading
          )}
        </View>
      )}
      {input}
      {trailing != null && (
        <View
          style={{
            minHeight: 52,
            justifyContent: 'center',
            paddingHorizontal: 14,
            borderLeftWidth: 1,
            borderLeftColor: tokens.borderSubtle,
          }}
        >
          {typeof trailing === 'string' || typeof trailing === 'number' ? (
            <Text style={{ color: tokens.foregroundMuted }}>{trailing}</Text>
          ) : (
            trailing
          )}
        </View>
      )}
    </View>
  );
}
