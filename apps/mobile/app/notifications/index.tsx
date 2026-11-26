import React from 'react';
import { router } from 'expo-router';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { notificationRoute } from '@convex/notifications/domain';
import {
  InvitationNotificationActions,
  NotificationsScreen,
  type FriendRequestStatus,
  type NotificationListItem,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import {
  openNotification,
  toNotificationListItem,
  useVisibleNotifications,
} from '@/hooks/useNotifications';
import { appPathForNotificationUrl, promptForPushOnce } from '@/lib/push';
import {
  deleteNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsUnread,
  type NotificationRecord,
} from '@/local/notification-events';

const OFFLINE_ANSWER = 'You are offline. Reconnect to answer this.';

export default function NotificationsRoute() {
  const insets = useSafeAreaInsets();
  const convex = useConvex();
  const { userId, isConnected, retryNow } = useLocalSync();
  const live = Boolean(userId && isConnected);
  const incomingInvitations = useQuery(api.groups.queries.incomingInvitations, live ? {} : 'skip');
  const friendRequests = useQuery(api.social.queries.requests, live ? {} : 'skip');
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const respondToFriendRequest = useMutation(api.social.mutations.respondToRequest);
  const { records, error: loadError, retry } = useVisibleNotifications(userId);
  const [busy, setBusy] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState('');
  const byId = React.useMemo(
    () => new Map((records ?? []).map((record) => [record.id, record])),
    [records],
  );
  const items = React.useMemo(() => records?.map(toNotificationListItem), [records]);
  const pendingRequests = React.useMemo(
    () => new Set(friendRequests?.incoming.map((request) => String(request.requestId)) ?? []),
    [friendRequests],
  );

  // Opening the inbox is the moment the user shows interest in updates: offer push once.
  React.useEffect(() => {
    if (!userId || !isConnected) return;
    void promptForPushOnce(convex).catch(() => undefined);
  }, [convex, userId, isConnected]);

  const record = (item: NotificationListItem): NotificationRecord | undefined => byId.get(item.id);
  async function attempt(action: () => Promise<void>, failure: string) {
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    }
  }
  const withRecord =
    (action: (userId: string, record: NotificationRecord) => Promise<void>, failure: string) =>
    (item: NotificationListItem) => {
      const target = record(item);
      if (target && userId) void attempt(() => action(userId, target), failure);
    };

  return (
    <NotificationsScreen
      items={items}
      error={error}
      loadError={loadError ? 'Saved notifications could not be loaded.' : null}
      onRetry={retry}
      offline={!isConnected}
      busy={busy}
      topInset={insets.top}
      bottomInset={insets.bottom}
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace('/(tabs)/network' as never)
      }
      onOpenSettings={() => router.push('/settings/notifications')}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        retry();
        void retryNow()
          .catch(() => undefined)
          .finally(() => setRefreshing(false));
      }}
      canOpen={(item) => {
        const path = appPathForNotificationUrl(notificationRoute(item));
        return Boolean(path && path !== '/notifications');
      }}
      onOpen={withRecord(openNotification, 'Could not open this notification.')}
      onMarkRead={withRecord(markNotificationAsRead, 'Could not mark it as read.')}
      onMarkUnread={withRecord(markNotificationAsUnread, 'Could not mark it as unread.')}
      onDelete={withRecord(deleteNotification, 'Could not delete this notification.')}
      onMarkAllRead={() => {
        if (!userId || !records) return;
        setBusy(true);
        void attempt(
          () => markAllNotificationsAsRead(userId, records),
          'Could not mark every item as read.',
        ).finally(() => setBusy(false));
      }}
      friendRequestStatus={(item): FriendRequestStatus =>
        !live
          ? 'answered'
          : !friendRequests
            ? 'loading'
            : pendingRequests.has(item.entityId ?? '')
              ? 'pending'
              : 'answered'
      }
      onRespondToFriendRequest={async (item, response) => {
        if (!isConnected || !item.entityId) throw new Error(OFFLINE_ANSWER);
        await respondToFriendRequest({
          requestId: item.entityId as Id<'friendRequests'>,
          response,
        });
        const target = record(item);
        if (target && userId) await markNotificationAsRead(userId, target).catch(() => undefined);
      }}
      renderInvitationActions={(item) => (
        <InvitationNotificationActions
          invitation={incomingInvitations?.find((invite) => invite.id === item.entityId)}
          onRespond={async (inviteId, response) => {
            if (!isConnected) {
              setError(OFFLINE_ANSWER);
              throw new Error(OFFLINE_ANSWER);
            }
            await respondToInvitation({ inviteId: inviteId as Id<'groupInvites'>, response });
          }}
        />
      )}
    />
  );
}
