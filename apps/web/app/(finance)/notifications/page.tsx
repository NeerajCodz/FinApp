'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { notificationTypeLabels, notificationTypes } from '@convex/notifications/domain';
import {
  InvitationNotificationActions,
  NotificationsScreen,
  type NotificationListItem,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationPath,
  notificationRecordId,
  toNotificationListItem,
  useVisibleNotifications,
  type NotificationRecord,
} from '@/lib/notifications';

export default function NotificationsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const incomingInvitations = useQuery(
    api.groups.queries.incomingInvitations,
    userId && isConnected ? {} : 'skip',
  );
  const respondToInvitation = useMutation(api.groups.mutations.respondToInvitation);
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

  if (!userId)
    return (
      <FinanceSignedOut
        section="INBOX"
        title="Important updates, in one place."
        description="Sign in to see account, category limit, goal, group, and sync updates saved to your local inbox."
      />
    );
  const signedInUserId = userId;

  async function run(action: () => Promise<void>, failure: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
      return false;
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
      onRetry={() => window.location.reload()}
      offline={!isConnected}
      busy={busy}
      onBack={() => router.back()}
      onOpenSettings={() => router.push('/settings/notifications')}
      onOpen={(item) => {
        const target = record(item);
        if (!target) return;
        void run(
          () => markNotificationRead(signedInUserId, target),
          'Could not mark this update as read.',
        ).then((marked) => {
          const path = notificationPath(target);
          if (marked && path) router.push(path);
        });
      }}
      onMarkRead={(item) => {
        const target = record(item);
        if (target)
          void run(
            () => markNotificationRead(signedInUserId, target),
            'Could not mark this update as read.',
          );
      }}
      onMarkAllRead={() =>
        void run(
          () => markAllNotificationsRead(signedInUserId, records),
          'Could not mark updates as read.',
        )
      }
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
