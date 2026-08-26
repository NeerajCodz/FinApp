import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Typography } from '@/components/ui';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">Settings</Typography>
      <Button variant="secondary" onPress={() => router.push('/settings/appearance' as never)}>
        Appearance
      </Button>
      <Button variant="secondary" onPress={() => router.push('/settings/currency' as never)}>
        Currency
      </Button>
      <Button variant="secondary" onPress={() => router.push('/settings/notifications' as never)}>
        Notifications
      </Button>
      <Button variant="secondary" onPress={() => router.push('/settings/security' as never)}>
        Security
      </Button>
      <Button variant="secondary" onPress={() => router.push('/settings/privacy' as never)}>
        Privacy & export
      </Button>
    </View>
  );
}
