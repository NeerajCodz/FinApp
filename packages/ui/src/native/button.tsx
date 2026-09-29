import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { getTouchTargetStyle } from './touch-target';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

type ButtonProps = Omit<React.ComponentProps<typeof TouchableOpacity>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  children: React.ReactNode;
};

export function Button({
  children,
  variant = 'primary',
  size = 'default',
  style,
  accessibilityLabel,
  disabled,
  ...props
}: ButtonProps) {
  const { tokens } = useTheme();
  const enabledColors = {
    primary: { backgroundColor: tokens.primary, color: tokens.primaryForeground },
    secondary: { backgroundColor: tokens.secondary, color: tokens.secondaryForeground },
    outline: { backgroundColor: 'transparent', color: tokens.foreground },
    ghost: { backgroundColor: 'transparent', color: tokens.foregroundMuted },
    destructive: { backgroundColor: '#FF5C5C1A', color: tokens.destructive },
  } as const;
  const disabledColors = {
    primary: {
      backgroundColor: tokens.controlDisabledBackground,
      color: tokens.controlDisabledForeground,
    },
    secondary: {
      backgroundColor: tokens.secondary,
      color: tokens.controlDisabledForeground,
    },
    outline: {
      backgroundColor: 'transparent',
      color: tokens.controlDisabledForeground,
    },
    ghost: {
      backgroundColor: 'transparent',
      color: tokens.controlDisabledForeground,
    },
    destructive: {
      backgroundColor: '#FF5C5C1A',
      color: tokens.controlDisabledForeground,
    },
  } as const;
  const { backgroundColor, color } = (disabled ? disabledColors : enabledColors)[variant];
  const compact = size === 'sm';
  const icon = size === 'icon';
  const height = icon ? 44 : compact ? 38 : size === 'lg' ? 54 : 48;
  const staticStyle = StyleSheet.flatten(style);
  const content = React.Children.toArray(children);
  const textOnly = content.every((child) => typeof child === 'string' || typeof child === 'number');
  const contentJustify = staticStyle?.justifyContent ?? 'center';
  const textAlign = contentJustify === 'flex-start' ? 'left' : 'center';
  const textStyle = {
    color,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: compact ? 13 : 15,
    lineHeight: compact ? 18 : 20,
    textAlign,
  } as const;
  const normalizedContent = content.map((child, index) =>
    typeof child === 'string' || typeof child === 'number' ? (
      <Text key={`button-text-${index}`} numberOfLines={1} style={textStyle}>
        {child}
      </Text>
    ) : (
      child
    ),
  );
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      activeOpacity={0.78}
      disabled={disabled}
      style={[
        getTouchTargetStyle({
          minWidth: icon ? 44 : undefined,
          height,
          minHeight: height,
          borderRadius: 14,
          paddingHorizontal: icon ? 0 : compact ? 14 : 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          overflow: 'hidden',
          backgroundColor,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor:
            variant === 'outline'
              ? disabled
                ? tokens.borderSubtle
                : tokens.border
              : 'transparent',
        }),
        style,
      ]}
      {...props}
    >
      {textOnly ? (
        <Text numberOfLines={1} style={textStyle}>
          {content.join('')}
        </Text>
      ) : (
        <View
          pointerEvents="none"
          style={{
            alignSelf: 'stretch',
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: contentJustify,
          }}
        >
          {normalizedContent}
        </View>
      )}
    </TouchableOpacity>
  );
}

export function IconButton({
  children,
  label,
  variant = 'outline',
  ...props
}: Omit<ButtonProps, 'children'> & { children: React.ReactNode; label: string }) {
  return (
    <Button accessibilityLabel={label} size="icon" variant={variant} {...props}>
      {children}
    </Button>
  );
}

export const Toggle = ({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (v: boolean) => void;
  children: React.ReactNode;
}) => (
  <Button variant={pressed ? 'primary' : 'outline'} onPress={() => onPressedChange(!pressed)}>
    {children}
  </Button>
);
