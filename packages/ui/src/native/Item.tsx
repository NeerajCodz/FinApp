import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type ItemProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Item({
  title,
  description,
  leading,
  trailing,
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: ItemProps) {
  const { tokens } = useTheme();
  const interactive = typeof onPress === 'function';
  const content = (
    <>
      {leading != null && (
        <View accessible={false} style={{ flexShrink: 0 }}>
          {leading}
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof title === 'string' || typeof title === 'number' ? (
          <Text
            style={{ color: tokens.foreground, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 15 }}
          >
            {title}
          </Text>
        ) : (
          title
        )}
        {description != null &&
          (typeof description === 'string' || typeof description === 'number' ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 13 }}>{description}</Text>
          ) : (
            description
          ))}
      </View>
      {trailing != null && <View style={{ flexShrink: 0 }}>{trailing}</View>}
    </>
  );
  const rowStyle: StyleProp<ViewStyle> = [
    {
      minHeight: 60,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: tokens.borderSubtle,
      opacity: disabled ? 0.55 : 1,
    },
    style,
  ];

  if (interactive) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          rowStyle,
          pressed && !disabled ? { backgroundColor: tokens.surfaceRaised } : undefined,
        ]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={rowStyle}>
      {content}
    </View>
  );
}
