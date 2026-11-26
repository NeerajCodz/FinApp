'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  CalendarClock,
  Gauge,
  HandCoins,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Split,
  Target,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { Button } from '@finapp/ui/web';
import {
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsShell,
  SettingsSwitch,
} from '@finapp/ui/finance';
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
type Option = {
  type: NotificationType;
  label: string;
  detail: string;
  icon: React.ReactNode;
  tone?: string;
};

const sections: { title: string; options: Option[] }[] = [
  {
    title: 'Your money',
    options: [
      {
        type: 'transaction',
        label: 'Transactions',
        detail: 'Each transaction you record',
        icon: <ReceiptText size={19} />,
      },
      {
        type: 'budget',
        label: 'Category limits',
        detail: 'When a category’s spending crosses its alert level or limit',
        icon: <Gauge size={19} />,
        tone: 'warning',
      },
      {
        type: 'goal',
        label: 'Goals',
        detail: 'When a savings target is reached',
        icon: <Target size={19} />,
        tone: 'positive',
      },
      {
        type: 'recurring',
        label: 'Recurring payments',
        detail: 'Due dates for reminder-only rules',
        icon: <CalendarClock size={19} />,
        tone: 'info',
      },
    ],
  },
  {
    title: 'Shared with others',
    options: [
      {
        type: 'split',
        label: 'Shared expenses',
        detail: 'Group expenses you’re in: added, edited or removed',
        icon: <Split size={19} />,
        tone: 'violet',
      },
      {
        type: 'settlement',
        label: 'Settlements',
        detail: 'Payments recorded or undone, and settle-up reminders',
        icon: <HandCoins size={19} />,
        tone: 'positive',
      },
      {
        type: 'group',
        label: 'Groups',
        detail: 'Invitations, and members joining or leaving',
        icon: <UsersRound size={19} />,
        tone: 'info',
      },
      {
        type: 'social',
        label: 'Friends',
        detail: 'Friend requests and accepted requests',
        icon: <UserPlus size={19} />,
        tone: 'primary',
      },
    ],
  },
  {
    title: 'Account',
    options: [
      {
        type: 'security',
        label: 'Security',
        detail: 'New sign-ins, apps connected over MCP, and account changes',
        icon: <ShieldCheck size={19} />,
        tone: 'danger',
      },
      {
        type: 'sync',
        label: 'Sync problems',
        detail: 'Changes that need your attention',
        icon: <RefreshCw size={19} />,
      },
    ],
  },
];

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<SettingsRecord>('settings');
  const setting = records[0];
  const [preferences, setPreferences] = React.useState<NotificationPreferences>(
    defaultNotificationPreferences,
  );
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
    if (!userId || !preferences || saving) return;
    const next = { ...preferences, [type]: value };
    setPreferences(next);
    setSaving(true);
    setMessage('');
    try {
      const current =
        setting ??
        ({
          id: `settings:${userId}`,
          ownerId: userId,
          notificationPreferences: defaultNotificationPreferences,
        } as SettingsRecord);
      await commitLocalWrite(
        userId,
        'settings',
        'notification.preferences',
        { ...current, notificationPreferences: next },
        { preferences: next },
        { recordId: String(current.id ?? current._id ?? `settings:${userId}`) },
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
  const enabledCount = sections
    .flatMap((section) => section.options)
    .filter((option) => selectedPreferences[option.type]).length;
  const total = sections.flatMap((section) => section.options).length;
  return (
    <SettingsShell
      title="Notifications"
      subtitle="What reaches your inbox"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={<Bell size={22} />}
        title={`${enabledCount} of ${total} kinds on`}
        description="Notifications appear in your inbox and the bell badge. Changes save right away and follow you to your other devices."
        action={
          <Button size="sm" variant="outline" onPress={() => router.push('/notifications')}>
            Open inbox
          </Button>
        }
      />
      {loading ? (
        <SettingsGroup>
          <SettingsItem title="Loading preferences…" />
        </SettingsGroup>
      ) : error ? (
        <SettingsGroup>
          <SettingsLink
            title="Couldn’t load preferences"
            description="Tap to retry"
            onPress={() => window.location.reload()}
          />
        </SettingsGroup>
      ) : (
        sections.map((section) => (
          <SettingsGroup key={section.title} title={section.title}>
            {section.options.map((option) => (
              <SettingsSwitch
                key={option.type}
                icon={option.icon}
                tone={option.tone}
                title={option.label}
                description={option.detail}
                checked={selectedPreferences[option.type]}
                disabled={saving}
                onChange={(value) => void change(option.type, value)}
              />
            ))}
          </SettingsGroup>
        ))
      )}
      <SettingsGroup title="This browser" description="Alerts outside the app">
        <SettingsItem
          icon={<BellRing size={19} />}
          tone="warning"
          title="Browser reminders"
          description={
            permission === null
              ? 'Checking permission…'
              : permission === 'granted'
                ? 'Allowed: recurring due dates can alert you while Finapp is open'
                : permission === 'denied'
                  ? 'Blocked. Allow notifications for this site in your browser settings.'
                  : permission === 'unsupported'
                    ? 'This browser doesn’t support notifications. Your inbox still works.'
                    : 'Get recurring due-date reminders while Finapp is open'
          }
          trailing={
            permission === 'default' ? (
              <Button size="sm" onPress={() => void requestPermission()}>
                Allow
              </Button>
            ) : null
          }
        />
      </SettingsGroup>
      {message || !isConnected ? (
        <p
          role="status"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-foreground-muted)' }}
        >
          {message || 'Offline: changes save here and sync when you reconnect.'}
        </p>
      ) : null}
    </SettingsShell>
  );
}
