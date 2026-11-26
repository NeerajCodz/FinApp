'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  InvitationNotificationActions,
  NotificationsScreen,
  type FriendRequestStatus,
  type NotificationListItem,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  notificationPath,
  notificationRecordId,
  toNotificationListItem,
  useVisibleNotifications,
  type NotificationRecord,
} from '@/lib/notifications';

const OFFLINE_ANSWER = 'You are offline. Reconnect to answer this.';

export default function NotificationsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const incomingInvitations = useQuery(api.groups.queries.incomingInvitations, live ? {} : 'skip');
  const friendRequests = useQuery(api.social.queries.requests, live ? {} : 'skip');
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
  const respondToFriendRequest = useMutation(api.social.mutations.respondToRequest);
  const { records, loading, error: loadError } = useVisibleNotifications();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const byId = React.useMemo(
    () => new Map(records.map((record) => [notificationRecordId(record), record])),
    [records],
  );
  const items = React.useMemo(
    () => (loading ? undefined : records.map(toNotificationListItem)),
    [loading, records],
  );
  const pendingRequests = React.useMemo(
    () => new Set(friendRequests?.incoming.map((request) => String(request.requestId)) ?? []),
    [friendRequests],
  );

  if (!userId)
    return (
      <FinanceSignedOut
        section="INBOX"
        title="Important updates, in one place."
        description="Sign in to see shared expenses, settle-ups, friend requests and security alerts."
      />
    );
  const signedInUserId = userId;
  const record = (item: NotificationListItem): NotificationRecord | undefined => byId.get(item.id);

  async function attempt(action: () => Promise<void>, failure: string): Promise<boolean> {
    setError('');
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
      return false;
    }
  }
  const withRecord =
    (action: (userId: string, record: NotificationRecord) => Promise<void>, failure: string) =>
    (item: NotificationListItem) => {
      const target = record(item);
      if (target) void attempt(() => action(signedInUserId, target), failure);
    };

  return (
    <NotificationsScreen
      items={items}
      error={error}
      loadError={loadError ? 'Saved notifications could not be loaded.' : null}
      onRetry={() => window.location.reload()}
      offline={!isConnected}
      busy={busy}
      onBack={() => router.back()}
      onOpenSettings={() => router.push('/settings/notifications')}
      canOpen={(item) => {
        const target = record(item);
        return Boolean(target && notificationPath(target));
      }}
      onOpen={(item) => {
        const target = record(item);
        if (!target) return;
        const path = notificationPath(target);
        void attempt(
          () => markNotificationRead(signedInUserId, target),
          'Could not mark this notification as read.',
        ).then(() => {
          if (path) router.push(path);
        });
      }}
      onMarkRead={withRecord(markNotificationRead, 'Could not mark this notification as read.')}
      onMarkUnread={withRecord(
        markNotificationUnread,
        'Could not mark this notification as unread.',
      )}
      onDelete={withRecord(deleteNotification, 'Could not delete this notification.')}
      onMarkAllRead={() => {
        setBusy(true);
        void attempt(
          () => markAllNotificationsRead(signedInUserId, records),
          'Could not mark notifications as read.',
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
        if (target) await markNotificationRead(signedInUserId, target).catch(() => undefined);
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
