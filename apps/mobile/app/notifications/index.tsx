import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Bell, CaretRight, Gear } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  notificationRoute,
  normalizeNotificationPreferences,
  notificationTypes,
  type NotificationType,
} from '@convex/notifications/domain';
import { Button, IconButton, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { markNotificationAsRead, type NotificationRecord } from '@/local/notification-events';
import type { LocalRecord } from '@/local/repository';

const notificationLabels: Record<NotificationType, string> = {
  transaction: 'Transactions',
  budget: 'Budget limits',
  goal: 'Goals',
  recurring: 'Recurring',
  group: 'Groups & splits',
  settlement: 'Settlements',
  security: 'Security',
  sync: 'Sync problems',
};

function notificationDayLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const dateLabel = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (date.toDateString() === today.toDateString()) return `Today · ${dateLabel}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${dateLabel}`;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NotificationsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const notifications = useLocalRecords<NotificationRecord>(userId, 'notification');
  const settings = useLocalRecords<LocalRecord>(userId, 'settings');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [error, setError] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<NotificationType | null>(null);
  const preferences = normalizeNotificationPreferences(settings.data?.[0]?.notificationPreferences);
  const baseEntries = settings.data
    ? notifications.data
        ?.filter(
          (event) =>
            Object.prototype.hasOwnProperty.call(preferences, event.type) &&
            preferences[event.type as NotificationType],
        )
        .sort((a, b) => b.createdAt - a.createdAt)
    : undefined;
  const entries = typeFilter
    ? baseEntries?.filter((event) => event.type === typeFilter)
    : baseEntries;
  const unread = baseEntries?.filter((event) => event.readAt === undefined).length ?? 0;
  const visible = unreadOnly ? entries?.filter((event) => event.readAt === undefined) : entries;
  const days = React.useMemo(() => {
    const grouped = new Map<string, NotificationRecord[]>();
    for (const event of visible ?? []) {
      const key = new Date(event.createdAt).toDateString();
      const events = grouped.get(key) ?? [];
      events.push(event);
      grouped.set(key, events);
    }
    return [...grouped.values()].map((events) => ({
      label: notificationDayLabel(events[0]!.createdAt),
      events,
    }));
  }, [visible]);

  async function open(event: NotificationRecord) {
    if (!userId) return;
    try {
      await markNotificationAsRead(userId, event);
      const destination = notificationRoute(event);
      if (destination !== '/notifications') router.push(destination as never);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open this notification.');
    }
  }

  async function markAllRead() {
    if (!userId || !entries) return;
    try {
      for (const event of entries)
        if (event.readAt === undefined) await markNotificationAsRead(userId, event);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark every item as read.');
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 36,
        gap: 22,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="title">Notifications</Typography>
          <Typography variant="caption">
            {baseEntries ? `${baseEntries.length} updates` : 'Your recent activity'}
          </Typography>
        </View>
        <IconButton
          label="Notification settings"
          variant="ghost"
          onPress={() => router.push('/settings/notifications')}
        >
          <Gear size={20} color={tokens.foreground} />
        </IconButton>
      </View>

      {entries && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 58,
            paddingHorizontal: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceRaised,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Typography variant="bodyLarge">
              {unread > 0 ? `${unread} unread` : 'You’re all caught up'}
            </Typography>
            <Typography variant="caption">New updates appear here as they happen.</Typography>
          </View>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onPress={() => void markAllRead()}>
              Mark all read
            </Button>
          )}
        </View>
      )}

      {entries && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              variant={!unreadOnly ? 'secondary' : 'outline'}
              size="sm"
              accessibilityState={{ selected: !unreadOnly }}
              onPress={() => setUnreadOnly(false)}
            >
              All
            </Button>
            <Button
              variant={unreadOnly ? 'secondary' : 'outline'}
              size="sm"
              accessibilityState={{ selected: unreadOnly }}
              onPress={() => setUnreadOnly(true)}
            >
              Unread
            </Button>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingRight: 20 }}
          >
            <Button
              variant={!typeFilter ? 'primary' : 'outline'}
              size="sm"
              accessibilityState={{ selected: !typeFilter }}
              onPress={() => setTypeFilter(null)}
            >
              All types
            </Button>
            {notificationTypes.map((type) => (
              <Button
                key={type}
                variant={typeFilter === type ? 'secondary' : 'outline'}
                size="sm"
                accessibilityState={{ selected: typeFilter === type }}
                onPress={() => setTypeFilter(typeFilter === type ? null : type)}
              >
                {notificationLabels[type]}
              </Button>
            ))}
          </ScrollView>
        </View>
      )}

      {!!error && (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Text>
      )}
      {notifications.error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.destructive }}>Saved activity could not be loaded.</Text>
          <Button variant="outline" onPress={notifications.retry}>
            Retry
          </Button>
        </View>
      )}
      {settings.error && (
        <View style={{ gap: 8 }}>
          <Text style={{ color: tokens.destructive }}>
            Notification preferences could not be loaded.
          </Text>
          <Button variant="outline" onPress={settings.retry}>
            Retry
          </Button>
        </View>
      )}
      {(!notifications.data || !settings.data) && !notifications.error && !settings.error && (
        <Typography variant="small">Loading saved activity…</Typography>
      )}

      {visible && visible.length > 0 && (
        <View style={{ gap: 22 }}>
          {days.map(({ label, events }) => (
            <View key={label} style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: 4,
                }}
              >
                <Typography variant="label">{label}</Typography>
                <Typography variant="caption">{events.length} updates</Typography>
              </View>
              <View
                style={{
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: tokens.borderSubtle,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              >
                {events.map((event, index) => {
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
                    <React.Fragment key={event.id}>
                      {index > 0 && (
                        <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
                      )}
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel={`${event.readAt === undefined ? 'Unread' : 'Read'}: ${event.title}. ${event.body}. ${new Date(event.createdAt).toLocaleString()}`}
                        onPress={() => void open(event)}
                        activeOpacity={0.72}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'flex-start',
                          gap: 12,
                          paddingVertical: 15,
                        }}
                      >
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            backgroundColor: tokens.surfaceRaised,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Bell size={19} color={iconColor} />
                        </View>
                        <View style={{ flex: 1, gap: 5 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <Typography variant="bodyLarge" numberOfLines={2} style={{ flex: 1 }}>
                              {event.title}
                            </Typography>
                            <Typography variant="caption" style={{ paddingTop: 3 }}>
                              {new Date(event.createdAt).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </Typography>
                          </View>
                          <Typography variant="small">{event.body}</Typography>
                          <Typography variant="caption">
                            {notificationLabels[event.type as NotificationType] ?? 'Update'}
                          </Typography>
                        </View>
                        {event.readAt === undefined ? (
                          <View
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 4,
                              backgroundColor: tokens.primary,
                              marginTop: 7,
                            }}
                          />
                        ) : (
                          <CaretRight
                            size={16}
                            color={tokens.foregroundSubtle}
                            style={{ marginTop: 4 }}
                          />
                        )}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {visible?.length === 0 && (
        <View
          style={{
            flex: 1,
            minHeight: 260,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 22,
              backgroundColor: tokens.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={28} color={tokens.primary} />
          </View>
          <Typography variant="heading" style={{ textAlign: 'center' }}>
            {unreadOnly
              ? 'Nothing unread'
              : typeFilter
                ? `No ${notificationLabels[typeFilter].toLowerCase()} yet`
                : 'No notifications yet'}
          </Typography>
          <Text style={{ color: tokens.foregroundMuted, textAlign: 'center', maxWidth: 280 }}>
            {unreadOnly
              ? 'New unread updates will appear in this list.'
              : typeFilter
                ? `No ${notificationLabels[typeFilter].toLowerCase()} match these filters.`
                : 'Budget changes, shared expenses, reminders, and sync issues will appear here.'}
          </Text>
          {!isConnected && (
            <Typography variant="small" style={{ textAlign: 'center' }}>
              Offline · showing saved activity
            </Typography>
          )}
        </View>
      )}
    </ScrollView>
  );
}
