/** Presentation helpers shared by the native and web notification centres. */

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
  | 'budget'
  | 'goal'
  | 'recurring'
  | 'security'
  | 'sync'
  | 'transaction'
  | 'other';

export function notificationTone(type: string): NotificationTone {
  switch (type) {
    case 'split':
      return 'split';
    case 'settlement':
      return 'settlement';
    case 'group':
      return 'accent';
    case 'budget':
      return 'warning';
    case 'security':
    case 'sync':
      return 'destructive';
    case 'goal':
      return 'income';
    case 'transaction':
      return 'expense';
    default:
      return 'neutral';
  }
}

export function notificationIconKind(item: Pick<NotificationListItem, 'type' | 'entityType'>) {
  if (item.entityType === 'paymentReminder') return 'reminder' as const;
  if (item.entityType === 'groupInvitation') return 'invitation' as const;
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
    : ('other' as const);
}

export type NotificationSection = {
  key: 'today' | 'earlier';
  label: string;
  items: NotificationListItem[];
};

/** Newest first, split into Today and Earlier (empty sections are dropped). */
export function notificationSections(
  items: readonly NotificationListItem[],
  now = Date.now(),
): NotificationSection[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sorted = [...items].sort((left, right) => right.createdAt - left.createdAt);
  const sections: NotificationSection[] = [
    {
      key: 'today',
      label: 'Today',
      items: sorted.filter((item) => item.createdAt >= startOfToday.getTime()),
    },
    {
      key: 'earlier',
      label: 'Earlier',
      items: sorted.filter((item) => item.createdAt < startOfToday.getTime()),
    },
  ];
  return sections.filter((section) => section.items.length > 0);
}

/** "now", "5m", "3h" for today; a short date for older events. */
export function notificationTime(createdAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - createdAt);
  if (elapsed < 60_000) return 'now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`;
  const date = new Date(createdAt);
  if (date.toDateString() === new Date(now).toDateString())
    return `${Math.floor(elapsed / 3_600_000)}h`;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function unreadCount(items: readonly Pick<NotificationListItem, 'readAt'>[]): number {
  return items.reduce((count, item) => (item.readAt === undefined ? count + 1 : count), 0);
}
