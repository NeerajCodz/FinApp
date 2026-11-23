import React from 'react';
import { Text as RNText, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { typeScale, withAlpha, type TypeVariant } from '../tokens';

export function Text({ children, style, ...props }: React.ComponentProps<typeof RNText>) {
  const { tokens } = useTheme();
  return (
    <RNText
      allowFontScaling
      style={[
        {
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_400Regular',
          fontSize: 15,
          lineHeight: 22,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}

export const Typography = ({
  children,
  variant = 'body',
  ...props
}: React.ComponentProps<typeof RNText> & { variant?: TypeVariant }) => {
  const { tokens } = useTheme();
  const { fontWeight: _weight, tone, ...type } = typeScale[variant];
  return (
    <Text
      style={[
        type,
        variant === 'hero' && { fontVariant: ['tabular-nums'] },
        tone === 'muted' && { color: tokens.foregroundMuted },
        tone === 'subtle' && { color: tokens.foregroundSubtle },
        props.style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

export const Label = ({ children, ...props }: React.ComponentProps<typeof RNText>) => (
  <Typography variant="label" {...props} style={[{ marginBottom: 8 }, props.style]}>
    {children}
  </Typography>
);

export function Badge({
  children,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> & {
  variant?: 'default' | 'success' | 'danger' | 'neutral';
}) {
  const { tokens } = useTheme();
  const palette = {
    default: { backgroundColor: tokens.primary, color: tokens.primaryForeground },
    success: { backgroundColor: withAlpha(tokens.positive, 0.1), color: tokens.positive },
    danger: { backgroundColor: withAlpha(tokens.destructive, 0.1), color: tokens.destructive },
    neutral: { backgroundColor: tokens.surfaceRaised, color: tokens.foregroundMuted },
  } as const;
  return (
    <Text
      {...props}
      style={[
        {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: palette[variant].backgroundColor,
          color: palette[variant].color,
          fontSize: 11,
          lineHeight: 15,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          letterSpacing: 0.2,
        },
        props.style,
      ]}
    >
      {children}
    </Text>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <Typography variant="heading">{title}</Typography>
      {action}
    </View>
  );
}
