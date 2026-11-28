import React from 'react';
import { Linking } from 'react-native';
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
  type LucideIcon,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useConvex } from 'convex/react';
import { registerForPush } from '@/lib/push';
import {
  createPushRegistrationQueue,
  type PushRegistrationQueue,
  type PushRegistrationStatus,
} from '@/local/push-registration-queue';
import { Button } from '@finapp/ui/native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsScreen,
  SettingsSwitch,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import {
  permissionStatus,
  reconcileRecurringNotifications,
  requestNotificationPermission,
  saveNotificationPreferences,
} from '@/local/notification-events';
import {
  normalizeNotificationPreferences,
  type NotificationPreferences,
  type NotificationType,
} from '@convex/notifications/domain';

type Tone = 'primary' | 'positive' | 'warning' | 'danger' | 'info' | 'violet' | undefined;
type Option = {
  type: NotificationType;
  label: string;
  detail: string;
  Icon: LucideIcon;
  tone?: Tone;
};

const sections: { title: string; options: Option[] }[] = [
  {
    title: 'Your money',
    options: [
      {
        type: 'transaction',
        label: 'Transactions',
        detail: 'Each transaction you record',
        Icon: ReceiptText,
      },
      {
        type: 'budget',
        label: 'Category limits',
        detail: 'When a category’s spending crosses its alert level or limit',
        Icon: Gauge,
        tone: 'warning',
      },
      {
        type: 'goal',
        label: 'Goals',
        detail: 'When a savings target is reached',
        Icon: Target,
        tone: 'positive',
      },
      {
        type: 'recurring',
        label: 'Recurring payments',
        detail: 'Due dates for reminder-only rules',
        Icon: CalendarClock,
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
        detail: 'Group expenses you’re in',
        Icon: Split,
        tone: 'violet',
      },
      {
        type: 'settlement',
        label: 'Settlements',
        detail: 'Payments and settle-up reminders',
        Icon: HandCoins,
        tone: 'positive',
      },
      {
        type: 'group',
        label: 'Groups',
        detail: 'Invitations, joins and leaves',
        Icon: UsersRound,
        tone: 'info',
      },
      {
        type: 'social',
        label: 'Friends',
        detail: 'Friend requests and accepted requests',
        Icon: UserPlus,
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
        detail: 'New sign-ins, MCP apps and account changes',
        Icon: ShieldCheck,
        tone: 'danger',
      },
      {
        type: 'sync',
        label: 'Sync problems',
        detail: 'Changes that need your attention',
        Icon: RefreshCw,
      },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const tone = useSettingsToneColor();
  const { userId, isConnected } = useLocalSync();
  const convex = useConvex();
  const settings = useLocalRecords<LocalRecord>(userId, 'settings');
  const [preferences, setPreferences] = React.useState<NotificationPreferences | null>(null);
  const [permission, setPermission] = React.useState<'granted' | 'denied' | 'undetermined' | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const connectedRef = React.useRef(isConnected);
  connectedRef.current = isConnected;
  const convexRef = React.useRef(convex);
  convexRef.current = convex;
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (settings.data?.[0])
      setPreferences(normalizeNotificationPreferences(settings.data[0].notificationPreferences));
  }, [settings.data]);
  // OS permission is not the same as this device being registered for server pushes.
  const [registration, setRegistration] = React.useState<PushRegistrationStatus>('checking');
  const registrationQueue = React.useRef<PushRegistrationQueue | null>(null);
  if (!registrationQueue.current) {
    registrationQueue.current = createPushRegistrationQueue({
      isConnected: () => connectedRef.current,
      register: () => registerForPush(convexRef.current),
      setStatus: setRegistration,
    });
  }
  const register = React.useCallback(
    () => registrationQueue.current?.request() ?? Promise.resolve(),
    [],
  );
  React.useEffect(() => {
    if (permission === 'granted') void register();
  }, [permission, register]);
  React.useEffect(() => {
    void permissionStatus()
      .then(setPermission)
      .catch(() => setPermission('denied'));
  }, []);

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
    } finally {
      setSaving(false);
    }
  }

  async function enableDeviceDelivery() {
    try {
      const granted = await requestNotificationPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (granted && userId) {
        await reconcileRecurringNotifications(userId);
      }
    } catch {
      setError('Could not request notification permission.');
    }
  }

  const prefs = preferences;
  const all = sections.flatMap((section) => section.options);
  const enabled = prefs ? all.filter((option) => prefs[option.type]).length : 0;
  const pushDescription =
    permission === null
      ? 'Checking permission…'
      : permission === 'granted'
        ? registration === 'registered'
          ? 'On: alerts reach this phone even when Finapp is closed'
          : registration === 'checking'
            ? 'Registering this phone…'
            : registration === 'offline'
              ? 'Allowed. This phone registers once you’re online.'
              : 'Allowed, but this phone couldn’t be registered'
        : permission === 'denied'
          ? 'Blocked. Allow notifications for Finapp in your phone’s settings.'
          : 'Get alerts on this phone when Finapp is closed';
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <SettingsScreen title="Notifications" subtitle="What reaches your inbox" onBack={back}>
      <SettingsHero
        icon={<Bell size={22} color={tone('primary')} />}
        title={prefs ? `${enabled} of ${all.length} kinds on` : 'Notifications'}
        description="They appear in your inbox and the bell badge, and on this phone when push is on."
      />
      <SettingsGroup title="This phone">
        <SettingsItem
          icon={<BellRing size={19} color={tone('warning')} />}
          tone="warning"
          title="Push notifications"
          description={pushDescription}
          trailing={
            permission === 'undetermined' ? (
              <Button size="sm" onPress={() => void enableDeviceDelivery()}>
                Allow
              </Button>
            ) : permission === 'denied' ? (
              <Button size="sm" variant="outline" onPress={() => void Linking.openSettings()}>
                Settings
              </Button>
            ) : permission === 'granted' && registration === 'failed' ? (
              <Button size="sm" variant="outline" onPress={() => void register()}>
                Retry
              </Button>
            ) : null
          }
        />
      </SettingsGroup>
      {settings.error ? (
        <SettingsGroup>
          <SettingsLink
            title="Couldn’t load preferences"
            description="Tap to retry"
            onPress={settings.retry}
          />
        </SettingsGroup>
      ) : (
        sections.map((section) => (
          <SettingsGroup key={section.title} title={section.title}>
            {section.options.map(({ type, label, detail, Icon, tone: optionTone }) => (
              <SettingsSwitch
                key={type}
                icon={<Icon size={19} color={tone(optionTone)} />}
                tone={optionTone}
                title={label}
                description={detail}
                checked={prefs?.[type] ?? false}
                disabled={!prefs || saving}
                onChange={(value) => void change(type, value)}
              />
            ))}
          </SettingsGroup>
        ))
      )}
      {error || !isConnected ? (
        <SettingsGroup>
          <SettingsItem
            title={error ? 'Couldn’t save' : 'Offline'}
            description={error || 'Changes save on this phone and sync when you reconnect.'}
          />
        </SettingsGroup>
      ) : null}
    </SettingsScreen>
  );
}
