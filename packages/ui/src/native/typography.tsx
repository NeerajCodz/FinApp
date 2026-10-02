import React from 'react';
import { Text as RNText, View } from 'react-native';
import { useTheme } from './ThemeProvider';

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
}: React.ComponentProps<typeof RNText> & {
  variant?:
    'hero' | 'display' | 'title' | 'heading' | 'bodyLarge' | 'body' | 'small' | 'caption' | 'label';
}) => {
  const { tokens } = useTheme();
  return (
    <Text
      style={[
        variant === 'hero' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 48,
          lineHeight: 52,
          letterSpacing: -2,
          fontVariant: ['tabular-nums'],
        },
        variant === 'display' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 36,
          lineHeight: 40,
          letterSpacing: -1.3,
        },
        variant === 'title' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 30,
          lineHeight: 34,
          letterSpacing: -0.9,
        },
        variant === 'heading' && {
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 20,
          lineHeight: 25,
          letterSpacing: -0.3,
        },
        variant === 'bodyLarge' && {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 17,
          lineHeight: 24,
        },
        variant === 'small' && {
          fontSize: 13,
          lineHeight: 18,
          color: tokens.foregroundMuted,
        },
        variant === 'caption' && {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 11,
          lineHeight: 15,
          letterSpacing: 0.2,
          color: tokens.foregroundSubtle,
        },
        variant === 'label' && {
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 13,
          lineHeight: 18,
          color: tokens.foregroundMuted,
        },
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
    success: { backgroundColor: `${tokens.positive}1A`, color: tokens.positive },
    danger: { backgroundColor: '#FF5C5C1A', color: tokens.destructive },
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
