/** Presentation helpers shared by the native and web notification inboxes. */

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: number;
  readAt?: number;
  entityType?: string;
  entityId?: string;
};

export type NotificationTone =
  'accent' | 'income' | 'expense' | 'split' | 'settlement' | 'warning' | 'destructive' | 'neutral';

export type NotificationIconKind =
  | 'split'
  | 'settlement'
  | 'reminder'
  | 'group'
  | 'invitation'
  | 'friend'
  | 'friendRequest'
  | 'budget'
  | 'goal'
  | 'recurring'
  | 'security'
  | 'sync'
  | 'transaction'
  | 'other';

/** Kind colour of a notification's icon tile. */
export function notificationTone(
  item: string | Pick<NotificationListItem, 'type' | 'entityType'>,
): NotificationTone {
  const { type, entityType } =
    typeof item === 'string' ? { type: item, entityType: undefined } : item;
  if (entityType === 'paymentReminder') return 'settlement';
  switch (type) {
    case 'split':
    case 'group':
      return 'split';
    case 'settlement':
      return 'settlement';
    case 'budget':
    case 'recurring':
    case 'sync':
      return 'warning';
    case 'security':
      return 'destructive';
    case 'goal':
      return 'income';
    case 'transaction':
    case 'social':
      return 'accent';
    default:
      return 'neutral';
  }
}

export function notificationIconKind(
  item: Pick<NotificationListItem, 'type' | 'entityType'>,
): NotificationIconKind {
  if (item.entityType === 'paymentReminder') return 'reminder';
  if (item.entityType === 'groupInvitation') return 'invitation';
  if (item.entityType === 'friendRequest') return 'friendRequest';
  if (item.type === 'social') return 'friend';
  const known: readonly NotificationIconKind[] = [
    'split',
    'settlement',
    'group',
    'budget',
    'goal',
    'recurring',
    'security',
    'sync',
    'transaction',
  ];
  return known.includes(item.type as NotificationIconKind)
    ? (item.type as NotificationIconKind)
    : 'other';
}

/** Short kind label shown on each row ("Budget" alerts are category spending limits). */
export function notificationKindLabel(type: string): string {
  switch (type) {
    case 'transaction':
      return 'Transaction';
    case 'budget':
      return 'Category limit';
    case 'goal':
      return 'Goal';
    case 'recurring':
      return 'Recurring';
    case 'group':
      return 'Group';
    case 'split':
      return 'Shared expense';
    case 'settlement':
      return 'Settle up';
    case 'security':
      return 'Security';
    case 'sync':
      return 'Sync';
    case 'social':
      return 'Friends';
    default:
      return 'Update';
  }
}

// ---------------------------------------------------------------------------------------------
// Filters

export type NotificationFilterKey = 'all' | 'unread' | 'money' | 'shared' | 'friends' | 'security';

export type NotificationFilter = {
  key: NotificationFilterKey;
  label: string;
  /** Notification types the filter keeps; absent for All and Unread. */
  types?: readonly string[];
};

export const notificationFilters: readonly NotificationFilter[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'money', label: 'Money', types: ['transaction', 'budget', 'goal', 'recurring'] },
  { key: 'shared', label: 'Shared', types: ['group', 'split', 'settlement'] },
  { key: 'friends', label: 'Friends', types: ['social'] },
  { key: 'security', label: 'Security', types: ['security', 'sync'] },
];

export function isNotificationFilterKey(value: unknown): value is NotificationFilterKey {
  return notificationFilters.some((filter) => filter.key === value);
}

export function matchesNotificationFilter(
  item: Pick<NotificationListItem, 'type' | 'readAt'>,
  key: NotificationFilterKey,
): boolean {
  if (key === 'all') return true;
  if (key === 'unread') return item.readAt === undefined;
  const filter = notificationFilters.find((candidate) => candidate.key === key);
  return Boolean(filter?.types?.includes(item.type));
}

export function filterNotifications<T extends Pick<NotificationListItem, 'type' | 'readAt'>>(
  items: readonly T[],
  key: NotificationFilterKey,
): T[] {
  return items.filter((item) => matchesNotificationFilter(item, key));
}

/** Number of notifications each filter shows. */
export function notificationFilterCounts(
  items: readonly Pick<NotificationListItem, 'type' | 'readAt'>[],
): Record<NotificationFilterKey, number> {
  const counts = Object.fromEntries(notificationFilters.map((filter) => [filter.key, 0])) as Record<
    NotificationFilterKey,
    number
  >;
  for (const item of items)
    for (const filter of notificationFilters)
      if (matchesNotificationFilter(item, filter.key)) counts[filter.key] += 1;
  return counts;
}

/**
 * Filter chips worth showing: All and Unread always, kind filters only when they hold something
 * (or are the active filter, so the selection never disappears under the user).
 */
export function visibleNotificationFilters(
  counts: Record<NotificationFilterKey, number>,
  active: NotificationFilterKey = 'all',
): NotificationFilter[] {
  return notificationFilters.filter(
    (filter) => !filter.types || counts[filter.key] > 0 || filter.key === active,
  );
}

/** Empty-state copy for a filter with nothing in it. */
export function notificationEmptyCopy(key: NotificationFilterKey): {
  title: string;
  description: string;
} {
  switch (key) {
    case 'all':
      return {
        title: 'No notifications yet',
        description:
          'Shared expenses, settle-ups, friend requests, goals and security alerts will land here.',
      };
    case 'unread':
      return { title: 'You’re all caught up', description: 'Nothing new since you last looked.' };
    case 'money':
      return {
        title: 'No money updates',
        description: 'Category limits, goals and recurring payments will show up here.',
      };
    case 'shared':
      return {
        title: 'Nothing shared yet',
        description: 'Group expenses, settle-ups and payment reminders will show up here.',
      };
    case 'friends':
      return {
        title: 'No friend activity',
        description: 'Friend requests and new connections will show up here.',
      };
    case 'security':
      return {
        title: 'No security alerts',
        description: 'New sign-ins, two-factor changes and sync problems will show up here.',
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Grouping by day

export type NotificationDayKey = 'today' | 'yesterday' | 'week' | 'earlier';

export type NotificationSection = {
  key: NotificationDayKey;
  label: string;
  items: NotificationListItem[];
};

const dayLabels: Record<NotificationDayKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
};

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Calendar start of the day `days` before `now`'s day (DST-safe). */
function startOfDayBefore(now: number, days: number): number {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.getTime();
}

/** Today, Yesterday, the rest of the last seven days, or Earlier (local calendar days). */
export function notificationDayKey(createdAt: number, now = Date.now()): NotificationDayKey {
  if (createdAt >= startOfDay(now)) return 'today';
  if (createdAt >= startOfDayBefore(now, 1)) return 'yesterday';
  if (createdAt >= startOfDayBefore(now, 6)) return 'week';
  return 'earlier';
}

/** Newest first, grouped by day; empty groups are dropped. */
export function notificationSections<T extends NotificationListItem>(
  items: readonly T[],
  now = Date.now(),
): (NotificationSection & { items: T[] })[] {
  const sorted = [...items].sort((left, right) => right.createdAt - left.createdAt);
  const order: NotificationDayKey[] = ['today', 'yesterday', 'week', 'earlier'];
  const groups = new Map<NotificationDayKey, T[]>(order.map((key) => [key, []]));
  for (const item of sorted) groups.get(notificationDayKey(item.createdAt, now))!.push(item);
  return order
    .map((key) => ({ key, label: dayLabels[key], items: groups.get(key)! }))
    .filter((section) => section.items.length > 0);
}

/**
 * Compact time for a row: "now", "5m", "3h" today; the clock time yesterday; the weekday this
 * week; a short date before that.
 */
export function notificationTime(createdAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - createdAt);
  const day = notificationDayKey(createdAt, now);
  if (day === 'today') {
    if (elapsed < 60_000) return 'now';
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
    return `${Math.floor(elapsed / 3_600_000)}h`;
  }
  const date = new Date(createdAt);
  if (day === 'yesterday')
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (day === 'week') return date.toLocaleDateString(undefined, { weekday: 'short' });
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Full date and time, for tooltips and screen readers. */
export function notificationTimestamp(createdAt: number): string {
  return new Date(createdAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function unreadCount(items: readonly Pick<NotificationListItem, 'readAt'>[]): number {
  return items.reduce((count, item) => (item.readAt === undefined ? count + 1 : count), 0);
}

/** Badge text: hidden at zero, capped at 99+. */
export function notificationBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

// ---------------------------------------------------------------------------------------------
// Actions

/**
 * What a row offers besides opening it: inline answers for friend requests and group invites,
 * or a labelled link to the related screen.
 */
export type NotificationAction =
  | { kind: 'friendRequest' }
  | { kind: 'invitation' }
  | { kind: 'open'; label: string }
  | { kind: 'none' };

export function notificationAction(
  item: Pick<NotificationListItem, 'type' | 'entityType' | 'entityId'>,
): NotificationAction {
  switch (item.entityType) {
    case 'friendRequest':
      return item.entityId ? { kind: 'friendRequest' } : { kind: 'open', label: 'See requests' };
    case 'groupInvitation':
      return { kind: 'invitation' };
    case 'paymentReminder':
      return { kind: 'open', label: 'Settle up' };
    case 'settlement':
      return { kind: 'open', label: 'View balances' };
    case 'transaction':
      return { kind: 'open', label: item.type === 'split' ? 'View expense' : 'View transaction' };
    case 'group':
      return { kind: 'open', label: 'Open group' };
    case 'goal':
      return { kind: 'open', label: 'View goal' };
    case 'budget':
      return { kind: 'open', label: 'View limit' };
    case 'person':
      return { kind: 'open', label: 'View profile' };
    case 'recurring':
      return { kind: 'open', label: 'Review payment' };
    case 'sync':
      return { kind: 'open', label: 'Open sync' };
    case 'mcpConnection':
      return { kind: 'open', label: 'Manage apps' };
    case 'security':
      return { kind: 'open', label: 'Review security' };
    case 'account':
    case 'session':
      return item.type === 'security'
        ? { kind: 'open', label: 'Review security' }
        : { kind: 'none' };
    default:
      return { kind: 'none' };
  }
}

/** Rows rendered per page; more load as the list scrolls. */
export const NOTIFICATION_PAGE_SIZE = 30;

/** How long a deleted row can be restored with Undo before the delete is sent. */
export const NOTIFICATION_UNDO_MS = 4500;
