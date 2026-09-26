'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell } from 'lucide-react';
import { Button, Card, SectionHeader, Switch } from '@finapp/ui/web';
import { defaultNotificationPreferences, normalizeNotificationPreferences, type NotificationPreferences, type NotificationType } from '@convex/notifications/domain';
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
  { type: 'group', label: 'Groups and splits', detail: 'Group membership and shared expenses.' },
  { type: 'settlement', label: 'Settlements', detail: 'Repayments recorded by group members.' },
  { type: 'security', label: 'Security', detail: 'Account security and recovery updates.' },
  { type: 'sync', label: 'Sync problems', detail: 'Changes that need attention in this browser.' },
];

export default function NotificationSettingsPage() {
  const { userId, isConnected } = useBrowserSync();
  const { records, loading, error, } = useLocalRecords<SettingsRecord>('settings');
  const setting = records[0];
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = React.useState<NotificationPermission | 'unsupported' | null>(null);
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
      setMessage(cause instanceof Error ? cause.message : 'Could not save notification preferences.');
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
      setMessage(result === 'granted'
        ? 'Browser notifications are allowed while Finapp is open.'
        : 'Permission was not granted. You can change it in your browser settings.');
    } catch {
      setMessage('Could not request browser notification permission.');
    }
  }

  const selectedPreferences = preferences ?? defaultNotificationPreferences;
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">PREFERENCES</p>
          <h1>Notifications</h1>
          <p className="finance-muted">Choose which account updates appear in your inbox.</p>
        </div>
        <Link className="finance-secondary-action" href="/settings"><ArrowLeft size={15} aria-hidden="true" /> Settings</Link>
      </header>

      {loading ? (
        <p className="finance-muted" role="status">Loading saved preferences…</p>
      ) : error ? (
        <div role="alert">
          <p className="finance-form-error">Notification preferences could not be loaded.</p>
          <Button variant="outline" onPress={() => window.location.reload()}>Reload preferences</Button>
        </div>
      ) : !setting ? (
        <Card className="finance-record-panel">
          <p className="finance-form-note">Connect once to load account settings before changing notification preferences.</p>
        </Card>
      ) : (
        <Card className="finance-record-panel" style={{ display: 'grid', gap: 14 }}>
          <SectionHeader title="In-app activity" action={<Bell size={17} aria-hidden="true" />} />
          <p className="finance-form-note">Changes save to this browser first, then sync when connected.</p>
          <div>
            {options.map((option, index) => (
              <div key={option.type} style={{ borderTop: index === 0 ? '1px solid var(--finance-line)' : undefined, borderBottom: '1px solid var(--finance-line)', padding: '12px 0' }}>
                <Switch
                  label={option.label}
                  value={selectedPreferences[option.type]}
                  disabled={saving}
                  onValueChange={(value) => void change(option.type, value)}
                />
                <p className="finance-form-note" style={{ marginTop: 4 }}>{option.detail}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="finance-settings-card">
        <SectionHeader title="Browser delivery" action={<Bell size={17} aria-hidden="true" />} />
        <p>Browser permission is requested only after you choose the button. Notifications are not promised after this tab closes; recurring rules remain reminders and never create transactions.</p>
        <p className="finance-settings-count">Permission: {permission ?? 'checking'}</p>
        {permission === 'default' && <Button variant="outline" onPress={() => void requestPermission()}>Allow browser notifications</Button>}
        {permission === 'granted' && <p className="finance-settings-count">Permission granted for browser notifications.</p>}
        {permission === 'denied' && <p className="finance-form-note">Permission is blocked. Change it in this site’s browser settings to allow delivery.</p>}
        {permission === 'unsupported' && <p className="finance-form-note">This browser does not support the Notification API. Your in-app inbox remains available.</p>}
      </Card>
      {saving && <p className="finance-muted" role="status">Saving preferences…</p>}
      {message && <p className="finance-settings-message" role="status">{message}</p>}
      {!isConnected && <p className="finance-data-footnote">Offline · saved preferences remain available and will sync when connected.</p>}
    </div>
  );
}
