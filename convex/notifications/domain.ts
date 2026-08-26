export type NotificationRoute = { type: string; entityType?: string; entityId?: string };

export function notificationRoute(notification: NotificationRoute): string {
  if (!notification.entityId) return 'finapp://notifications';
  if (notification.entityType === 'transaction')
    return `finapp://transaction/${notification.entityId}`;
  if (notification.entityType === 'group') return `finapp://group/${notification.entityId}`;
  if (notification.entityType === 'settlement') return `finapp://settle/${notification.entityId}`;
  if (notification.entityType === 'goal') return `finapp://goals/${notification.entityId}`;
  return 'finapp://notifications';
}
