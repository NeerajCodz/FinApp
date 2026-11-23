import React from 'react';
import { router } from 'expo-router';
import {
  isNotificationType,
  normalizeNotificationPreferences,
  notificationRoute,
} from '@convex/notifications/domain';
import type { NotificationListItem } from '@finapp/ui/finance';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { appPathForNotificationUrl } from '@/lib/push';
import { markNotificationAsRead, type NotificationRecord } from '@/local/notification-events';
import type { LocalRecord } from '@/local/repository';

/** Saved notifications the user has not muted, newest first; `undefined` while loading. */
export function useVisibleNotifications(userId: string | null) {
  const notifications = useLocalRecords<NotificationRecord>(userId, 'notification');
  const settings = useLocalRecords<LocalRecord>(userId, 'settings');
  const records = React.useMemo(() => {
    if (!notifications.data || !settings.data) return undefined;
    const preferences = normalizeNotificationPreferences(settings.data[0]?.notificationPreferences);
    return notifications.data
      .filter((record) => isNotificationType(record.type) && preferences[record.type])
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [notifications.data, settings.data]);
  return {
    records,
    error: notifications.error ?? settings.error,
    retry: () => {
      notifications.retry();
      settings.retry();
    },
  };
}

export function toNotificationListItem(record: NotificationRecord): NotificationListItem {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    body: record.body,
    createdAt: record.createdAt,
    readAt: record.readAt,
    entityType: record.entityType,
    entityId: record.entityId,
  };
}

export function useUnreadNotificationCount(userId: string | null): number {
  const { records } = useVisibleNotifications(userId);
  return records?.filter((record) => record.readAt === undefined).length ?? 0;
}

/** Marks a notification read, then follows its deep link (if it has one). */
export async function openNotification(userId: string, record: NotificationRecord) {
  await markNotificationAsRead(userId, record);
  const path = appPathForNotificationUrl(notificationRoute(record));
  if (path && path !== '/notifications') router.push(path as never);
}
