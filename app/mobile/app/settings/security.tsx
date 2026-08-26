import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Separator, Switch, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SecuritySettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  function updateLock(next: boolean) {
    void Haptics.selectionAsync();
    setEnabled(next);
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Security</Typography>
      </View>
      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          App access
        </Typography>
        <Switch label="App lock" value={enabled} onValueChange={updateLock} />
        <Separator />
        <View style={{ paddingVertical: 16 }}>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
            Biometrics with device PIN fallback protect local entry.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}
