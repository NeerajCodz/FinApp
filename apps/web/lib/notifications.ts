'use client';

import * as React from 'react';
import {
  isNotificationType,
  isSafeNotificationUrl,
  normalizeNotificationPreferences,
  notificationRoute,
} from '@convex/notifications/domain';
import type { NotificationListItem } from '@finapp/ui/finance';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

export type NotificationRecord = LocalRecord & {
  type?: string;
  title?: string;
  body?: string;
  createdAt?: number;
  entityType?: string;
  entityId?: string;
  readAt?: number;
};
type SettingsRecord = LocalRecord & { notificationPreferences?: unknown };

export function notificationRecordId(record: LocalRecord): string {
  return String(record.id ?? record._id ?? '');
}

/** Saved notifications the user has not muted, newest first. */
export function useVisibleNotifications() {
  const notifications = useLocalRecords<NotificationRecord>('notification');
  const settings = useLocalRecords<SettingsRecord>('settings');
  const records = React.useMemo(() => {
    const preferences = normalizeNotificationPreferences(
      settings.records[0]?.notificationPreferences,
    );
    return notifications.records
      .filter(
        (record) =>
          isNotificationType(record.type) &&
          preferences[record.type] &&
          notificationRecordId(record) !== '',
      )
      .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0));
  }, [notifications.records, settings.records]);
  return {
    records,
    loading: notifications.loading || settings.loading,
    error: notifications.error ?? settings.error,
  };
}

export function useUnreadNotificationCount(): number {
  const { records } = useVisibleNotifications();
  return records.filter((record) => record.readAt === undefined).length;
}

export function toNotificationListItem(record: NotificationRecord): NotificationListItem {
  return {
    id: notificationRecordId(record),
    type: String(record.type ?? ''),
    title: record.title ?? 'Finapp update',
    body: record.body ?? 'Open Finapp to review this update.',
    createdAt: Number(record.createdAt ?? 0),
    readAt: record.readAt,
    entityType: typeof record.entityType === 'string' ? record.entityType : undefined,
    entityId: typeof record.entityId === 'string' ? record.entityId : undefined,
  };
}

/** In-app destination of a notification, or null when it has none. */
export function notificationPath(record: NotificationRecord): string | null {
  const url = notificationRoute({
    type: String(record.type ?? ''),
    entityType: typeof record.entityType === 'string' ? record.entityType : undefined,
    entityId: typeof record.entityId === 'string' ? record.entityId : undefined,
  });
  return isSafeNotificationUrl(url) && url !== '/notifications' ? url : null;
}

export async function markNotificationRead(userId: string, record: NotificationRecord) {
  if (record.readAt !== undefined) return;
  const id = notificationRecordId(record);
  await commitLocalWrite(
    userId,
    'notification',
    'notification.markRead',
    { ...record, readAt: Date.now() },
    { notificationId: String(record.cloudId ?? record._id ?? id) },
    { recordId: id },
  );
}

/** Marks every given unread notification read through one queued server call. */
export async function markAllNotificationsRead(
  userId: string,
  records: readonly NotificationRecord[],
) {
  const unread = records.filter((record) => record.readAt === undefined);
  const [first, ...rest] = unread;
  if (!first) return;
  const readAt = Date.now();
  await commitLocalWrite(
    userId,
    'notification',
    'notification.markAllRead',
    { ...first, readAt },
    { before: Math.max(...unread.map((record) => Number(record.createdAt ?? 0))) },
    {
      recordId: notificationRecordId(first),
      relatedRecords: rest.map((record) => ({
        entityType: 'notification' as const,
        record: { ...record, readAt },
      })),
    },
  );
}
