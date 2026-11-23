import React from 'react';
import { AppState } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useConvex } from 'convex/react';
import { toast } from '@/lib/toast';
import { pushSupported, registerForPush } from '@/lib/push';
import { openNotification, useVisibleNotifications } from '@/hooks/useNotifications';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const FRESH_WINDOW_MS = 5 * 60_000;

/**
 * App-wide notification side effects: keeps this device's push token registered for the
 * signed-in user, and shows an in-app toast when a new notification arrives while the app is
 * in the foreground.
 */
export function NotificationEffects() {
  const convex = useConvex();
  const pathname = usePathname();
  const { userId, isConnected } = useLocalSync();
  const { records } = useVisibleNotifications(userId);
  const seen = React.useRef<{ userId: string; ids: Set<string> } | null>(null);
  const pathnameRef = React.useRef(pathname);
  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  React.useEffect(() => {
    if (!userId || !isConnected || !pushSupported()) return;
    let active = true;
    let subscription: { remove: () => void } | null = null;
    const register = () =>
      registerForPush(convex).catch((error: unknown) => {
        console.warn('[push] Could not register this device.', error);
      });
    void register();
    void import('expo-notifications')
      .then((Notifications) => {
        if (!active) return;
        // Tokens can rotate; re-register whenever the OS hands out a new one.
        subscription = Notifications.addPushTokenListener(() => void register());
      })
      .catch(() => undefined);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [convex, userId, isConnected]);

  React.useEffect(() => {
    if (!userId || !records) return;
    if (seen.current?.userId !== userId) {
      seen.current = { userId, ids: new Set(records.map((record) => record.id)) };
      return;
    }
    const ids = seen.current.ids;
    const fresh = records.filter((record) => !ids.has(record.id));
    for (const record of fresh) ids.add(record.id);
    // Only genuinely new events: a first sync can bring in a backlog of older ones.
    const recent = Date.now() - FRESH_WINDOW_MS;
    const unread = fresh.filter(
      (record) => record.readAt === undefined && record.createdAt >= recent,
    );
    const newest = unread[0];
    if (!newest || AppState.currentState !== 'active') return;
    if (pathnameRef.current === '/notifications') return;
    if (unread.length > 1) {
      toast.info(`${unread.length} new notifications`, {
        description: newest.title,
        action: {
          label: 'View',
          onPress: () => router.push('/notifications'),
        },
      });
      return;
    }
    toast.info(newest.title, {
      description: newest.body,
      action: {
        label: 'View',
        onPress: () =>
          void openNotification(userId, newest).catch(() => {
            toast.error('Could not open this notification.');
          }),
      },
    });
  }, [records, userId]);

  return null;
}
