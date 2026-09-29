import React from 'react';
import { Pressable, Text, View, type ViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';
import { layoutTokens } from '../tokens';

export type AlertVariant = 'default' | 'success' | 'warning' | 'destructive';

type AlertProps = Omit<ViewProps, 'children'> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  variant?: AlertVariant;
  onDismiss?: () => void;
};

export function Alert({
  title,
  description,
  icon,
  action,
  variant = 'default',
  onDismiss,
  style,
  ...props
}: AlertProps) {
  const { tokens } = useTheme();
  const accent =
    variant === 'success'
      ? tokens.positive
      : variant === 'warning'
        ? tokens.warning
        : variant === 'destructive'
          ? tokens.destructive
          : tokens.primary;

  return (
    <View
      {...props}
      accessibilityRole={
        props.accessibilityRole ??
        (variant === 'warning' || variant === 'destructive' ? 'alert' : 'summary')
      }
      accessibilityLiveRegion={
        variant === 'warning' || variant === 'destructive' ? 'assertive' : 'polite'
      }
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: `${accent}55`,
          borderRadius: layoutTokens.radiusControl,
          backgroundColor: `${accent}12`,
        },
        style,
      ]}
    >
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no">
          {icon}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        {title ? (
          <Text style={{ color: tokens.foreground, fontSize: 15, fontWeight: '600' }}>{title}</Text>
        ) : null}
        {description ? (
          <Text style={{ color: tokens.foregroundMuted, fontSize: 13, lineHeight: 18 }}>
            {description}
          </Text>
        ) : null}
        {action ? <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>{action}</View> : null}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss alert"
          onPress={onDismiss}
          hitSlop={8}
        >
          <Text style={{ color: tokens.foregroundMuted, fontWeight: '600' }}>Dismiss</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
