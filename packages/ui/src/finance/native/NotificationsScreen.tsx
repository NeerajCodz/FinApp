import React from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  CircleDot,
  HandCoins,
  MailOpen,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Target,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  WalletCards,
  WifiOff,
  type LucideProps,
} from 'lucide-react-native';
import { ArrowLeft } from '@finapp/ui/icons/native';
import { IconTile, Text, toneColor, useTheme } from '@finapp/ui/native';
import { withAlpha } from '../../tokens';
import { FinanceEmptyState } from './FinanceEmptyState';
import { SettingsIconButton } from './SettingsKit';
import {
  notificationAction,
  notificationEmptyCopy,
  notificationIconKind,
  notificationKindLabel,
  notificationTime,
  notificationTimestamp,
  notificationTone,
  type NotificationIconKind,
  type NotificationListItem,
} from '../notifications';
import { useNotificationInbox } from '../useNotificationInbox';

const icons: Record<NotificationIconKind, React.ComponentType<LucideProps>> = {
  split: ReceiptText,
  settlement: HandCoins,
  reminder: BellRing,
  group: UsersRound,
  invitation: MailOpen,
  friend: UserCheck,
  friendRequest: UserPlus,
  budget: WalletCards,
  goal: Target,
  recurring: CalendarClock,
  security: ShieldAlert,
  sync: RefreshCw,
  transaction: ArrowLeftRight,
  other: Bell,
};

/** Where a friend request stands: answerable, already handled, or not known yet. */
export type FriendRequestStatus = 'pending' | 'answered' | 'loading';

export type NotificationsScreenProps = {
  /** `undefined` while saved notifications load. */
  items: readonly NotificationListItem[] | undefined;
  error?: string | null;
  loadError?: string | null;
  onRetry?: () => void;
  offline?: boolean;
  busy?: boolean;
  topInset?: number;
  bottomInset?: number;
  onBack?: () => void;
  onOpenSettings: () => void;
  /** Pull to refresh (e.g. run a sync); the spinner shows while `refreshing`. */
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpen: (item: NotificationListItem) => void;
  canOpen?: (item: NotificationListItem) => boolean;
  onMarkRead: (item: NotificationListItem) => void;
  onMarkUnread: (item: NotificationListItem) => void;
  /** Sent after the undo window closes. */
  onDelete: (item: NotificationListItem) => void;
  onMarkAllRead: () => void;
  friendRequestStatus?: (item: NotificationListItem) => FriendRequestStatus;
  onRespondToFriendRequest?: (
    item: NotificationListItem,
    response: 'accept' | 'decline',
  ) => Promise<void>;
  renderInvitationActions?: (item: NotificationListItem) => React.ReactNode;
  now?: number;
};

const SWIPE_COMMIT = 96;

/** Swipe left to delete, right to toggle read; the actions show underneath while dragging. */
function SwipeRow({
  unread,
  onDelete,
  onToggleRead,
  children,
}: {
  unread: boolean;
  onDelete: () => void;
  onToggleRead: () => void;
  children: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const x = React.useRef(new Animated.Value(0)).current;
  const handlers = React.useRef({ onDelete, onToggleRead });
  React.useEffect(() => {
    handlers.current = { onDelete, onToggleRead };
  }, [onDelete, onToggleRead]);
  const settle = React.useCallback(
    () => Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start(),
    [x],
  );
  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
        onPanResponderMove: (_, gesture) =>
          x.setValue(Math.max(-width, Math.min(width * 0.45, gesture.dx))),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -SWIPE_COMMIT) {
            Animated.timing(x, { toValue: -width, duration: 170, useNativeDriver: true }).start(
              () => {
                handlers.current.onDelete();
                x.setValue(0);
              },
            );
            return;
          }
          if (gesture.dx > SWIPE_COMMIT) handlers.current.onToggleRead();
          settle();
        },
        onPanResponderTerminate: settle,
      }),
    [settle, width, x],
  );
  const leftOpacity = x.interpolate({
    inputRange: [0, 40],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rightOpacity = x.interpolate({
    inputRange: [-40, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  return (
    <View style={{ overflow: 'hidden', borderRadius: 16 }}>
      <Animated.View
        accessible={false}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 22,
          borderRadius: 16,
          backgroundColor: withAlpha(tokens.primary, 0.18),
          opacity: leftOpacity,
        }}
      >
        {unread ? (
          <CheckCheck size={20} color={tokens.primary} />
        ) : (
          <CircleDot size={20} color={tokens.primary} />
        )}
        <Text style={{ marginLeft: 8, color: tokens.primary, fontFamily: 'Manrope_700Bold' }}>
          {unread ? 'Read' : 'Unread'}
        </Text>
      </Animated.View>
      <Animated.View
        accessible={false}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: 22,
          borderRadius: 16,
          backgroundColor: tokens.destructive,
          opacity: rightOpacity,
        }}
      >
        <Text
          style={{
            marginRight: 8,
            color: tokens.destructiveForeground,
            fontFamily: 'Manrope_700Bold',
          }}
        >
          Delete
        </Text>
        <Trash2 size={20} color={tokens.destructiveForeground} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function ChipButton({
  label,
  primary,
  disabled,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        minHeight: 36,
        paddingHorizontal: 16,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: primary ? tokens.primary : tokens.borderSubtle,
        backgroundColor: primary ? tokens.primary : 'transparent',
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          color: primary ? tokens.primaryForeground : tokens.foreground,
          fontSize: 13,
          fontFamily: 'Manrope_700Bold',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FriendRequestActions({
  item,
  status,
  onRespond,
}: {
  item: NotificationListItem;
  status: FriendRequestStatus;
  onRespond?: (item: NotificationListItem, response: 'accept' | 'decline') => Promise<void>;
}) {
  const { tokens } = useTheme();
  const [busy, setBusy] = React.useState<'accept' | 'decline' | null>(null);
  const [result, setResult] = React.useState<'accepted' | 'declined' | null>(null);
  const [error, setError] = React.useState('');
  const note = (text: string) => (
    <Text accessibilityLiveRegion="polite" style={{ color: tokens.foregroundMuted, fontSize: 12 }}>
      {text}
    </Text>
  );
  if (result) return note(result === 'accepted' ? 'You’re now friends.' : 'Request declined.');
  if (status === 'loading')
    return (
      <View
        style={{ width: 150, height: 36, borderRadius: 11, backgroundColor: tokens.surfaceSubtle }}
      />
    );
  if (status === 'answered' || !onRespond) return note('This request has been answered.');
  const respond = async (response: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(response);
    setError('');
    try {
      await onRespond(item, response);
      setResult(response === 'accept' ? 'accepted' : 'declined');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not answer this request.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <ChipButton
          primary
          label={busy === 'accept' ? 'Accepting…' : 'Accept'}
          disabled={busy !== null}
          onPress={() => void respond('accept')}
        />
        <ChipButton
          label={busy === 'decline' ? 'Declining…' : 'Decline'}
          disabled={busy !== null}
          onPress={() => void respond('decline')}
        />
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive, fontSize: 12 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function NotificationRow({
  item,
  now,
  openable,
  extra,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  item: NotificationListItem;
  now: number;
  openable: boolean;
  extra: React.ReactNode;
  onOpen: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const { tokens } = useTheme();
  const unread = item.readAt === undefined;
  const tone = notificationTone(item);
  const Icon = icons[notificationIconKind(item)];
  const kind = notificationKindLabel(item.type);
  const action = notificationAction(item);
  return (
    <SwipeRow unread={unread} onDelete={onDelete} onToggleRead={onToggleRead}>
      <View
        style={{
          backgroundColor: tokens.card,
          borderRadius: 16,
        }}
      >
        <View
          style={{
            backgroundColor: unread ? withAlpha(tokens.primary, 0.06) : 'transparent',
            borderRadius: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unread ? 'Unread. ' : ''}${kind}: ${item.title}. ${item.body}. ${notificationTimestamp(item.createdAt)}`}
            accessibilityHint={openable ? 'Opens the related screen' : undefined}
            accessibilityActions={[
              { name: 'toggleRead', label: unread ? 'Mark as read' : 'Mark as unread' },
              { name: 'delete', label: 'Delete' },
            ]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'toggleRead') onToggleRead();
              if (event.nativeEvent.actionName === 'delete') onDelete();
            }}
            onPress={openable ? onOpen : onToggleRead}
            onLongPress={onToggleRead}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              paddingHorizontal: 14,
              paddingTop: 14,
              paddingBottom: extra ? 8 : 14,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <View>
              <IconTile tone={tone} size={44}>
                <Icon size={19} color={toneColor(tokens, tone)} strokeWidth={1.9} />
              </IconTile>
              {unread ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: tokens.card,
                    backgroundColor: tokens.primary,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    color: tokens.foregroundMuted,
                    fontSize: 11.5,
                    fontFamily: 'Manrope_700Bold',
                    letterSpacing: 0.2,
                  }}
                >
                  {kind}
                </Text>
                <Text style={{ color: tokens.foregroundSubtle, fontSize: 11.5 }}>·</Text>
                <Text style={{ color: tokens.foregroundMuted, fontSize: 11.5 }}>
                  {notificationTime(item.createdAt, now)}
                </Text>
              </View>
              <Text
                style={{
                  color: unread ? tokens.foreground : tokens.foregroundMuted,
                  fontSize: 15,
                  lineHeight: 20,
                  fontFamily: unread ? 'SpaceGrotesk_600SemiBold' : 'SpaceGrotesk_500Medium',
                }}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={3}
                style={{ color: tokens.foregroundMuted, fontSize: 13, lineHeight: 19 }}
              >
                {item.body}
              </Text>
              {action.kind === 'open' && openable ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Text
                    style={{ color: tokens.primary, fontSize: 12.5, fontFamily: 'Manrope_700Bold' }}
                  >
                    {action.label}
                  </Text>
                  <ArrowRight size={13} color={tokens.primary} />
                </View>
              ) : null}
            </View>
          </Pressable>
          {extra ? (
            <View style={{ paddingLeft: 70, paddingRight: 14, paddingBottom: 14 }}>{extra}</View>
          ) : null}
        </View>
      </View>
    </SwipeRow>
  );
}

function InboxSkeleton() {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityLabel="Loading notifications"
      style={{
        gap: 4,
        padding: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: tokens.borderSubtle,
        backgroundColor: tokens.card,
      }}
    >
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} style={{ flexDirection: 'row', gap: 12, padding: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: tokens.surfaceSubtle,
            }}
          />
          <View style={{ flex: 1, gap: 8, paddingTop: 2 }}>
            {[30, 70 - index * 6, 88 - index * 4].map((width, line) => (
              <View
                key={line}
                style={{
                  width: `${width}%`,
                  height: 10,
                  borderRadius: 6,
                  backgroundColor: tokens.surfaceSubtle,
                }}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export function NotificationsScreen({
  items,
  error,
  loadError,
  onRetry,
  offline,
  busy,
  topInset = 0,
  bottomInset = 0,
  onBack,
  onOpenSettings,
  onRefresh,
  refreshing = false,
  onOpen,
  canOpen,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onMarkAllRead,
  friendRequestStatus,
  onRespondToFriendRequest,
  renderInvitationActions,
  now: fixedNow,
}: NotificationsScreenProps) {
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  const inbox = useNotificationInbox({ items, onDelete, now: fixedNow });
  const maxWidth = width >= 820 ? 760 : undefined;

  const remove = (item: NotificationListItem) => {
    inbox.remove(item);
    AccessibilityInfo.announceForAccessibility?.('Notification deleted. Undo is available.');
  };
  const extraFor = (item: NotificationListItem): React.ReactNode => {
    const action = notificationAction(item);
    if (action.kind === 'friendRequest')
      return (
        <FriendRequestActions
          item={item}
          status={friendRequestStatus?.(item) ?? 'answered'}
          onRespond={onRespondToFriendRequest}
        />
      );
    if (action.kind === 'invitation') return renderInvitationActions?.(item) ?? null;
    return null;
  };

  const subtitle = !items
    ? 'Loading your updates…'
    : inbox.unread > 0
      ? `${inbox.unread} unread · ${inbox.total} total`
      : inbox.total > 0
        ? 'You’re all caught up'
        : 'Updates from your money and your people';
  const emptyCopy = notificationEmptyCopy(inbox.filter);

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {onBack ? (
          <SettingsIconButton label="Go back" onPress={onBack}>
            <ArrowLeft size={20} color={tokens.foreground} />
          </SettingsIconButton>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={{
              color: tokens.foreground,
              fontSize: 28,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              letterSpacing: -0.8,
            }}
          >
            Notifications
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            numberOfLines={1}
            style={{ color: tokens.foregroundMuted, fontSize: 13 }}
          >
            {subtitle}
          </Text>
        </View>
        {inbox.unread > 0 ? (
          <SettingsIconButton
            label="Mark all as read"
            onPress={busy ? () => undefined : onMarkAllRead}
          >
            <CheckCheck size={19} color={tokens.primary} />
          </SettingsIconButton>
        ) : null}
        <SettingsIconButton label="Notification settings" onPress={onOpenSettings}>
          <Settings2 size={19} color={tokens.foreground} />
        </SettingsIconButton>
      </View>

      {offline ? (
        <View
          accessibilityRole="text"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.surfaceSubtle,
          }}
        >
          <WifiOff size={15} color={tokens.foregroundMuted} />
          <Text style={{ flex: 1, color: tokens.foregroundMuted, fontSize: 12.5 }}>
            Offline — showing saved notifications. Changes sync when you reconnect.
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive, fontSize: 13 }}>
          {error}
        </Text>
      ) : null}
      {loadError ? (
        <View style={{ gap: 8, alignItems: 'flex-start' }}>
          <Text accessibilityRole="alert" style={{ color: tokens.destructive, fontSize: 13 }}>
            {loadError}
          </Text>
          {onRetry ? <ChipButton label="Retry" onPress={onRetry} /> : null}
        </View>
      ) : null}

      {items && items.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={{ gap: 8 }}
        >
          {inbox.chips.map((chip) => {
            const count = chip.key === 'unread' ? inbox.unread : inbox.counts[chip.key];
            const active = inbox.filter === chip.key;
            return (
              <Pressable
                key={chip.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${chip.label}, ${count}`}
                onPress={() => inbox.setFilter(chip.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? tokens.primary : tokens.borderSubtle,
                  backgroundColor: active ? tokens.primary : tokens.card,
                }}
              >
                <Text
                  style={{
                    color: active ? tokens.primaryForeground : tokens.foregroundMuted,
                    fontSize: 13,
                    fontFamily: 'Manrope_700Bold',
                  }}
                >
                  {chip.label}
                </Text>
                {count > 0 ? (
                  <View
                    style={{
                      minWidth: 20,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 999,
                      backgroundColor: active
                        ? withAlpha(tokens.primaryForeground, 0.16)
                        : tokens.surfaceSubtle,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: 'center',
                        color: active ? tokens.primaryForeground : tokens.foreground,
                        fontSize: 11,
                        fontFamily: 'Manrope_700Bold',
                      }}
                    >
                      {count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {items && items.length > 0 ? (
        <Text style={{ color: tokens.foregroundSubtle, fontSize: 11.5 }}>
          Swipe right to mark read or unread, left to delete.
        </Text>
      ) : null}
      {!items && !loadError ? <InboxSkeleton /> : null}
    </View>
  );

  const sections = inbox.sections.map((section) => ({ ...section, data: section.items }));

  return (
    <View style={{ flex: 1, backgroundColor: tokens.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: topInset + 10,
          paddingBottom: bottomInset + 96,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          flexGrow: 1,
        }}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View
            accessibilityRole="header"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingTop: 14,
              paddingBottom: 8,
              backgroundColor: tokens.background,
            }}
          >
            <Text
              style={{
                color: tokens.foregroundMuted,
                fontSize: 11.5,
                fontFamily: 'Manrope_700Bold',
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              }}
            >
              {section.label}
            </Text>
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 1,
                borderRadius: 999,
                backgroundColor: tokens.surfaceSubtle,
              }}
            >
              <Text style={{ color: tokens.foregroundMuted, fontSize: 11 }}>
                {section.items.length}
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            now={inbox.now}
            openable={canOpen ? canOpen(item) : true}
            extra={extraFor(item)}
            onOpen={() => onOpen(item)}
            onToggleRead={() => (item.readAt === undefined ? onMarkRead(item) : onMarkUnread(item))}
            onDelete={() => remove(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        ListEmptyComponent={
          inbox.filtered && inbox.filtered.length === 0 ? (
            <FinanceEmptyState
              kind="activity"
              scene={inbox.filter === 'unread' ? 'success' : 'notifications'}
              title={emptyCopy.title}
              description={emptyCopy.description}
              action={
                inbox.filter !== 'all' ? (
                  <ChipButton
                    label="Show all notifications"
                    onPress={() => inbox.setFilter('all')}
                  />
                ) : (
                  <ChipButton label="Choose what you hear about" onPress={onOpenSettings} />
                )
              }
            />
          ) : null
        }
        ListFooterComponent={
          inbox.hasMore ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <ChipButton label="Show older notifications" onPress={inbox.loadMore} />
            </View>
          ) : null
        }
        onEndReached={inbox.hasMore ? inbox.loadMore : undefined}
        onEndReachedThreshold={0.6}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tokens.primary}
              colors={[tokens.primary]}
              progressBackgroundColor={tokens.card}
              progressViewOffset={topInset}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      />
      {inbox.lastDeleted ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: bottomInset + 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 10,
            paddingLeft: 18,
            paddingRight: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: tokens.borderSubtle,
            backgroundColor: tokens.popover,
            alignSelf: 'center',
            maxWidth: 520,
          }}
        >
          <Text style={{ color: tokens.popoverForeground, fontSize: 14 }}>
            Notification deleted
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={inbox.undo}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 11,
              backgroundColor: withAlpha(tokens.primary, 0.16),
            }}
          >
            <Text style={{ color: tokens.primary, fontFamily: 'Manrope_700Bold' }}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
