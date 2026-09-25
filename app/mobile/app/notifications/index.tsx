import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { ArrowLeft, Bell, CaretRight, Gear } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { notificationRoute, normalizeNotificationPreferences,
  type NotificationType } from '@convex/notifications/domain';
import { Button, IconButton, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { markNotificationAsRead, type NotificationRecord } from '@/local/notification-events';
import type { LocalRecord } from '@/local/repository';

export default function NotificationsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, isConnected } = useLocalSync();
  const notifications = useLocalRecords<NotificationRecord>(userId, 'notification');
  const settings = useLocalRecords<LocalRecord>(userId, 'settings');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [error, setError] = React.useState('');
  const preferences = normalizeNotificationPreferences(settings.data?.[0]?.notificationPreferences);
  const entries = settings.data
    ? notifications.data?.filter((event) =>
        Object.prototype.hasOwnProperty.call(preferences, event.type) &&
        preferences[event.type as NotificationType])
        .sort((a, b) => b.createdAt - a.createdAt)
    : undefined;
  const unread = entries?.filter((event) => event.readAt === undefined).length ?? 0;
  const visible = unreadOnly ? entries?.filter((event) => event.readAt === undefined) : entries;

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
      for (const event of entries) if (event.readAt === undefined)
        await markNotificationAsRead(userId, event);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark every item as read.');
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32, gap: 22, flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title" style={{ flex: 1 }}>Notifications</Typography>
        <IconButton label="Notification settings" variant="ghost"
          onPress={() => router.push('/settings/notifications')}>
          <Gear size={20} color={tokens.foreground} />
        </IconButton>
      </View>
      {entries && <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="label">{unread > 0 ? `${unread} unread` : 'No unread activity'}</Typography>
          {unread > 0 && <Button variant="ghost" size="sm" onPress={() => void markAllRead()}>
            Mark all read
          </Button>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant={!unreadOnly ? 'secondary' : 'outline'} size="sm"
            accessibilityState={{ selected: !unreadOnly }} onPress={() => setUnreadOnly(false)}>All</Button>
          <Button variant={unreadOnly ? 'secondary' : 'outline'} size="sm"
            accessibilityState={{ selected: unreadOnly }} onPress={() => setUnreadOnly(true)}>Unread</Button>
        </View>
      </View>}
      {!!error && <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>{error}</Text>}
      {notifications.error && <View style={{ gap: 8 }}>
        <Text style={{ color: tokens.destructive }}>Saved activity could not be loaded.</Text>
        <Button variant="outline" onPress={notifications.retry}>Retry</Button>
      </View>}
      {settings.error && <View style={{ gap: 8 }}>
        <Text style={{ color: tokens.destructive }}>Notification preferences could not be loaded.</Text>
        <Button variant="outline" onPress={settings.retry}>Retry</Button>
      </View>}
      {(!notifications.data || !settings.data) && !notifications.error && !settings.error &&
        <Typography variant="small">Loading saved activity…</Typography>}
      {visible && visible.length > 0 && <View style={{ gap: 0 }}>
        {visible.map((event) => <TouchableOpacity key={event.id} accessibilityRole="button"
          accessibilityLabel={`${event.readAt === undefined ? 'Unread' : 'Read'}: ${event.title}. ${event.body}`}
          onPress={() => void open(event)} activeOpacity={0.68}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14,
            paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: tokens.borderSubtle }}>
          <View style={{ width: 42, height: 42, borderRadius: 14,
            backgroundColor: tokens.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={19} color={tokens.primary} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {event.readAt === undefined && <View style={{ width: 6, height: 6, borderRadius: 3,
                backgroundColor: tokens.primary }} />}
              <Typography variant="bodyLarge" numberOfLines={2} style={{ flex: 1 }}>{event.title}</Typography>
            </View>
            <Typography variant="small" numberOfLines={2}>{event.body}</Typography>
            <Typography variant="caption">{new Date(event.createdAt).toLocaleString()}</Typography>
          </View>
          <CaretRight size={16} color={tokens.foregroundSubtle} />
        </TouchableOpacity>)}
      </View>}
      {visible?.length === 0 && <View style={{ flex: 1, minHeight: 330,
        alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 }}>
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: tokens.surfaceRaised,
          alignItems: 'center', justifyContent: 'center' }}>
          <Bell size={32} color={tokens.primary} />
        </View>
        <Typography variant="heading" style={{ textAlign: 'center' }}>
          {unreadOnly ? 'Nothing unread' : 'No activity yet'}
        </Typography>
        <Text style={{ color: tokens.foregroundMuted, textAlign: 'center', maxWidth: 280 }}>
          {unreadOnly ? 'New items will show up here.' :
            'Budget limits, shared expenses, due reminders, and sync problems appear here when they happen.'}
        </Text>
        {!isConnected && <Typography variant="small" style={{ textAlign: 'center' }}>
          Offline · showing saved activity
        </Typography>}
      </View>}
    </ScrollView>
  );
}
