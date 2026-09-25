import React from 'react';
import { Text, View } from 'react-native';
import type { ThemeTokens } from '../lib/theme/tokens';

type BackendConnectionNoticeProps = {
  isConnected: boolean;
  tokens: ThemeTokens;
};

export function BackendConnectionNotice({ isConnected, tokens }: BackendConnectionNoticeProps) {
  if (isConnected) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        left: 0,
        zIndex: 1000,
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        backgroundColor: tokens.surfaceRaised,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
      }}
    >
      <Text
        accessibilityRole="alert"
        style={{
          color: tokens.foregroundMuted,
          fontFamily: 'SpaceGrotesk_500Medium',
          fontSize: 11,
          lineHeight: 16,
          textAlign: 'center',
        }}
      >
        Offline · Changes stay on this device
      </Text>
    </View>
  );
}
