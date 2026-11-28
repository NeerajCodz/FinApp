import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import {
  formatLowerBound,
  isAnalyticsLinkAvailable,
  isTimestampInRange,
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
    const messageIds: Id<'directMessages'>[] = [];
    for (const [senderId, text, createdAt] of [
      [annaId, 'hi', now - 400],
      [annaId, 'lunch?', now - 300],
      [meId, 'sure', now - 200],
    ] as const)
      messageIds.push(
        await ctx.db.insert('directMessages', {
          conversationId,
          senderId,
          kind: 'text',
          text,
          createdAt,
        }),
      );
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
    return { meId, annaId, benId, strangerId, conversationId, messageIds };
  });
  const me = t.withIdentity({ subject: `${ids.meId}|session` });
  return { t, ids, me };
}

describe('people hub', () => {
  it('lists friends and conversation contacts, unread first, honouring presence privacy', async () => {
    const { ids, me } = await seed();
    const result = await me.query(api.social.queries.peopleHub, {});
    const people = result.people;
    expect(result.truncated).toBe(false);
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
    expect(await t.query(api.social.queries.peopleHub, {})).toMatchObject({
      people: [],
      truncated: false,
    });
  });

  it('uses legacy direct-message receipts as read pointers', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert('directMessageReads', {
        messageId: ids.messageIds[1]!,
        conversationId: ids.conversationId,
        userId: ids.meId,
        seenAt: now,
      });
      await ctx.db.insert('directMessages', {
        conversationId: ids.conversationId,
        senderId: ids.annaId,
        kind: 'text',
        text: 'new after read',
        createdAt: now,
      });
    });
    const anna = (await me.query(api.social.queries.peopleHub, {})).people.find(
      (person) => person.id === ids.annaId,
    );
    expect(anna).toMatchObject({ unreadCount: 1, unreadCapped: false });
  });

  it('does not hide older unread messages behind newer sent messages', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 60; index += 1)
        await ctx.db.insert('directMessages', {
          conversationId: ids.conversationId,
          senderId: ids.meId,
          kind: 'text',
          text: `sent ${index}`,
          createdAt: now + index,
        });
    });
    const anna = (await me.query(api.social.queries.peopleHub, {})).people.find(
      (person) => person.id === ids.annaId,
    );
    expect(anna).toMatchObject({ unreadCount: 2, unreadCapped: false });
  });

  it('ranks conversations before limiting hub candidates', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 120; index += 1) {
        const peerId = await ctx.db.insert('users', {
          email: `peer${index}@example.com`,
          displayName: `Peer ${index}`,
        });
        const [userLowId, userHighId] = [ids.meId, peerId].sort();
        await ctx.db.insert('directConversations', {
          userLowId: userLowId!,
          userHighId: userHighId!,
          createdAt: now - 100_000,
          updatedAt: now - 100_000,
        });
      }
      const [low, high] = await Promise.all([
        ctx.db
          .query('directConversations')
          .withIndex('by_pair', (q) => q.eq('userLowId', ids.meId))
          .collect(),
        ctx.db
          .query('directConversations')
          .withIndex('by_high', (q) => q.eq('userHighId', ids.meId))
          .collect(),
      ]);
      const ordered = [...low, ...high];
      for (const conversation of ordered)
        await ctx.db.patch(conversation._id, { updatedAt: now - 100_000 });
      const latest = ordered.at(-1)!;
      const latestPeer =
        latest.userLowId === ids.meId ? latest.userHighId : latest.userLowId;
      await ctx.db.patch(latestPeer, { displayName: 'Latest' });
      await ctx.db.patch(latest._id, { updatedAt: now + 1 });
      await ctx.db.insert('directMessages', {
        conversationId: latest._id,
        senderId: latestPeer,
        kind: 'text',
        text: 'latest unread',
        createdAt: now + 1,
      });
    });
    const result = await me.query(api.social.queries.peopleHub, {});
    expect(result.people[0]?.displayName).toBe('Latest');
    expect(result.people.some((person) => person.id === ids.annaId)).toBe(true);
    expect(result.truncated).toBe(true);
  });

  it('finds older unread conversations beyond 250 newer read conversations', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 251; index += 1) {
        const peerId = await ctx.db.insert('users', {
          email: `newer${index}@example.com`,
          displayName: `Newer ${index}`,
        });
        const [userLowId, userHighId] = [ids.meId, peerId].sort();
        await ctx.db.insert('directConversations', {
          userLowId: userLowId!,
          userHighId: userHighId!,
          createdAt: now + index + 1,
          updatedAt: now + index + 1,
        });
      }
    });
    const result = await me.query(api.social.queries.peopleHub, {});
    expect(result.people[0]).toMatchObject({
      id: ids.annaId,
      unreadCount: 2,
    });
  });

  it('marks bounded People and unread results as lower bounds when source caps are reached', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 251; index += 1) {
        const peerId = await ctx.db.insert('users', {
          email: `bounded${index}@example.com`,
          displayName: `Bounded ${index}`,
        });
        await ctx.db.insert('directConversations', {
          userLowId: ids.meId,
          userHighId: peerId,
          createdAt: now - index,
          updatedAt: now - index,
        });
      }
    });
    const people = await me.query(api.social.queries.peopleHub, {});
    expect(people.people).toHaveLength(60);
    expect(people.truncated).toBe(true);
    expect((await me.query(api.social.queries.peopleHubUnreadTotal, {})).capped).toBe(true);
  });

  it('returns an uncapped unread aggregate across DMs and groups', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 10; index += 1)
        await ctx.db.insert('directMessages', {
          conversationId: ids.conversationId,
          senderId: ids.annaId,
          kind: 'text',
          text: `unread ${index}`,
          createdAt: now + index,
        });
      const groupId = await ctx.db.insert('groups', {
        ownerId: ids.meId,
        name: 'Team',
        currency: 'USD',
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('groupMembers', {
        groupId,
        userId: ids.meId,
        role: 'owner',
        joinedAt: now,
      });
      await ctx.db.insert('groupMembers', {
        groupId,
        userId: ids.annaId,
        role: 'member',
        joinedAt: now,
      });
      for (let index = 0; index < 3; index += 1)
        await ctx.db.insert('groupMessages', {
          groupId,
          senderId: ids.annaId,
          kind: 'text',
          text: `group unread ${index}`,
          createdAt: now + index,
        });
      const deletedId = await ctx.db.insert('users', {
        email: 'deleted@example.com',
        displayName: 'Deleted',
        deletedAt: now,
      });
      const [userLowId, userHighId] = [ids.meId, deletedId].sort();
      const deletedConversationId = await ctx.db.insert('directConversations', {
        userLowId: userLowId!,
        userHighId: userHighId!,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('directMessages', {
        conversationId: deletedConversationId,
        senderId: deletedId,
        kind: 'text',
        text: 'hidden unread',
        createdAt: now,
      });
    });
    const anna = (await me.query(api.social.queries.peopleHub, {})).people.find(
      (person) => person.id === ids.annaId,
    );
    expect(anna).toMatchObject({ unreadCount: 9, unreadCapped: true });
    expect(await me.query(api.social.queries.peopleHubUnreadTotal, {})).toEqual({
      count: 15,
      capped: false,
    });
  });

  it('builds 30-day person analytics only for connected people', async () => {
    const { ids, me } = await seed();
    const anna = await me.query(api.social.queries.personAnalytics, { userId: ids.annaId });
    expect(anna?.days).toHaveLength(30);
    expect(anna?.totalMessagesCapped).toBe(false);
    const sent = anna!.days.reduce((sum, day) => sum + day.sent, 0);
    const received = anna!.days.reduce((sum, day) => sum + day.received, 0);
    expect([sent, received]).toEqual([1, 2]);
    expect(anna?.mix.text).toBe(3);
    expect(
      await me.query(api.social.queries.personAnalytics, { userId: ids.strangerId }),
    ).toBeNull();
    expect(await me.query(api.social.queries.personAnalytics, { userId: ids.meId })).toBeNull();
  });

  it('uses timezone calendar days rather than a fixed offset', async () => {
    const { ids, me } = await seed();
    const zone = 'America/Los_Angeles';
    const analytics = await me.query(api.social.queries.personAnalytics, {
      userId: ids.annaId,
      timeZone: zone,
      tzOffsetMinutes: 0,
    });
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const localDates = analytics!.days.map((day) => {
      const parts = formatter.formatToParts(day.dayStart);
      const value = (type: string) => parts.find((part) => part.type === type)?.value;
      expect([value('hour'), value('minute')]).toEqual(['00', '00']);
      return `${value('year')}-${value('month')}-${value('day')}`;
    });
    expect(new Set(localDates).size).toBe(30);
    for (let index = 1; index < analytics!.days.length; index += 1) {
      const duration = analytics!.days[index]!.dayStart - analytics!.days[index - 1]!.dayStart;
      expect(duration).toBeGreaterThanOrEqual(23 * 60 * 60_000);
      expect(duration).toBeLessThanOrEqual(25 * 60 * 60_000);
    }
  });
  it('uses the caller timezone offset instead of the saved timezone', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert('userSettings', {
        userId: ids.meId,
        currency: 'USD',
        timezone: 'America/Los_Angeles',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: {},
        appLockPreferences: {},
        updatedAt: now,
      });
    });
    const analytics = await me.query(api.social.queries.personAnalytics, {
      userId: ids.annaId,
      tzOffsetMinutes: 330,
    });
    const expectedOffset = 330 * 60_000;
    expect(
      analytics!.days.every(
        (day) => ((day.dayStart % 86_400_000) + 86_400_000) % 86_400_000 === expectedOffset,
      ),
    ).toBe(true);
  });


  it('keeps newest analytics messages and marks capped totals as lower bounds', async () => {
    const { t, ids, me } = await seed();
    await t.run(async (ctx) => {
      const now = Date.now();
      for (let index = 0; index < 2000; index += 1)
        await ctx.db.insert('directMessages', {
          conversationId: ids.conversationId,
          senderId: ids.annaId,
          kind: 'text',
          text: `older ${index}`,
          createdAt: now - 10 * 24 * 60 * 60_000 + index,
        });
      await ctx.db.insert('directMessages', {
        conversationId: ids.conversationId,
        senderId: ids.annaId,
        kind: 'text',
        text: 'newest',
        createdAt: now,
      });
    });
    const anna = await me.query(api.social.queries.personAnalytics, { userId: ids.annaId });
    expect(anna?.totalMessages).toBe(2000);
    expect(anna?.totalMessagesCapped).toBe(true);
    expect(anna?.days[29]?.received).toBeGreaterThan(0);
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
    expect(formatLowerBound(2000, true)).toBe('2000+');
    expect(formatLowerBound(8, false)).toBe('8');
    expect(isAnalyticsLinkAvailable(null, false, 1)).toBe(false);
    expect(isAnalyticsLinkAvailable({ conversationId: null }, false, 1)).toBe(true);
    expect(isAnalyticsLinkAvailable({ conversationId: null }, false, 0)).toBe(false);
    expect(isAnalyticsLinkAvailable(null, true, 0)).toBe(false);
    expect(isTimestampInRange(90, 100, 200)).toBe(false);
    expect(isTimestampInRange(100, 100, 200)).toBe(true);
    expect(isTimestampInRange(200, 100, 200)).toBe(false);
    expect(unreadBadge(9, true)).toBe('9+');
    expect(matchesHubSearch({ displayName: 'Anna', username: 'anna_k' }, '@ANNA_')).toBe(true);
    expect(matchesHubSearch({ name: 'Trip' }, 'rent')).toBe(false);
  });
});
