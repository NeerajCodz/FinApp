import React from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { useTheme } from './ThemeProvider';
import { layoutTokens } from '../tokens';

export type BubbleAlignment = 'sent' | 'received';

export type BubbleProps = Omit<ViewProps, 'children'> & {
  children: React.ReactNode;
  alignment?: BubbleAlignment;
  author?: string;
  timestamp?: string | Date;
};

function timestampText(timestamp: string | Date): string {
  return timestamp instanceof Date
    ? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : timestamp;
}

export function Bubble({
  children,
  alignment = 'received',
  author,
  timestamp,
  style,
  accessibilityLabel,
  ...props
}: BubbleProps) {
  const { tokens } = useTheme();
  const sent = alignment === 'sent';
  const timeLabel = timestamp === undefined ? undefined : timestampText(timestamp);
  const messageLabel = [
    typeof children === 'string' || typeof children === 'number' ? String(children) : undefined,
    author,
    timeLabel,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');

  return (
    <View
      {...props}
      accessibilityRole={props.accessibilityRole ?? 'text'}
      accessibilityLabel={accessibilityLabel ?? (messageLabel || undefined)}
      style={[
        {
          alignSelf: sent ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: layoutTokens.radiusControl,
          borderBottomRightRadius: sent ? 4 : layoutTokens.radiusControl,
          borderBottomLeftRadius: sent ? layoutTokens.radiusControl : 4,
          backgroundColor: sent ? tokens.primary : tokens.surfaceRaised,
        },
        style,
      ]}
    >
      {author ? (
        <Text
          style={{
            color: sent ? tokens.primaryForeground : tokens.foregroundMuted,
            fontSize: 12,
            fontWeight: '600',
            marginBottom: 3,
          }}
        >
          {author}
        </Text>
      ) : null}
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          style={{
            color: sent ? tokens.primaryForeground : tokens.foreground,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          {children}
        </Text>
      ) : (
        <View>{children}</View>
      )}
      {timeLabel ? (
        <Text
          style={{
            alignSelf: 'flex-end',
            color: sent ? tokens.primaryForeground : tokens.foregroundMuted,
            fontSize: 10,
            marginTop: 4,
            opacity: 0.78,
          }}
        >
          {timeLabel}
        </Text>
      ) : null}
    </View>
  );
}
