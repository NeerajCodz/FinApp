import { describe, expect, it } from 'vitest';
import {
  filterNotifications,
  notificationAction,
  notificationBadge,
  notificationDayKey,
  notificationFilterCounts,
  notificationIconKind,
  notificationKindLabel,
  notificationSections,
  notificationTime,
  notificationTone,
  visibleNotificationFilters,
  type NotificationListItem,
} from '../../packages/ui/src/finance/notifications';

// Wednesday 2026-11-25, 15:00 local time.
const now = new Date(2026, 10, 25, 15, 0, 0).getTime();
const at = (day: number, hour = 12, month = 10, year = 2026) =>
  new Date(year, month, day, hour, 0, 0).getTime();

const item = (
  id: string,
  createdAt: number,
  extra: Partial<NotificationListItem> = {},
): NotificationListItem => ({
  id,
  type: 'goal',
  title: id,
  body: '',
  createdAt,
  ...extra,
});

describe('grouping by day', () => {
  it('buckets into Today, Yesterday, This week and Earlier', () => {
    expect(notificationDayKey(at(25, 0), now)).toBe('today');
    expect(notificationDayKey(at(24, 23), now)).toBe('yesterday');
    expect(notificationDayKey(at(24, 0), now)).toBe('yesterday');
    expect(notificationDayKey(at(23, 23), now)).toBe('week');
    expect(notificationDayKey(at(19, 0), now)).toBe('week');
    expect(notificationDayKey(at(18, 23), now)).toBe('earlier');
  });

  it('sorts newest first and drops empty sections', () => {
    const sections = notificationSections(
      [item('old', at(1)), item('today-early', at(25, 8)), item('today-late', at(25, 14))],
      now,
    );
    expect(sections.map((section) => section.label)).toEqual(['Today', 'Earlier']);
    expect(sections[0]!.items.map((entry) => entry.id)).toEqual(['today-late', 'today-early']);
  });

  it('formats compact times per bucket', () => {
    expect(notificationTime(now - 30_000, now)).toBe('now');
    expect(notificationTime(now - 5 * 60_000, now)).toBe('5m');
    expect(notificationTime(now - 3 * 3_600_000, now)).toBe('3h');
    expect(notificationTime(at(20), now)).toBe(
      new Date(at(20)).toLocaleDateString(undefined, { weekday: 'short' }),
    );
    expect(notificationTime(at(3, 12, 0, 2025), now)).toContain('2025');
  });
});

describe('filters', () => {
  const items = [
    item('goal', now, { type: 'goal' }),
    item('limit', now, { type: 'budget', readAt: now }),
    item('split', now, { type: 'split' }),
    item('friend', now, { type: 'social', readAt: now }),
  ];

  it('filters by kind and unread', () => {
    expect(filterNotifications(items, 'money').map((entry) => entry.id)).toEqual(['goal', 'limit']);
    expect(filterNotifications(items, 'shared').map((entry) => entry.id)).toEqual(['split']);
    expect(filterNotifications(items, 'unread').map((entry) => entry.id)).toEqual([
      'goal',
      'split',
    ]);
    expect(filterNotifications(items, 'all')).toHaveLength(4);
  });

  it('counts each filter and hides empty kinds unless active', () => {
    const counts = notificationFilterCounts(items);
    expect(counts).toEqual({ all: 4, unread: 2, money: 2, shared: 1, friends: 1, security: 0 });
    expect(visibleNotificationFilters(counts).map((filter) => filter.key)).toEqual([
      'all',
      'unread',
      'money',
      'shared',
      'friends',
    ]);
    expect(visibleNotificationFilters(counts, 'security').map((filter) => filter.key)).toContain(
      'security',
    );
  });
});

describe('row presentation and actions', () => {
  it('maps entity types to the right action', () => {
    expect(
      notificationAction({ type: 'social', entityType: 'friendRequest', entityId: 'r1' }),
    ).toEqual({ kind: 'friendRequest' });
    expect(notificationAction({ type: 'group', entityType: 'groupInvitation' })).toEqual({
      kind: 'invitation',
    });
    expect(notificationAction({ type: 'settlement', entityType: 'paymentReminder' })).toEqual({
      kind: 'open',
      label: 'Settle up',
    });
    expect(notificationAction({ type: 'split', entityType: 'transaction' })).toEqual({
      kind: 'open',
      label: 'View expense',
    });
    expect(notificationAction({ type: 'social', entityType: 'person' })).toEqual({
      kind: 'open',
      label: 'View profile',
    });
    expect(notificationAction({ type: 'security', entityType: 'session' })).toMatchObject({
      kind: 'open',
    });
    expect(notificationAction({ type: 'goal' })).toEqual({ kind: 'none' });
  });

  it('labels budget alerts as category limits and colours kinds', () => {
    expect(notificationKindLabel('budget')).toBe('Category limit');
    expect(notificationTone({ type: 'settlement', entityType: 'paymentReminder' })).toBe(
      'settlement',
    );
    expect(notificationTone('security')).toBe('destructive');
    expect(notificationIconKind({ type: 'social', entityType: 'friendRequest' })).toBe(
      'friendRequest',
    );
    expect(notificationIconKind({ type: 'social', entityType: 'person' })).toBe('friend');
  });

  it('caps badges', () => {
    expect(notificationBadge(0)).toBeNull();
    expect(notificationBadge(7)).toBe('7');
    expect(notificationBadge(140)).toBe('99+');
  });
});
