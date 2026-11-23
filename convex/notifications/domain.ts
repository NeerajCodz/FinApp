export const notificationTypes = [
  'transaction',
  'budget',
  'goal',
  'recurring',
  'group',
  'split',
  'settlement',
  'security',
  'sync',
] as const;
export type NotificationType = (typeof notificationTypes)[number];
export type NotificationPreferences = Record<NotificationType, boolean>;

export const defaultNotificationPreferences: NotificationPreferences = {
  transaction: false,
  budget: true,
  goal: true,
  recurring: true,
  group: true,
  split: true,
  settlement: true,
  security: true,
  sync: true,
};

/**
 * Types introduced after preferences were first stored. When a saved preference object has no
 * value for one of them, the value of the type that used to carry those events is reused, so an
 * existing opt-out keeps working (shared-expense events were delivered as 'group' before).
 */
const inheritedPreference: Partial<Record<NotificationType, NotificationType>> = {
  split: 'group',
};

export function normalizeNotificationPreferences(value: unknown): NotificationPreferences {
  const saved =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    notificationTypes.map((type) => {
      if (typeof saved[type] === 'boolean') return [type, saved[type]];
      const parent = inheritedPreference[type];
      if (parent && typeof saved[parent] === 'boolean') return [type, saved[parent]];
      return [type, defaultNotificationPreferences[type]];
    }),
  ) as NotificationPreferences;
}

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (notificationTypes as readonly string[]).includes(value);
}

export const notificationTypeLabels: Record<NotificationType, string> = {
  transaction: 'Transactions',
  budget: 'Budget limits',
  goal: 'Goals',
  recurring: 'Recurring',
  group: 'Group membership',
  split: 'Shared expenses',
  settlement: 'Settlements & reminders',
  security: 'Security',
  sync: 'Sync problems',
};

export type NotificationRoute = { type: string; entityType?: string; entityId?: string };

/** Entity id of a payment reminder: the group and the creditor who sent it. */
export function paymentReminderEntityId(groupId: string, creditorId: string): string {
  return `${groupId}:${creditorId}`;
}

export function notificationRoute(notification: NotificationRoute): string {
  if (notification.entityType === 'groupInvitation') return '/groups?invitations=1';
  if (notification.entityType === 'recurring') return '/recurring';
  if (notification.entityType === 'sync') return '/settings/sync';
  if (notification.entityType === 'security') return '/settings/security';
  if (!notification.entityId) return '/notifications';
  const id = encodeURIComponent(notification.entityId);
  if (notification.entityType === 'transaction') return `/transaction/${id}`;
  if (notification.entityType === 'budget') return `/budget/${id}`;
  if (notification.entityType === 'group') return `/group/${id}`;
  if (notification.entityType === 'goal') return `/goals/${id}`;
  // Settlement events carry the group id: open that group's balances to review or settle up.
  if (notification.entityType === 'settlement') return `/group/${id}/balances`;
  // Payment reminders open the settle-up form for the group with the creditor preselected.
  if (notification.entityType === 'paymentReminder') {
    const [groupId, creditorId] = notification.entityId.split(':');
    if (!groupId) return '/notifications';
    const query = new URLSearchParams({ groupId });
    if (creditorId) query.set('member', creditorId);
    return `/settle/new?${query.toString()}`;
  }
  return '/notifications';
}

/** Only in-app paths are routable: rejects absolute and protocol-relative URLs. */
export function isSafeNotificationUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\')
  );
}

/** Client-facing copy for the result of `notifications.mutations.nudge`. */
export type NudgeOutcome =
  { status: 'sent' } | { status: 'alreadySent' } | { status: 'error'; code: string };

export function nudgeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const known = [
    'NOTHING_OWED',
    'INVALID_NUDGE_TARGET',
    'INSUFFICIENT_PERMISSION',
    'GROUP_NOT_FOUND',
    'AUTH_REQUIRED',
  ];
  return known.find((code) => message.includes(code)) ?? 'UNKNOWN';
}

export function nudgeMessage(outcome: NudgeOutcome, name?: string): string {
  if (outcome.status === 'sent') return name ? `Reminder sent to ${name}.` : 'Reminder sent.';
  if (outcome.status === 'alreadySent')
    return name ? `${name} was already reminded today.` : 'Already reminded today.';
  if (outcome.code === 'NOTHING_OWED')
    return name
      ? `${name} doesn’t owe you anything in this group.`
      : 'Nothing is owed to you here.';
  if (outcome.code === 'AUTH_REQUIRED') return 'Sign in again to send reminders.';
  return 'Could not send the reminder. Try again.';
}
