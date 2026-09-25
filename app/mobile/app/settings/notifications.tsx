import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { ArrowLeft, Bell } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Separator, Switch, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import {
  permissionStatus, reconcileRecurringNotifications, requestNotificationPermission,
  saveNotificationPreferences,
} from '@/local/notification-events';
import {
  normalizeNotificationPreferences, type NotificationPreferences, type NotificationType,
} from '@convex/notifications/domain';

const options: { type: NotificationType; label: string; detail: string }[] = [
  { type: 'transaction', label: 'Transactions', detail: 'Recorded transactions.' },
  { type: 'budget', label: 'Budget limits', detail: 'When spending crosses 80% or 100%.' },
  { type: 'goal', label: 'Goals', detail: 'When a savings target is reached.' },
  { type: 'recurring', label: 'Recurring reminders', detail: 'Due dates for reminder-only rules.' },
  { type: 'group', label: 'Groups & splits', detail: 'When you join a group or share an expense.' },
  { type: 'settlement', label: 'Settlements', detail: 'When another group member records a settlement.' },
  { type: 'security', label: 'Security', detail: 'When a verified email recovery code is used for this device’s app passcode.' },
  { type: 'sync', label: 'Sync problems', detail: 'Changes that need your attention on this device.' },
];

export default function NotificationSettingsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const settings = useLocalRecords<LocalRecord>(userId, 'settings');
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = React.useState<'granted' | 'denied' | 'undetermined' | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (settings.data?.[0]) setPreferences(normalizeNotificationPreferences(settings.data[0].notificationPreferences));
  }, [settings.data]);
  React.useEffect(() => { void permissionStatus().then(setPermission).catch(() => setPermission('denied')); }, []);

  async function change(type: NotificationType, value: boolean) {
    if (!userId || !preferences || saving) return;
    const next = { ...preferences, [type]: value };
    setPreferences(next);
    setSaving(true);
    setError('');
    try {
      await saveNotificationPreferences(userId, next);
      if (type === 'recurring') await reconcileRecurringNotifications(userId);
    } catch (cause) {
      setPreferences(preferences);
      setError(cause instanceof Error ? cause.message : 'Could not save notification settings.');
    } finally { setSaving(false); }
  }

  async function enableDeviceDelivery() {
    try {
      const granted = await requestNotificationPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (granted && userId) await reconcileRecurringNotifications(userId);
    } catch { setError('Could not request notification permission.'); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32, gap: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Notifications</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="heading">In-app activity</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          Choose what enters your inbox. Changes save on this device first and sync when connected.
        </Text>
      </View>
      {settings.loading && <Typography variant="small">Loading preferences…</Typography>}
      {settings.error && <Button variant="outline" onPress={settings.retry}>Retry loading preferences</Button>}
      {!settings.loading && !settings.error && !settings.data?.[0] && (
        <Text style={{ color: tokens.foregroundMuted }}>Connect once to load your account settings.</Text>
      )}
      {preferences && <View>
        {options.map((option, index) => <View key={option.type}>
          {index > 0 && <Separator />}
          <Switch label={option.label} value={preferences[option.type]}
            onValueChange={(value) => void change(option.type, value)} />
          <Typography variant="small" style={{ marginTop: -4, marginBottom: 12 }}>
            {option.detail}
          </Typography>
        </View>)}
      </View>}
      <View style={{ gap: 10, paddingTop: 12, borderTopWidth: 1, borderColor: tokens.borderSubtle }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Bell size={19} color={tokens.primary} />
          <Typography variant="heading">Device reminders</Typography>
        </View>
        <Text style={{ color: tokens.foregroundMuted }}>
          Only recurring due dates can alert this device. Other activity stays in the in-app inbox;
          push delivery is not configured.
        </Text>
        {permission === null && <Typography variant="small">Checking device permission…</Typography>}
        {permission === 'granted' && <Typography variant="small">Device reminders allowed.</Typography>}
        {permission === 'undetermined' &&
          <Button variant="outline" onPress={() => void enableDeviceDelivery()}>Allow device reminders</Button>}
        {permission === 'denied' && <Button variant="outline" onPress={() => void Linking.openSettings()}>
          Open device settings
        </Button>}
        {!isConnected && <Typography variant="small">Offline: your inbox and preferences remain available.</Typography>}
      </View>
      {saving && <Typography variant="small">Saving…</Typography>}
      {!!error && <Text style={{ color: tokens.destructive }}>{error}</Text>}
    </ScrollView>
  );
}
