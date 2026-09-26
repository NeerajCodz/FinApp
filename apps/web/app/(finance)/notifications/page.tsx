'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bell, Check, Settings2 } from 'lucide-react';
import { Badge, Button, Card, Empty, SectionHeader } from '@finapp/ui/web';
import {
  notificationRoute,
  notificationTypes,
  normalizeNotificationPreferences,
  type NotificationType,
} from '@convex/notifications/domain';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type NotificationRecord = LocalRecord & {
  type?: string;
  title?: string;
  body?: string;
  createdAt?: number;
  entityType?: string;
  entityId?: string;
  readAt?: number;
};
type SettingsRecord = LocalRecord & { notificationPreferences?: unknown };

const labels: Record<NotificationType, string> = {
  transaction: 'Transactions',
  budget: 'Budget limits',
  goal: 'Goals',
  recurring: 'Recurring reminders',
  group: 'Groups & splits',
  settlement: 'Settlements',
  security: 'Security',
  sync: 'Sync problems',
};
function idOf(record: LocalRecord): string {
  return String(record.id ?? record._id ?? '');
}

export default function NotificationsPage() {
  const { userId, isConnected } = useBrowserSync();
  const notificationState = useLocalRecords<NotificationRecord>('notification');
  const router = useRouter();
  const settingsState = useLocalRecords<SettingsRecord>('settings');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<NotificationType | 'all'>('all');
  const [busy, setBusy] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const preferences = normalizeNotificationPreferences(
    settingsState.records[0]?.notificationPreferences,
  );
  const events = React.useMemo(
    () =>
      notificationState.records
        .filter(
          (event) =>
            notificationTypes.includes(event.type as NotificationType) &&
            preferences[event.type as NotificationType],
        )
        .sort((left, right) => Number(right.createdAt ?? 0) - Number(left.createdAt ?? 0)),
    [notificationState.records, preferences],
  );
  const visible = events.filter(
    (event) =>
      (!unreadOnly || event.readAt === undefined) &&
      (typeFilter === 'all' || event.type === typeFilter),
  );
  const unread = events.filter((event) => event.readAt === undefined).length;

  if (!userId)
    return (
      <FinanceSignedOut
        section="INBOX"
        title="Important updates, in one place."
        description="Sign in to see account, budget, goal, group, and sync updates saved to your local inbox."
      />
    );

  async function markRead(event: NotificationRecord): Promise<boolean> {
    if (!userId) return false;
    if (event.readAt !== undefined) return true;
    const id = idOf(event);
    if (!id) return false;
    setBusy(true);
    setErrorMessage('');
    try {
      await commitLocalWrite(
        userId,
        'notification',
        'notification.markRead',
        { ...event, readAt: Date.now() },
        { notificationId: String(event.cloudId ?? event._id ?? id) },
        { recordId: id },
      );
      return true;
    } catch (cause) {
      setErrorMessage(
        cause instanceof Error ? cause.message : 'Could not mark this update as read.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function markVisibleRead() {
    if (!userId || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      for (const event of visible) {
        if (event.readAt !== undefined) continue;
        const id = idOf(event);
        if (!id) continue;
        await commitLocalWrite(
          userId,
          'notification',
          'notification.markRead',
          { ...event, readAt: Date.now() },
          { notificationId: String(event.cloudId ?? event._id ?? id) },
          { recordId: id },
        );
      }
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not mark updates as read.');
    } finally {
      setBusy(false);
    }
  }

  if (notificationState.loading || settingsState.loading)
    return (
      <div className="finance-page">
        <p className="finance-muted" role="status">
          Loading your saved inbox…
        </p>
      </div>
    );

  const stateError = notificationState.error ?? settingsState.error;
  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">YOUR UPDATES</p>
          <h1>Notifications</h1>
          <p className="finance-muted">
            {events.length} updates · {unread} unread
          </p>
        </div>
        <Link className="finance-secondary-action" href="/settings/notifications">
          <Settings2 size={16} aria-hidden="true" /> Preferences
        </Link>
      </header>

      <Card className="finance-record-panel" style={{ display: 'grid', gap: 14 }}>
        <SectionHeader
          title={unread ? `${unread} unread` : 'You are all caught up'}
          action={<Bell size={17} aria-hidden="true" />}
        />
        <p className="finance-form-note">
          New updates appear in this inbox when your account syncs.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Button
            size="sm"
            variant={!unreadOnly ? 'secondary' : 'outline'}
            aria-pressed={!unreadOnly}
            onPress={() => setUnreadOnly(false)}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={unreadOnly ? 'secondary' : 'outline'}
            aria-pressed={unreadOnly}
            onPress={() => setUnreadOnly(true)}
          >
            Unread
          </Button>
          <label className="finance-form-field" style={{ marginLeft: 'auto', minWidth: 180 }}>
            <span>Notification type</span>
            <select
              aria-label="Notification type filter"
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(event.currentTarget.value as NotificationType | 'all')
              }
            >
              <option value="all">All types</option>
              {notificationTypes.map((type) => (
                <option key={type} value={type}>
                  {labels[type]}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={!visible.some((event) => event.readAt === undefined) || busy}
            onPress={() => void markVisibleRead()}
          >
            <Check size={15} aria-hidden="true" /> Mark visible read
          </Button>
        </div>
      </Card>

      {stateError && (
        <div role="alert">
          <p className="finance-form-error">
            {stateError === notificationState.error
              ? 'Saved notifications could not be loaded.'
              : 'Notification preferences could not be loaded.'}
          </p>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Reload inbox
          </Button>
        </div>
      )}
      {errorMessage && (
        <p className="finance-form-error" role="alert">
          {errorMessage}
        </p>
      )}
      {visible.length === 0 ? (
        <Empty
          title={
            unreadOnly
              ? 'Nothing unread'
              : typeFilter === 'all'
                ? 'No notifications yet'
                : `No ${labels[typeFilter].toLowerCase()} yet`
          }
          description={
            unreadOnly
              ? 'New unread updates will appear here.'
              : 'Budget changes, shared activity, reminders, and sync issues appear here when available.'
          }
          icon={<Bell size={20} aria-hidden="true" />}
        />
      ) : (
        <section aria-label="Notification updates" style={{ display: 'grid', gap: 10 }}>
          {visible.map((event) => {
            const id = idOf(event);
            const destination = notificationRoute({
              type: String(event.type ?? ''),
              ...(typeof event.entityType === 'string' ? { entityType: event.entityType } : {}),
              ...(typeof event.entityId === 'string' ? { entityId: event.entityId } : {}),
            });
            return (
              <Card key={id} className="finance-record-item" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <strong>{event.title ?? 'Finapp update'}</strong>
                    {event.readAt === undefined && <Badge variant="success">Unread</Badge>}
                  </div>
                  <small>{event.body ?? 'Open Finapp to review this update.'}</small>
                  <small>
                    {labels[event.type as NotificationType] ?? 'Update'} ·{' '}
                    {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Recently'}
                  </small>
                </div>
                <div
                  style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}
                >
                  {destination !== '/notifications' && (
                    <Link
                      className="finance-inline-link"
                      href={destination}
                      onClick={(clickEvent) => {
                        clickEvent.preventDefault();
                        void markRead(event).then((marked) => {
                          if (marked) router.push(destination);
                        });
                      }}
                    >
                      Open <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  )}
                  {event.readAt === undefined && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onPress={() => void markRead(event)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}
      {!isConnected && (
        <p className="finance-data-footnote">
          Offline · showing updates already saved in this browser. Changes will sync when connected.
        </p>
      )}
    </div>
  );
}
