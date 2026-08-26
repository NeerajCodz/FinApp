import React from 'react';
import { View } from 'react-native';
import { Button, Typography } from '@/components/ui';

export default function GroupSettingsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Group settings</Typography>
      <Button variant="destructive">Archive group</Button>
    </View>
  );
}
