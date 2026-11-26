import { Platform } from 'react-native';
import { nextOccurrence, type Recurrence } from '@convex/recurring/domain';
import {
  defaultNotificationPreferences,
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@convex/notifications/domain';
import { commitLocalWrite } from './commands';
import {
  markDeviceNotificationRead,
  putLocalNotification,
  readLocal,
  updateDeviceNotification,
  type LocalRecord,
} from './repository';
import { isExpoGo } from './runtime';
async function loadNotifications() {
  return isExpoGo() ? null : import('expo-notifications');
}

export type NotificationRecord = LocalRecord & {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: number;
  entityType?: string;
  entityId?: string;
  readAt?: number;
  /** Set when deleted on this device; cloud records go away once the server confirms. */
  deletedAt?: number;
};

export type RecurringRecord = LocalRecord & {
  id: string;
  name: string;
  frequency: Recurrence;
  interval: number;
  nextOccurrence: number;
  enabled: boolean;
};

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences,
) {
  const settings = (await readLocal<LocalRecord>(userId, 'settings'))[0];
  if (!settings) throw new Error('Settings are not available offline yet. Connect and try again.');
  await commitLocalWrite(
    userId,
    'settings',
    'notification.preferences',
    { ...settings, notificationPreferences: preferences },
    { preferences },
    { recordId: String(settings.id ?? settings._id) },
  );
}

export async function markNotificationAsRead(userId: string, record: NotificationRecord) {
  if (record.readAt !== undefined) return;
  if (record.id.startsWith('local:')) {
    await markDeviceNotificationRead(userId, record.id);
    return;
  }
  await commitLocalWrite(
    userId,
    'notification',
    'notification.markRead',
    { ...record, readAt: Date.now() },
    { notificationId: String(record.cloudId ?? record._id ?? record.id) },
    { recordId: record.id },
  );
}

export async function markNotificationAsUnread(userId: string, record: NotificationRecord) {
  if (record.readAt === undefined) return;
  if (record.id.startsWith('local:')) {
    await updateDeviceNotification(userId, record.id, { readAt: null });
    return;
  }
  const { readAt: _readAt, ...unread } = record;
  await commitLocalWrite(
    userId,
    'notification',
    'notification.markUnread',
    unread,
    { notificationId: String(record.cloudId ?? record._id ?? record.id) },
    { recordId: record.id },
  );
}

/** Hides the notification at once; cloud notifications are also deleted on the server. */
export async function deleteNotification(userId: string, record: NotificationRecord) {
  const deletedAt = Date.now();
  if (record.id.startsWith('local:')) {
    await updateDeviceNotification(userId, record.id, { deletedAt });
    return;
  }
  await commitLocalWrite(
    userId,
    'notification',
    'notification.remove',
    { ...record, deletedAt },
    { notificationId: String(record.cloudId ?? record._id ?? record.id) },
    { recordId: record.id },
  );
}

/**
 * Marks every given unread notification read with one queued server call. Device-only
 * reminders (ids starting with `local:`) never reach the server and are updated in place.
 */
export async function markAllNotificationsAsRead(
  userId: string,
  records: readonly NotificationRecord[],
) {
  const unread = records.filter((record) => record.readAt === undefined);
  for (const record of unread)
    if (record.id.startsWith('local:')) await markDeviceNotificationRead(userId, record.id);
  const cloud = unread.filter((record) => !record.id.startsWith('local:'));
  const [first, ...rest] = cloud;
  if (!first) return;
  const readAt = Date.now();
  await commitLocalWrite(
    userId,
    'notification',
    'notification.markAllRead',
    { ...first, readAt },
    { before: Math.max(...cloud.map((record) => record.createdAt)) },
    {
      recordId: first.id,
      relatedRecords: rest.map((record) => ({
        entityType: 'notification' as const,
        record: { ...record, readAt },
      })),
    },
  );
}

export async function permissionStatus() {
  const Notifications = await loadNotifications();
  if (!Notifications) return 'denied' as const;
  const result = await Notifications.getPermissionsAsync();
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ? ('granted' as const)
    : result.canAskAgain
      ? ('undetermined' as const)
      : ('denied' as const);
}

export async function requestNotificationPermission() {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  const result = await Notifications.requestPermissionsAsync();
  return result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

const recurringPrefix = 'finapp-recurring:';

export async function clearDeviceReminders(userId: string) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if (item.identifier.startsWith(`${recurringPrefix}${userId}:`))
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
  }
}

export async function reconcileRecurringNotifications(userId: string, isActive?: () => boolean) {
  const [settings] = await readLocal<LocalRecord>(userId, 'settings');
  const preferences = settings
    ? normalizeNotificationPreferences(settings.notificationPreferences)
    : defaultNotificationPreferences;
  const rules = await readLocal<RecurringRecord>(userId, 'recurringRule');
  const now = Date.now();
  const future = new Map<string, { date: number; name: string }>();
  const userPrefix = `${recurringPrefix}${userId}:`;
  if (preferences.recurring)
    for (const rule of rules) {
      if (!rule.enabled || !Number.isFinite(rule.nextOccurrence) || rule.interval <= 0) continue;
      let next = rule.nextOccurrence;
      let latestDue: number | null = null;
      for (let i = 0; next <= now && i < 1024; i++) {
        latestDue = next;
        const later = nextOccurrence(next, rule.frequency, rule.interval);
        if (later <= next) break;
        next = later;
      }
      if (latestDue !== null)
        await putLocalNotification(userId, `recurring:${rule.id}:${latestDue}`, {
          type: 'recurring',
          title: `${rule.name} is due`,
          body: 'Review this recurring expense before recording it.',
          entityType: 'recurring',
          entityId: rule.id,
          createdAt: latestDue,
        });
      if (next > now && next < now + 30 * 86_400_000)
        future.set(`${userPrefix}${rule.id}:${next}`, { date: next, name: rule.name });
    }
  if (isActive && !isActive()) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) {
    if (item.identifier.startsWith(userPrefix) && !future.has(item.identifier))
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
  }
  if ((await permissionStatus()) !== 'granted') return;
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('recurring', {
      name: 'Recurring reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const existing = new Set(scheduled.map((item) => item.identifier));
  if (isActive && !isActive()) return;
  for (const [identifier, reminder] of future) {
    if (isActive && !isActive()) break;
    if (existing.has(identifier)) continue;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `${reminder.name} is due`,
        body: 'Review this recurring expense before recording it.',
        data: { url: '/recurring' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.date),
        channelId: Platform.OS === 'android' ? 'recurring' : undefined,
      },
    });
    if (isActive && !isActive()) break;
  }
  if (isActive && !isActive()) await clearDeviceReminders(userId);
}
