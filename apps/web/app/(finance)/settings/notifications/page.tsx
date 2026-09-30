'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { Button, IconButton, Separator, Switch, Text, Typography, useTheme } from '@finapp/ui/web';
import {
  defaultNotificationPreferences,
  normalizeNotificationPreferences,
  type NotificationPreferences,
  type NotificationType,
} from '@convex/notifications/domain';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type SettingsRecord = LocalRecord & { notificationPreferences?: unknown };
const options: { type: NotificationType; label: string; detail: string }[] = [
  { type: 'transaction', label: 'Transactions', detail: 'Recorded transactions.' },
  { type: 'budget', label: 'Budget limits', detail: 'When spending crosses 80% or 100%.' },
  { type: 'goal', label: 'Goals', detail: 'When a savings target is reached.' },
  { type: 'recurring', label: 'Recurring reminders', detail: 'Due dates for reminder-only rules.' },
  { type: 'group', label: 'Groups & splits', detail: 'When you join a group or share an expense.' },
  {
    type: 'settlement',
    label: 'Settlements',
    detail: 'When another group member records a settlement.',
  },
  {
    type: 'security',
    label: 'Security',
    detail: 'When a verified email recovery code is used for this device’s app passcode.',
  },
  {
    type: 'sync',
    label: 'Sync problems',
    detail: 'Changes that need your attention on this device.',
  },
];

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<SettingsRecord>('settings');
  const { tokens } = useTheme();
  const setting = records[0];
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported' | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    if (setting) setPreferences(normalizeNotificationPreferences(setting.notificationPreferences));
  }, [setting]);
  React.useEffect(() => {
    setPermission('Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  if (!userId)
    return (
      <FinanceSignedOut
        section="NOTIFICATION PREFERENCES"
        title="Choose what reaches your inbox."
        description="Sign in to manage the notification types shown in your local inbox."
      />
    );

  async function change(type: NotificationType, value: boolean) {
    if (!userId || !setting || !preferences || saving) return;
    const next = { ...preferences, [type]: value };
    setPreferences(next);
    setSaving(true);
    setMessage('');
    try {
      await commitLocalWrite(
        userId,
        'settings',
        'notification.preferences',
        { ...setting, notificationPreferences: next },
        { preferences: next },
        { recordId: String(setting.id ?? setting._id ?? '') },
      );
      setMessage('Saved on this device. Preferences sync when connected.');
    } catch (cause) {
      setPreferences(preferences);
      setMessage(
        cause instanceof Error ? cause.message : 'Could not save notification preferences.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function requestPermission() {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      setMessage(
        result === 'granted'
          ? 'Browser notifications are allowed while Finapp is open.'
          : 'Permission was not granted. You can change it in your browser settings.',
      );
    } catch {
      setMessage('Could not request browser notification permission.');
    }
  }

  const selectedPreferences = preferences ?? defaultNotificationPreferences;
  return (
    <div className="finance-page" style={{ gap: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.push('/settings')}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Notifications</Typography>
      </header>

      <section style={{ display: 'grid', gap: 8 }}>
        <Typography variant="heading">In-app activity</Typography>
        <Text>
          Choose what enters your inbox. Changes save on this device first and sync when connected.
        </Text>
      </section>

      {loading && <Typography variant="small">Loading preferences…</Typography>}
      {error && (
        <Button variant="outline" onPress={() => window.location.reload()}>
          Retry loading preferences
        </Button>
      )}
      {!loading && !error && !setting && <Text>Connect once to load your account settings.</Text>}
      {!loading && !error && setting && (
        <div>
          {options.map((option, index) => (
            <div key={option.type}>
              {index > 0 && <Separator />}
              <Switch
                label={option.label}
                value={selectedPreferences[option.type]}
                disabled={saving}
                onValueChange={(value) => void change(option.type, value)}
              />
              <Typography
                variant="small"
                style={{ display: 'block', marginTop: -4, marginBottom: 12 }}
              >
                {option.detail}
              </Typography>
            </div>
          ))}
        </div>
      )}

      <section
        style={{
          display: 'grid',
          gap: 10,
          paddingTop: 12,
          borderTop: `1px solid ${tokens.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={19} color={tokens.primary} aria-hidden="true" />
          <Typography variant="heading">Device reminders</Typography>
        </div>
        <Text>
          Only recurring due dates can alert this device. Other activity stays in the in-app inbox;
          push delivery is not configured.
        </Text>
        {permission === null && (
          <Typography variant="small">Checking device permission…</Typography>
        )}
        {permission === 'granted' && (
          <Typography variant="small">Device reminders allowed.</Typography>
        )}
        {permission === 'default' && (
          <Button variant="outline" onPress={() => void requestPermission()}>
            Allow device reminders
          </Button>
        )}
        {permission === 'denied' && (
          <Text>
            Permission is blocked. Change it in this site’s browser settings to allow delivery.
          </Text>
        )}
        {permission === 'unsupported' && (
          <Text>
            This browser does not support the Notification API. Your in-app inbox remains available.
          </Text>
        )}
        {!isConnected && (
          <Typography variant="small">
            Offline: your inbox and preferences remain available.
          </Typography>
        )}
      </section>
      {saving && <Typography variant="small">Saving…</Typography>}
      {message && <Text role="status">{message}</Text>}
    </div>
  );
}
