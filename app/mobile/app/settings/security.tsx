import React, { useState } from 'react';
import { View } from 'react-native';
import { Switch, Typography } from '@/components/ui';

export default function SecuritySettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Security</Typography>
      <Switch label="App lock" value={enabled} onValueChange={setEnabled} />
      <Typography>Biometrics with device PIN fallback protect local entry.</Typography>
    </View>
  );
}
