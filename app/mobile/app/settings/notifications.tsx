import React, { useState } from 'react';
import { View } from 'react-native';
import { Switch, Typography } from '@/components/ui';

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(true);
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Notifications</Typography>
      <Switch label="Budget warnings" value={enabled} onValueChange={setEnabled} />
      <Switch label="Recurring reminders" value={enabled} onValueChange={setEnabled} />
    </View>
  );
}
