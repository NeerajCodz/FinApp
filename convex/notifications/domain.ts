export const notificationTypes = ['transaction', 'budget', 'goal', 'recurring', 'group', 'settlement', 'security', 'sync'] as const;
export type NotificationType = (typeof notificationTypes)[number];
export type NotificationPreferences = Record<NotificationType, boolean>;

export const defaultNotificationPreferences: NotificationPreferences = {
  transaction: false,
  budget: true,
  goal: true,
  recurring: true,
  group: true,
  settlement: true,
  security: true,
  sync: true,
};

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const saved = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return Object.fromEntries(notificationTypes.map((type) => [
    type, typeof saved[type] === 'boolean' ? saved[type] : defaultNotificationPreferences[type],
  ])) as NotificationPreferences;
}

export type NotificationRoute = { type: string; entityType?: string; entityId?: string };

export function notificationRoute(notification: NotificationRoute): string {
  if (notification.entityType === 'recurring') return '/recurring';
  if (notification.entityType === 'sync') return '/settings/sync';
  if (notification.entityType === 'security') return '/settings/security';
  if (!notification.entityId) return '/notifications';
  const id = encodeURIComponent(notification.entityId);
  if (notification.entityType === 'transaction') return `/transaction/${id}`;
  if (notification.entityType === 'budget') return `/budget/${id}`;
  if (notification.entityType === 'group') return `/group/${id}`;
  if (notification.entityType === 'goal') return `/goals/${id}`;
  if (notification.entityType === 'settlement') return `/group/${id}`;
  return '/notifications';
}
