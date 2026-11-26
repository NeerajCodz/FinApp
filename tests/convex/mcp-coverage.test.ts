import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';

const modules = import.meta.glob('../../convex/**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const verified = { emailVerificationTime: Date.now(), defaultCurrency: 'USD' };
    const firstId = await ctx.db.insert('users', {
      ...verified,
      email: 'first@example.com',
      username: 'first_user',
      displayName: 'First',
    });
    const secondId = await ctx.db.insert('users', {
      ...verified,
      email: 'second@example.com',
      username: 'second_user',
      displayName: 'Second',
    });
    const thirdId = await ctx.db.insert('users', {
      ...verified,
      email: 'third@example.com',
      username: 'third_user',
    });
    return { firstId, secondId, thirdId };
  });
  const signedIn = (id: string) => t.withIdentity({ subject: `${id}|session` });
  return {
    t,
    ids,
    first: signedIn(ids.firstId),
    second: signedIn(ids.secondId),
    third: signedIn(ids.thirdId),
  };
}

describe('social.mutations.removeFriend', () => {
  it('ends the friendship from either side and allows a fresh request afterwards', async () => {
    const { first, second, ids } = await fixture();
    const request = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    await second.mutation(api.social.mutations.respondToRequest, {
      requestId: request.requestId,
      response: 'accept',
    });
    expect(await first.query(api.social.queries.friends, {})).toHaveLength(1);

    await second.mutation(api.social.mutations.removeFriend, { userId: ids.firstId });
    expect(await first.query(api.social.queries.friends, {})).toEqual([]);
    expect(await second.query(api.social.queries.friends, {})).toEqual([]);
    const relationship = await first.query(api.social.queries.relationship, {
      userId: ids.secondId,
    });
    expect(relationship?.status).toBe('none');

    const again = await first.mutation(api.social.mutations.sendRequest, {
      recipientId: ids.secondId,
    });
    expect(again.status).toBe('pending');
  });

  it('rejects removing yourself or someone who is not a friend', async () => {
    const { first, ids } = await fixture();
    await expect(
      first.mutation(api.social.mutations.removeFriend, { userId: ids.firstId }),
    ).rejects.toThrow('CANNOT_FRIEND_SELF');
    await expect(
      first.mutation(api.social.mutations.removeFriend, { userId: ids.thirdId }),
    ).rejects.toThrow('NOT_FRIENDS');
  });

  it('requires a signed-in user', async () => {
    const { t, ids } = await fixture();
    await expect(
      t.mutation(api.social.mutations.removeFriend, { userId: ids.secondId }),
    ).rejects.toThrow('AUTH_REQUIRED');
  });
});

describe('mcp.notificationState', () => {
  it('counts only the caller’s unread notifications and resolves preferences', async () => {
    const { t, first, ids } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert('userSettings', {
        userId: ids.firstId,
        currency: 'USD',
        timezone: 'UTC',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: { goal: false },
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        updatedAt: 1,
      });
      const base = { type: 'goal', title: 'Goal', body: 'Body' };
      await ctx.db.insert('notifications', { ...base, recipientId: ids.firstId, createdAt: 1 });
      await ctx.db.insert('notifications', { ...base, recipientId: ids.firstId, createdAt: 2 });
      await ctx.db.insert('notifications', {
        ...base,
        recipientId: ids.firstId,
        createdAt: 3,
        readAt: 4,
      });
      await ctx.db.insert('notifications', { ...base, recipientId: ids.secondId, createdAt: 5 });
    });
    const state = await first.query(api.mcp.notificationState, {});
    expect(state).toEqual({
      unreadCount: 2,
      unreadCapped: false,
      preferences: { ...defaultNotificationPreferences, goal: false },
    });
  });

  it('uses default preferences without settings and requires sign-in', async () => {
    const { t, second } = await fixture();
    expect(await second.query(api.mcp.notificationState, {})).toEqual({
      unreadCount: 0,
      unreadCapped: false,
      preferences: defaultNotificationPreferences,
    });
    await expect(t.query(api.mcp.notificationState, {})).rejects.toThrow('AUTH_REQUIRED');
  });
});
