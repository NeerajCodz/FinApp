import React from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { SettingsRow } from '@/components/finance';
import { IconButton, Separator, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SettingsScreen() {
  const profile = useQuery(api.users.queries.current);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
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
        <Typography variant="title">Settings</Typography>
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          General
        </Typography>
        <SettingsRow
          label="Appearance"
          value="Dark"
          onPress={() => router.push('/settings/appearance' as never)}
        />
        <Separator />
        <SettingsRow
          label="Currency"
          value={profile?.defaultCurrency ?? 'INR'}
          onPress={() => router.push('/settings/currency' as never)}
        />
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Preferences
        </Typography>
        <SettingsRow
          label="Notifications"
          onPress={() => router.push('/settings/notifications' as never)}
        />
        <Separator />
        <SettingsRow label="Security" onPress={() => router.push('/settings/security' as never)} />
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Data
        </Typography>
        <SettingsRow
          label="Privacy and export"
          onPress={() => router.push('/settings/privacy' as never)}
        />
      </View>
    </ScrollView>
  );
}
