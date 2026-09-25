import React from 'react';
import { ScrollView, View } from 'react-native';
import {
  ArrowLeft,
  Bell,
  ClockCounterClockwise,
  CurrencyDollar,
  Eye,
  LockKey,
  Palette,
} from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { SettingsRow } from '@/components/finance';
import { IconButton, Separator, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SettingsScreen() {
  const { userId, syncWindow } = useLocalSync();
  const { data: profiles } = useLocalRecords<Record<string, unknown>>(userId, 'profile');
  const profile = profiles?.[0];
  const syncWindowLabel = syncWindow === 'all' ? 'All history' : `${syncWindow} days`;
  const currency = typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR';
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
          leadingIcon={<Palette size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/appearance' as never)}
        />
        <Separator />
        <SettingsRow
          label="Currency"
          value={currency}
          leadingIcon={<CurrencyDollar size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/currency' as never)}
        />
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Preferences
        </Typography>
        <SettingsRow
          label="Notifications"
          leadingIcon={<Bell size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/notifications' as never)}
        />
        <Separator />
        <SettingsRow
          label="Security"
          leadingIcon={<LockKey size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/security' as never)}
        />
      </View>

      <View>
        <Typography variant="label" style={{ marginBottom: 8 }}>
          Data
        </Typography>
        <SettingsRow
          label="Local sync"
          value={syncWindowLabel}
          leadingIcon={<ClockCounterClockwise size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/sync' as never)}
        />
        <Separator />
        <SettingsRow
          label="Privacy and export"
          leadingIcon={<Eye size={19} color={tokens.primary} />}
          onPress={() => router.push('/settings/privacy' as never)}
        />
      </View>
    </ScrollView>
  );
}
