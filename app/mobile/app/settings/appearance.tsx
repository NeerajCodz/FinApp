import React from 'react';
import { View } from 'react-native';
import { Select, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function AppearanceSettingsScreen() {
  const { appearance, setAppearance, accent, setAccent } = useTheme();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Appearance</Typography>
      <Select
        label="Theme"
        options={['system', 'light', 'dark']}
        value={appearance}
        onChange={(value) => setAppearance(value as 'system' | 'light' | 'dark')}
      />
      <Select
        label="Accent"
        options={['blue', 'red', 'white']}
        value={accent}
        onChange={(value) => setAccent(value as 'blue' | 'red' | 'white')}
      />
    </View>
  );
}
