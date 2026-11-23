import React from 'react';
import { router } from 'expo-router';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { notificationTypeLabels, notificationTypes } from '@convex/notifications/domain';
import {
  InvitationNotificationActions,
  NotificationsScreen,
  type NotificationListItem,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import {
  openNotification,
  toNotificationListItem,
  useVisibleNotifications,
} from '@/hooks/useNotifications';
import { promptForPushOnce } from '@/lib/push';
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationRecord,
} from '@/local/notification-events';

export default function NotificationsRoute() {
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { userId, isConnected } = useLocalSync();
  const incomingInvitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const { records, error: loadError, retry } = useVisibleNotifications(userId);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const byId = React.useMemo(
    () => new Map((records ?? []).map((record) => [record.id, record])),
    [records],
  );
  const items = React.useMemo(() => records?.map(toNotificationListItem), [records]);

  // Opening the inbox is the moment the user shows interest in updates: offer push once.
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    void promptForPushOnce(convex).catch(() => undefined);
  }, [convex, userId, isConnected]);

  async function run(action: () => Promise<void>, failure: string) {
    if (!userId || busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    } finally {
      setBusy(false);
    }
  }

  const record = (item: NotificationListItem): NotificationRecord | undefined => byId.get(item.id);

  return (
    <NotificationsScreen
      items={items}
      typeLabels={notificationTypeLabels}
      filterTypes={notificationTypes}
      error={error}
      loadError={loadError ? 'Saved activity could not be loaded.' : null}
      onRetry={retry}
      offline={!isConnected}
      busy={busy}
      topInset={insets.top}
      bottomInset={insets.bottom}
      onBack={() => router.back()}
      onOpenSettings={() => router.push('/settings/notifications')}
      onOpen={(item) => {
        const target = record(item);
        if (target && userId)
          void run(() => openNotification(userId, target), 'Could not open this notification.');
      }}
      onMarkRead={(item) => {
        const target = record(item);
        if (target && userId)
          void run(() => markNotificationAsRead(userId, target), 'Could not mark it as read.');
      }}
      onMarkAllRead={() => {
        if (userId && records)
          void run(
            () => markAllNotificationsAsRead(userId, records),
            'Could not mark every item as read.',
          );
      }}
      renderItemFooter={(item) =>
        item.entityType === 'groupInvitation' ? (
          <InvitationNotificationActions
            invitation={incomingInvitations?.find((invite) => invite.id === item.entityId)}
            onRespond={async (inviteId, response) => {
              if (!isConnected) {
                const message = 'You are offline. Reconnect to respond to this invitation.';
                setError(message);
                throw new Error(message);
              }
              await respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response });
            }}
          />
        ) : null
      }
    />
  );
}
