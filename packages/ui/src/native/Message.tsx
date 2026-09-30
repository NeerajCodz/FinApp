import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { layoutTokens } from '../tokens';

export type MessageType = 'chat' | 'system' | 'success' | 'warning' | 'error';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type MessageProps = {
  children?: React.ReactNode;
  text?: string;
  author?: string;
  timestamp?: string | Date;
  status?: MessageStatus;
  type?: MessageType;
  style?: StyleProp<ViewStyle>;
};

const statusLabels: Record<MessageStatus, string> = {
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

function timestampText(timestamp: string | Date): string {
  return timestamp instanceof Date
    ? timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : timestamp;
}

export function Message({
  children,
  text,
  author,
  timestamp,
  status,
  type = 'chat',
  style,
}: MessageProps) {
  const { tokens } = useTheme();
  const timeLabel = timestamp === undefined ? undefined : timestampText(timestamp);
  const content = children ?? text;
  const accent =
    type === 'success'
      ? tokens.positive
      : type === 'warning'
        ? tokens.warning
        : type === 'error'
          ? tokens.destructive
          : type === 'system'
            ? tokens.border
            : tokens.borderSubtle;

  return (
    <View
      accessibilityLiveRegion={type === 'system' ? 'polite' : 'none'}
      style={[
        {
          alignSelf: 'stretch',
          maxWidth: '100%',
          gap: 6,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: accent,
          borderRadius: layoutTokens.radiusControl,
          backgroundColor: type === 'system' ? tokens.surfaceSubtle : tokens.surfaceRaised,
        },
        style,
      ]}
    >
      {author ? (
        <Text style={{ color: tokens.foregroundMuted, fontSize: 12, fontWeight: '600' }}>
          {author}
        </Text>
      ) : null}
      {type !== 'chat' ? (
        <Text
          accessibilityLabel={`Message type: ${type}`}
          style={{
            color: accent,
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          {type}
        </Text>
      ) : null}
      {content !== undefined && content !== null ? (
        typeof content === 'string' || typeof content === 'number' ? (
          <Text style={{ color: tokens.foreground, fontSize: 14, lineHeight: 20 }}>{content}</Text>
        ) : (
          <View>{content}</View>
        )
      ) : null}
      {timeLabel || status ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 2,
          }}
        >
          {timeLabel ? (
            <Text style={{ color: tokens.foregroundMuted, fontSize: 10 }}>{timeLabel}</Text>
          ) : null}
          {status ? (
            <Text
              accessibilityLabel={`Message ${statusLabels[status].toLowerCase()}`}
              style={{
                color: status === 'failed' ? tokens.destructive : tokens.foregroundMuted,
                fontSize: 10,
              }}
            >
              {statusLabels[status]}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
