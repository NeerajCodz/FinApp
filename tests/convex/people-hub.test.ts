import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import {
  matchesHubSearch,
  personStatus,
  unreadBadge,
} from '../../packages/ui/src/finance/peopleHub';

const modules = import.meta.glob('../../convex/**/*.ts');

async function seed() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const meId = await ctx.db.insert('users', { email: 'me@example.com', name: 'Me' });
    const annaId = await ctx.db.insert('users', {
      email: 'anna@example.com',
      displayName: 'Anna',
      username: 'anna',
    });
    const benId = await ctx.db.insert('users', { email: 'ben@example.com', displayName: 'Ben' });
    const strangerId = await ctx.db.insert('users', { email: 'x@example.com', name: 'Stranger' });
    const [fLow, fHigh] = [meId, benId].sort();
    await ctx.db.insert('friendships', { userLowId: fLow!, userHighId: fHigh!, createdAt: now });
    const [cLow, cHigh] = [meId, annaId].sort();
    const conversationId = await ctx.db.insert('directConversations', {
      userLowId: cLow!,
      userHighId: cHigh!,
      createdAt: now - 1000,
      updatedAt: now,
    });
    for (const [senderId, text] of [
      [annaId, 'hi'],
      [annaId, 'lunch?'],
      [meId, 'sure'],
    ] as const)
      await ctx.db.insert('directMessages', {
        conversationId,
        senderId,
        kind: 'text',
        text,
        createdAt: now - 500,
      });
    await ctx.db.insert('presence', {
      userId: annaId,
      activeUntil: now + 60_000,
      lastSeenAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('userSettings', {
      userId: benId,
      currency: 'USD',
      timezone: 'UTC',
      firstDayOfWeek: 1,
      financialMonthStart: 1,
      language: 'en',
      appearance: 'system',
      notificationPreferences: {},
      appLockPreferences: {},
      updatedAt: now,
      showActive: false,
      showLastSeen: false,
    });
    return { meId, annaId, benId, strangerId, conversationId };
  });
  const me = t.withIdentity({ subject: `${ids.meId}|session` });
  return { t, ids, me };
}

describe('people hub', () => {
  it('lists friends and conversation contacts, unread first, honouring presence privacy', async () => {
    const { ids, me } = await seed();
    const people = await me.query(api.social.queries.peopleHub, {});
    expect(people.map((person) => person.displayName)).toEqual(['Anna', 'Ben']);
    const [anna, ben] = people;
    // Anna: 3 messages, 1 is mine → 2 unread from her.
    expect(anna).toMatchObject({
      unreadCount: 2,
      active: true,
      conversationId: ids.conversationId,
    });
    expect(ben).toMatchObject({
      unreadCount: 0,
      active: null,
      lastSeenAt: null,
      conversationId: null,
    });
  });

  it('returns nothing signed out', async () => {
    const { t } = await seed();
    expect(await t.query(api.social.queries.peopleHub, {})).toEqual([]);
  });

  it('builds 30-day person analytics only for connected people', async () => {
    const { ids, me } = await seed();
    const anna = await me.query(api.social.queries.personAnalytics, { userId: ids.annaId });
    expect(anna?.days).toHaveLength(30);
    expect(anna?.totalMessages).toBe(3);
    const sent = anna!.days.reduce((sum, day) => sum + day.sent, 0);
    const received = anna!.days.reduce((sum, day) => sum + day.received, 0);
    expect([sent, received]).toEqual([1, 2]);
    expect(anna?.mix.text).toBe(3);
    expect(
      await me.query(api.social.queries.personAnalytics, { userId: ids.strangerId }),
    ).toBeNull();
    expect(await me.query(api.social.queries.personAnalytics, { userId: ids.meId })).toBeNull();
  });
});

describe('people hub model', () => {
  it('formats status, badges and search', () => {
    const now = 10 * 60 * 60_000;
    expect(personStatus({ active: true }, now)).toBe('Active now');
    expect(personStatus({ active: false, lastSeenAt: now - 5 * 60_000 }, now)).toBe(
      'Active 5m ago',
    );
    expect(personStatus({ active: null, lastSeenAt: null }, now)).toBe('');
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(3)).toBe('3');
    expect(unreadBadge(9, true)).toBe('9+');
    expect(matchesHubSearch({ displayName: 'Anna', username: 'anna_k' }, '@ANNA_')).toBe(true);
    expect(matchesHubSearch({ name: 'Trip' }, 'rent')).toBe(false);
  });
});
