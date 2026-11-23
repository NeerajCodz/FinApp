'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  markNotificationRead,
  notificationPath,
  notificationRecordId,
  useVisibleNotifications,
} from '@/lib/notifications';

const FRESH_WINDOW_MS = 5 * 60_000;

/** Shows a toast when a new notification syncs in while this tab is visible. */
export function NotificationToasts() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId } = useBrowserSync();
  const { records, loading } = useVisibleNotifications();
  const seen = React.useRef<{ userId: string; ids: Set<string> } | null>(null);
  const pathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    if (!userId || loading) return;
    if (seen.current?.userId !== userId) {
      seen.current = { userId, ids: new Set(records.map(notificationRecordId)) };
      return;
    }
    const ids = seen.current.ids;
    const fresh = records.filter((record) => !ids.has(notificationRecordId(record)));
    for (const record of fresh) ids.add(notificationRecordId(record));
    const recent = Date.now() - FRESH_WINDOW_MS;
    const unread = fresh.filter(
      (record) => record.readAt === undefined && Number(record.createdAt ?? 0) >= recent,
    );
    const newest = unread[0];
    if (!newest || document.visibilityState !== 'visible') return;
    if (pathnameRef.current === '/notifications') return;
    if (unread.length > 1) {
      toast(`${unread.length} new notifications`, {
        description: newest.title,
        action: { label: 'View', onClick: () => router.push('/notifications') },
      });
      return;
    }
    toast(newest.title ?? 'New notification', {
      description: newest.body,
      action: {
        label: 'View',
        onClick: () => {
          void markNotificationRead(userId, newest)
            .catch(() => undefined)
            .then(() => router.push(notificationPath(newest) ?? '/notifications'));
        },
      },
    });
  }, [loading, records, router, userId]);

  return null;
}
