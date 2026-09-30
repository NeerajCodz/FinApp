'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell, Check, ChevronRight, Settings2 } from 'lucide-react';
import { Button, Card, Empty, IconButton, Text, Typography, useTheme } from '@finapp/ui/web';
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
  recurring: 'Recurring',
  group: 'Groups & splits',
  settlement: 'Settlements',
  security: 'Security',
  sync: 'Sync problems',
};
function idOf(record: LocalRecord): string {
  return String(record.id ?? record._id ?? '');
}

function notificationDayLabel(timestamp: number) {
  const date = new Date(timestamp);
  const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return `Today · ${dateLabel}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${dateLabel}`;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export default function NotificationsPage() {
  const { userId, isConnected } = useBrowserSync();
  const notificationState = useLocalRecords<NotificationRecord>('notification');
  const router = useRouter();
  const settingsState = useLocalRecords<SettingsRecord>('settings');
  const { tokens } = useTheme();
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
  const days = React.useMemo(() => {
    const grouped = new Map<string, NotificationRecord[]>();
    for (const event of visible) {
      const key = new Date(Number(event.createdAt ?? 0)).toDateString();
      const day = grouped.get(key) ?? [];
      day.push(event);
      grouped.set(key, day);
    }
    return [...grouped].map(([key, day]) => ({
      key,
      label: notificationDayLabel(Number(day[0]?.createdAt ?? 0)),
      events: day,
    }));
  }, [visible]);
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

  async function markAllRead() {
    if (!userId || busy) return;
    setBusy(true);
    setErrorMessage('');
    try {
      for (const event of events) {
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

  return (
    <div className="finance-page" style={{ gap: 22 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <div style={{ display: 'grid', flex: 1, gap: 2 }}>
          <Typography variant="title">Notifications</Typography>
          <Typography variant="caption">
            {events ? `${events.length} updates` : 'Your recent activity'}
          </Typography>
        </div>
        <IconButton
          label="Notification settings"
          variant="ghost"
          onPress={() => router.push('/settings/notifications')}
        >
          <Settings2 size={20} aria-hidden="true" />
        </IconButton>
      </header>

      {events && (
        <div
          style={{
            display: 'flex',
            minHeight: 58,
            alignItems: 'center',
            gap: 12,
            padding: '10px 16px',
            border: `1px solid ${tokens.borderSubtle}`,
            borderRadius: 16,
            background: tokens.surfaceRaised,
          }}
        >
          <div style={{ display: 'grid', flex: 1, gap: 3 }}>
            <Typography variant="bodyLarge">
              {unread > 0 ? `${unread} unread` : 'You’re all caught up'}
            </Typography>
            <Typography variant="caption">New updates appear here as they happen.</Typography>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" disabled={busy} onPress={() => void markAllRead()}>
              <Check size={15} aria-hidden="true" /> Mark all read
            </Button>
          )}
        </div>
      )}

      {events && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={!unreadOnly ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={!unreadOnly}
              onPress={() => setUnreadOnly(false)}
            >
              All
            </Button>
            <Button
              variant={unreadOnly ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={unreadOnly}
              onPress={() => setUnreadOnly(true)}
            >
              Unread
            </Button>
          </div>
          <div
            aria-label="Notification type"
            style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}
          >
            <Button
              variant={typeFilter === 'all' ? 'primary' : 'outline'}
              size="sm"
              aria-pressed={typeFilter === 'all'}
              onPress={() => setTypeFilter('all')}
            >
              All types
            </Button>
            {notificationTypes.map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={typeFilter === type}
                onPress={() => setTypeFilter(typeFilter === type ? 'all' : type)}
              >
                {labels[type]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {notificationState.error && (
        <div role="alert" style={{ display: 'grid', gap: 8 }}>
          <Text style={{ color: tokens.destructive }}>Saved activity could not be loaded.</Text>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}
      {settingsState.error && (
        <div role="alert" style={{ display: 'grid', gap: 8 }}>
          <Text style={{ color: tokens.destructive }}>
            Notification preferences could not be loaded.
          </Text>
          <Button variant="outline" onPress={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      )}
      {errorMessage && (
        <Text role="alert" style={{ color: tokens.destructive }}>
          {errorMessage}
        </Text>
      )}
      {(notificationState.loading || settingsState.loading) &&
        !notificationState.error &&
        !settingsState.error && <Typography variant="small">Loading saved activity…</Typography>}

      {visible.length > 0 && (
        <section aria-label="Notification updates" style={{ display: 'grid', gap: 22 }}>
          {days.map(({ key, label, events: dayEvents }) => (
            <section key={key} aria-label={label} style={{ display: 'grid', gap: 8 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Typography variant="label">{label}</Typography>
                <Typography variant="caption">{dayEvents.length} updates</Typography>
              </div>
              <Card
                variant="subtle"
                style={{
                  display: 'grid',
                  gap: 0,
                  padding: '0 14px',
                  borderRadius: 18,
                  border: `1px solid ${tokens.borderSubtle}`,
                }}
              >
                {dayEvents.map((event, index) => {
                  const destination = notificationRoute({
                    type: String(event.type ?? ''),
                    ...(typeof event.entityType === 'string'
                      ? { entityType: event.entityType }
                      : {}),
                    ...(typeof event.entityId === 'string' ? { entityId: event.entityId } : {}),
                  });
                  const iconColor =
                    event.type === 'transaction'
                      ? tokens.expense
                      : event.type === 'budget'
                        ? tokens.warning
                        : event.type === 'group'
                          ? tokens.split
                          : event.type === 'settlement'
                            ? tokens.settlement
                            : event.type === 'sync'
                              ? tokens.destructive
                              : event.type === 'recurring'
                                ? tokens.transfer
                                : tokens.primary;
                  return (
                    <React.Fragment key={idOf(event)}>
                      {index > 0 && <div style={{ height: 1, background: tokens.borderSubtle }} />}
                      <button
                        type="button"
                        aria-label={`${event.readAt === undefined ? 'Unread' : 'Read'}: ${event.title ?? 'Finapp update'}. ${event.body ?? 'Open Finapp to review this update.'}. ${new Date(Number(event.createdAt ?? 0)).toLocaleString()}`}
                        disabled={busy}
                        onClick={() => {
                          void markRead(event).then((marked) => {
                            if (marked && destination !== '/notifications')
                              router.push(destination);
                          });
                        }}
                        style={{
                          display: 'flex',
                          width: '100%',
                          minWidth: 0,
                          alignItems: 'flex-start',
                          gap: 12,
                          border: 0,
                          padding: '15px 0',
                          background: 'transparent',
                          color: 'inherit',
                          font: 'inherit',
                          textAlign: 'left',
                          cursor: busy ? 'default' : 'pointer',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'grid',
                            width: 42,
                            height: 42,
                            flex: '0 0 42px',
                            placeItems: 'center',
                            borderRadius: 14,
                            background: tokens.surfaceRaised,
                          }}
                        >
                          <Bell size={19} color={iconColor} />
                        </span>
                        <span style={{ display: 'grid', flex: 1, minWidth: 0, gap: 5 }}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <Typography variant="bodyLarge">
                              {event.title ?? 'Finapp update'}
                            </Typography>
                            <Typography variant="caption" style={{ paddingTop: 3 }}>
                              {event.createdAt
                                ? new Date(event.createdAt).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                : 'Recently'}
                            </Typography>
                          </span>
                          <Typography variant="small">
                            {event.body ?? 'Open Finapp to review this update.'}
                          </Typography>
                          <Typography variant="caption">
                            {labels[event.type as NotificationType] ?? 'Update'}
                          </Typography>
                        </span>
                        {event.readAt === undefined ? (
                          <span
                            aria-label="Unread"
                            style={{
                              width: 7,
                              height: 7,
                              flex: '0 0 7px',
                              marginTop: 7,
                              borderRadius: 4,
                              background: tokens.primary,
                            }}
                          />
                        ) : (
                          <ChevronRight
                            size={16}
                            color={tokens.foregroundSubtle}
                            style={{ flex: '0 0 auto', marginTop: 4 }}
                          />
                        )}
                      </button>
                    </React.Fragment>
                  );
                })}
              </Card>
            </section>
          ))}
        </section>
      )}

      {visible.length === 0 && !notificationState.loading && !settingsState.loading && (
        <Empty
          title={
            unreadOnly
              ? 'Nothing unread'
              : typeFilter !== 'all'
                ? `No ${labels[typeFilter].toLowerCase()} yet`
                : 'No notifications yet'
          }
          description={
            unreadOnly
              ? 'New unread updates will appear in this list.'
              : typeFilter !== 'all'
                ? `No ${labels[typeFilter].toLowerCase()} match these filters.`
                : 'Budget changes, shared expenses, reminders, and sync issues will appear here.'
          }
          icon={<Bell size={20} aria-hidden="true" />}
        />
      )}
      {!isConnected && <Text>Offline · showing saved activity</Text>}
    </div>
  );
}
