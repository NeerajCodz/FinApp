import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './typography';

export type AttachmentState = 'ready' | 'uploading' | 'failed';

export type AttachmentProps = {
  name: string;
  mimeType?: string;
  sizeLabel?: string;
  state?: AttachmentState;
  /** Upload completion percentage, from 0 to 100. Invalid values are not rendered. */
  progress?: number;
  onOpen?: () => void;
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
};

const stateLabels: Record<AttachmentState, string> = {
  ready: 'Ready',
  uploading: 'Uploading',
  failed: 'Failed',
};

export function Attachment({
  name,
  mimeType,
  sizeLabel,
  state = 'ready',
  progress,
  onOpen,
  onRemove,
  style,
}: AttachmentProps) {
  const { tokens } = useTheme();
  const safeProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.min(100, Math.max(0, progress))
      : undefined;
  const metadata = [mimeType, sizeLabel].filter(Boolean).join(' · ');

  return (
    <View
      accessible={false}
      accessibilityRole="none"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
          paddingVertical: 12,
          paddingHorizontal: 14,
          backgroundColor: tokens.surfaceRaised,
          borderColor: tokens.borderSubtle,
          borderWidth: 1,
          borderRadius: 14,
        },
        style,
      ]}
    >
      <View
        accessible={false}
        style={{ width: 22, height: 24, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: tokens.primary, fontSize: 20, lineHeight: 24 }}>⌁</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ color: tokens.foreground, fontSize: 14, fontWeight: '600' }}
        >
          {name}
        </Text>
        {metadata ? (
          <Text numberOfLines={1} style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
            {metadata}
          </Text>
        ) : null}
        <Text
          accessibilityLiveRegion="polite"
          style={{
            color: state === 'failed' ? tokens.destructive : tokens.foregroundMuted,
            fontSize: 12,
          }}
        >
          {stateLabels[state]}
        </Text>
        {safeProgress !== undefined ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`Upload progress for ${name}`}
            accessibilityValue={{ min: 0, max: 100, now: safeProgress }}
            style={{
              height: 3,
              marginTop: 6,
              overflow: 'hidden',
              borderRadius: 3,
              backgroundColor: tokens.border,
            }}
          >
            <View
              style={{ width: `${safeProgress}%`, height: '100%', backgroundColor: tokens.primary }}
            />
          </View>
        ) : null}
      </View>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
          onPress={onOpen}
          style={({ pressed }) => [
            {
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 8,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: tokens.foreground, fontSize: 12 }}>Open</Text>
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          onPress={onRemove}
          style={({ pressed }) => [
            {
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 8,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ color: tokens.foreground, fontSize: 12 }}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
