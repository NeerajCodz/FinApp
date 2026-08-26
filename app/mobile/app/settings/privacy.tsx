import React from 'react';
import { View } from 'react-native';
import { Button, Typography } from '@/components/ui';

export default function PrivacySettingsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Privacy</Typography>
      <Typography>Your financial values stay out of ordinary telemetry.</Typography>
      <Button>Export my data</Button>
      <Button variant="destructive">Request account deletion</Button>
    </View>
  );
}
