import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '@finapp/ui/native';

type FinanceSyncTone = 'connected' | 'syncing' | 'attention' | 'idle';

const syncLabels: Record<FinanceSyncTone, string> = {
  connected: 'All changes synced',
  syncing: 'Syncing changes',
  attention: 'Sync needs attention',
  idle: 'Sign in to sync',
};

export function FinanceBrand({ syncTone }: { syncTone?: FinanceSyncTone }) {
  const { tokens } = useTheme();
  const statusColor =
    syncTone === 'syncing'
      ? tokens.warning
      : syncTone === 'attention'
        ? tokens.destructive
        : syncTone === 'idle'
          ? tokens.foregroundSubtle
          : '#B7FF4A';
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={syncTone ? `Finapp. ${syncLabels[syncTone]}` : 'Finapp'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        accessible={false}
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: statusColor,
        }}
      />
      <Text
        style={{
          color: tokens.foreground,
          fontFamily: 'SpaceGrotesk_600SemiBold',
          fontSize: 15,
          lineHeight: 20,
          letterSpacing: -0.5,
        }}
      >
        finapp
      </Text>
    </View>
  );
}
