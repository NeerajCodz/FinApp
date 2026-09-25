import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { createNotification } from '../../convex/notifications/mutations';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';

const modules = import.meta.glob('../../convex/**/*.ts');

describe('notification delivery', () => {
  it('filters at the producer, deduplicates event keys, and persists read state', async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      const id = await ctx.db.insert('users', { email: 'notifications@example.com' });
      await ctx.db.insert('userSettings', {
        userId: id, currency: 'INR', timezone: 'UTC', firstDayOfWeek: 1,
        financialMonthStart: 1, language: 'en', appearance: 'system',
        notificationPreferences: { ...defaultNotificationPreferences, budget: false },
        appLockPreferences: { enabled: false, fallback: 'device-pin' }, updatedAt: 1,
      });
      return id;
    });
    await t.run((ctx) => createNotification(ctx, userId, 'budget:1:80', 'budget', 'budget',
      'budget-id', 'Budget near limit', '80% used'));
    const noEvents = await t.run((ctx) => ctx.db.query('notifications')
      .withIndex('by_recipient_createdAt', (query) => query.eq('recipientId', userId)).collect());
    expect(noEvents).toEqual([]);

    const authenticated = t.withIdentity({ subject: `${userId}|session`, email: 'notifications@example.com' });
    await authenticated.mutation(api.notifications.mutations.setPreferences, {
      preferences: { ...defaultNotificationPreferences, budget: true }, clientMutationId: 'prefs-1',
    });
    await t.run((ctx) => createNotification(ctx, userId, 'budget:1:80', 'budget', 'budget',
      'budget-id', 'Budget near limit', '80% used'));
    await t.run((ctx) => createNotification(ctx, userId, 'budget:1:80', 'budget', 'budget',
      'budget-id', 'Budget near limit', '80% used'));
    const events = await t.run((ctx) => ctx.db.query('notifications')
      .withIndex('by_recipient_createdAt', (query) => query.eq('recipientId', userId)).collect());
    expect(events).toHaveLength(1);
    expect(events[0]?.readAt).toBeUndefined();
    await authenticated.mutation(api.notifications.mutations.markRead, {
      notificationId: events[0]!._id, clientMutationId: 'read-1',
    });
    const persisted = await t.run((ctx) => ctx.db.get(events[0]!._id));
    expect(persisted?.readAt).toEqual(expect.any(Number));
    await authenticated.mutation(api.notifications.mutations.markRead, {
      notificationId: events[0]!._id, clientMutationId: 'read-1',
    });
    const afterReplay = await t.run((ctx) => ctx.db.query('notifications')
      .withIndex('by_recipient_createdAt', (query) => query.eq('recipientId', userId)).collect());
    expect(afterReplay).toHaveLength(1);
    expect(afterReplay[0]?.readAt).toBe(persisted?.readAt);
  });
});
