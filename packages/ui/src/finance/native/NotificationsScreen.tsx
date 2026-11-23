import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  HandCoins,
  MailOpen,
  ReceiptText,
  RefreshCw,
  Settings,
  ShieldAlert,
  Target,
  UsersRound,
  WalletCards,
  type LucideProps,
} from 'lucide-react-native';
import {
  Button,
  FadeIn,
  IconButton,
  IconTile,
  ListSkeleton,
  Text,
  Typography,
  toneColor,
  useTheme,
} from '@finapp/ui/native';
import { space, withAlpha } from '../../tokens';
import { FinanceEmptyState } from './FinanceEmptyState';
import {
  notificationIconKind,
  notificationSections,
  notificationTime,
  notificationTone,
  unreadCount,
  type NotificationIconKind,
  type NotificationListItem,
} from '../notifications';

const icons: Record<NotificationIconKind, React.ComponentType<LucideProps>> = {
  split: ReceiptText,
  settlement: HandCoins,
  reminder: BellRing,
  group: UsersRound,
  invitation: MailOpen,
  budget: WalletCards,
  goal: Target,
  recurring: CalendarClock,
  security: ShieldAlert,
  sync: RefreshCw,
  transaction: ArrowLeftRight,
  other: Bell,
};

export type NotificationsScreenProps = {
  /** `undefined` while saved notifications load. */
  items: readonly NotificationListItem[] | undefined;
  /** Label per notification type, e.g. from `notificationTypeLabels`. */
  typeLabels: Readonly<Record<string, string>>;
  /** Types offered as filters; omit to hide the type filter. */
  filterTypes?: readonly string[];
  error?: string | null;
  loadError?: string | null;
  onRetry?: () => void;
  offline?: boolean;
  busy?: boolean;
  topInset?: number;
  bottomInset?: number;
  onBack: () => void;
  onOpenSettings: () => void;
  /** Mark read and navigate; the screen calls it on row press. */
  onOpen: (item: NotificationListItem) => void;
  onMarkRead: (item: NotificationListItem) => void;
  onMarkAllRead: () => void;
  /** Extra content under a row, e.g. invitation actions. */
  renderItemFooter?: (item: NotificationListItem) => React.ReactNode;
};

function NotificationRow({
  item,
  label,
  busy,
  onOpen,
  onMarkRead,
  footer,
}: {
  item: NotificationListItem;
  label: string;
  busy?: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
  footer?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const unread = item.readAt === undefined;
  const tone = notificationTone(item.type);
  const Icon = icons[notificationIconKind(item)];
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${unread ? 'Unread' : 'Read'}: ${item.title}. ${item.body}`}
          accessibilityHint="Opens the related screen"
          disabled={busy}
          onPress={onOpen}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space.md,
            paddingVertical: space.md + 2,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <IconTile tone={tone} size={42}>
            <Icon size={19} color={toneColor(tokens, tone)} strokeWidth={1.9} />
          </IconTile>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text
                numberOfLines={2}
                style={{
                  flex: 1,
                  fontSize: 15,
                  lineHeight: 20,
                  color: unread ? tokens.foreground : tokens.foregroundMuted,
                  fontFamily: unread ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_500Medium',
                }}
              >
                {item.title}
              </Text>
              <Typography variant="caption">{notificationTime(item.createdAt)}</Typography>
              {unread ? (
                <View
                  accessible={false}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: tokens.primary,
                  }}
                />
              ) : null}
            </View>
            <Text
              numberOfLines={3}
              style={{ color: tokens.foregroundMuted, fontSize: 13, lineHeight: 19 }}
            >
              {item.body}
            </Text>
            <Text style={{ color: tokens.foregroundSubtle, fontSize: 11, lineHeight: 15 }}>
              {label}
            </Text>
          </View>
        </Pressable>
        {unread ? (
          <View style={{ paddingTop: space.sm }}>
            <IconButton
              label={`Mark “${item.title}” as read`}
              variant="ghost"
              disabled={busy}
              onPress={onMarkRead}
            >
              <Check size={17} color={tokens.foregroundMuted} />
            </IconButton>
          </View>
        ) : null}
      </View>
      {footer}
    </View>
  );
}

export function NotificationsScreen({
  items,
  typeLabels,
  filterTypes,
  error,
  loadError,
  onRetry,
  offline,
  busy,
  topInset = 0,
  bottomInset = 0,
  onBack,
  onOpenSettings,
  onOpen,
  onMarkRead,
  onMarkAllRead,
  renderItemFooter,
}: NotificationsScreenProps) {
  const { tokens } = useTheme();
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<string | null>(null);
  const unread = items ? unreadCount(items) : 0;
  const visible = items?.filter(
    (item) =>
      (!unreadOnly || item.readAt === undefined) && (!typeFilter || item.type === typeFilter),
  );
  const sections = React.useMemo(() => notificationSections(visible ?? []), [visible]);
  const filtered = unreadOnly || !!typeFilter;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: space.xl,
        paddingTop: topInset + space.md,
        paddingBottom: bottomInset + space.xxl,
        gap: space.lg + 2,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 }}>
        <IconButton label="Go back" variant="ghost" onPress={onBack}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, gap: 2 }}>
          <Typography variant="title">Notifications</Typography>
          <Typography variant="caption">
            {!items
              ? 'Your recent activity'
              : unread > 0
                ? `${unread} unread`
                : 'You’re all caught up'}
          </Typography>
        </View>
        {unread > 0 ? (
          <IconButton
            label="Mark all as read"
            variant="ghost"
            disabled={busy}
            onPress={onMarkAllRead}
          >
            <CheckCheck size={20} color={tokens.primary} />
          </IconButton>
        ) : null}
        <IconButton label="Notification settings" variant="ghost" onPress={onOpenSettings}>
          <Settings size={20} color={tokens.foreground} />
        </IconButton>
      </View>

      {items && items.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          <Button
            variant={!filtered ? 'primary' : 'outline'}
            size="sm"
            accessibilityState={{ selected: !filtered }}
            onPress={() => {
              setUnreadOnly(false);
              setTypeFilter(null);
            }}
          >
            All
          </Button>
          <Button
            variant={unreadOnly ? 'primary' : 'outline'}
            size="sm"
            accessibilityState={{ selected: unreadOnly }}
            onPress={() => setUnreadOnly((value) => !value)}
          >
            {unread > 0 ? `Unread · ${unread}` : 'Unread'}
          </Button>
          {filterTypes?.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? 'secondary' : 'outline'}
              size="sm"
              accessibilityState={{ selected: typeFilter === type }}
              onPress={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {typeLabels[type] ?? type}
            </Button>
          ))}
        </ScrollView>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Text>
      ) : null}
      {loadError ? (
        <View style={{ gap: space.sm }}>
          <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
            {loadError}
          </Text>
          {onRetry ? (
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          ) : null}
        </View>
      ) : null}

      {!items && !loadError ? <ListSkeleton rows={5} /> : null}

      {sections.map((section) => (
        <View key={section.key} style={{ gap: space.sm }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="label">{section.label}</Typography>
            <Typography variant="caption">
              {section.items.length} {section.items.length === 1 ? 'update' : 'updates'}
            </Typography>
          </View>
          <View
            style={{
              paddingHorizontal: space.md + 2,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.card,
            }}
          >
            {section.items.map((item, index) => (
              <FadeIn key={item.id} index={Math.min(index, 6)} distance={8}>
                {index > 0 ? (
                  <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
                ) : null}
                <View
                  style={
                    item.readAt === undefined
                      ? {
                          marginHorizontal: -(space.md + 2),
                          paddingHorizontal: space.md + 2,
                          backgroundColor: withAlpha(tokens.primary, 0.05),
                        }
                      : undefined
                  }
                >
                  <NotificationRow
                    item={item}
                    label={typeLabels[item.type] ?? 'Update'}
                    busy={busy}
                    onOpen={() => onOpen(item)}
                    onMarkRead={() => onMarkRead(item)}
                    footer={renderItemFooter?.(item)}
                  />
                </View>
              </FadeIn>
            ))}
          </View>
        </View>
      ))}

      {visible && visible.length === 0 ? (
        <FinanceEmptyState
          kind="activity"
          scene="notifications"
          title={filtered ? 'Nothing here' : 'No notifications yet'}
          description={
            filtered
              ? 'No updates match this filter. New ones will show up here.'
              : 'Shared expenses, settlements, reminders, and budget alerts will appear here.'
          }
          action={
            filtered ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setUnreadOnly(false);
                  setTypeFilter(null);
                }}
              >
                Show all
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {offline ? (
        <Typography variant="caption" style={{ textAlign: 'center' }}>
          Offline · showing saved activity
        </Typography>
      ) : null}
    </ScrollView>
  );
}
