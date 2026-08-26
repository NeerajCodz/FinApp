import { notificationRoute, type NotificationRoute } from './domain';

export function markNotificationRead(
  notification: { recipientId: string; id: string; readAt?: number },
  actorId: string,
) {
  if (notification.recipientId !== actorId) throw new Error('INSUFFICIENT_PERMISSION');
  return { id: notification.id, readAt: Date.now() };
}

export function routeNotification(notification: NotificationRoute) {
  return notificationRoute(notification);
}
