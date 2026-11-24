import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { createNotification, MARK_ALL_READ_LIMIT } from '../../convex/notifications/mutations';
import { MAX_PUSH_DEVICES } from '../../convex/notifications/push';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';

vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
afterAll(() => vi.unstubAllEnvs());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const modules = import.meta.glob('../../convex/**/*.ts');

type Person = 'owner' | 'member' | 'other';
const people: Record<Person, { subject: string; email: string; name: string }> = {
  owner: { subject: 'notify-owner', email: 'owner@example.com', name: 'Owner' },
  member: { subject: 'notify-member', email: 'member@example.com', name: 'Member' },
  other: { subject: 'notify-other', email: 'other@example.com', name: 'Other' },
};

async function setup() {
  const t = convexTest(schema, modules);
  const ids = {} as Record<Person, Id<'users'>>;
  for (const [key, person] of Object.entries(people) as [Person, (typeof people)[Person]][])
    ids[key] = await t.run((ctx) =>
      ctx.db.insert('users', {
        emailVerificationTime: 1,
        identityId: person.subject,
        email: person.email,
        name: person.name,
        displayName: person.name,
        username: `${key}_user`,
      }),
    );
  for (const userId of Object.values(ids))
    await t.run((ctx) =>
      ctx.db.insert('userSettings', {
        userId,
        currency: 'INR',
        timezone: 'UTC',
        firstDayOfWeek: 1,
        financialMonthStart: 1,
        language: 'en',
        appearance: 'system',
        notificationPreferences: defaultNotificationPreferences,
        appLockPreferences: { enabled: false, fallback: 'device-pin' },
        updatedAt: 1,
      }),
    );
  const as = (person: Person) => t.withIdentity(people[person]);
  for (const person of Object.keys(people) as Person[])
    await as(person).mutation(api.accounts.mutations.create, {
      name: `${person} bank`,
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
  return { t, ids, as };
}

const token = (suffix: string) => `ExponentPushToken[device_${suffix}_token]`;

async function notificationsOf(t: Awaited<ReturnType<typeof setup>>['t'], userId: Id<'users'>) {
  return t.run((ctx) =>
    ctx.db
      .query('notifications')
      .withIndex('by_recipient_createdAt', (query) => query.eq('recipientId', userId))
      .collect(),
  );
}

describe('mark all read', () => {
  it('marks every unread notification in one call and records sync changes', async () => {
    const { t, ids, as } = await setup();
    for (const key of ['a', 'b', 'c'])
      await t.run((ctx) =>
        createNotification(ctx, ids.owner, `test:${key}`, 'budget', 'budget', key, key, key),
      );
    const [first] = await notificationsOf(t, ids.owner);
    await as('owner').mutation(api.notifications.mutations.markRead, {
      notificationId: first!._id,
      clientMutationId: 'read-first',
    });
    const firstReadAt = (await t.run((ctx) => ctx.db.get(first!._id)))?.readAt;
    const changesBefore = await t.run((ctx) => ctx.db.query('syncChanges').collect());
    const result = await as('owner').mutation(api.notifications.mutations.markAllRead, {
      clientMutationId: 'read-all',
    });
    expect(result).toEqual({ count: 2, more: false });
    const after = await notificationsOf(t, ids.owner);
    expect(after.every((item) => item.readAt !== undefined)).toBe(true);
    expect(after.find((item) => item._id === first!._id)?.readAt).toBe(firstReadAt);
    const changes = await t.run((ctx) => ctx.db.query('syncChanges').collect());
    const added = changes.slice(changesBefore.length);
    expect(added).toHaveLength(2);
    expect(added.every((change) => change.entityType === 'notifications')).toBe(true);
    // Replays return the stored result without new writes.
    expect(
      await as('owner').mutation(api.notifications.mutations.markAllRead, {
        clientMutationId: 'read-all',
      }),
    ).toEqual({ count: 2, more: false });
    expect(await t.run((ctx) => ctx.db.query('syncChanges').collect())).toHaveLength(
      changes.length,
    );
    // The receipt carries an entity and a revision, so client outboxes can settle it.
    const receipt = await as('owner').query(api.sync.queries.mutationReceipt, {
      clientMutationId: 'read-all',
    });
    expect(receipt?.serverId).toBe(String(ids.owner));
    expect(receipt?.revision).toBeTruthy();
  });

  it('finishes more than one batch in the background', async () => {
    vi.useFakeTimers();
    const { t, ids, as } = await setup();
    await t.run(async (ctx) => {
      for (let index = 0; index < MARK_ALL_READ_LIMIT + 3; index++)
        await createNotification(
          ctx,
          ids.owner,
          `bulk:${index}`,
          'budget',
          'budget',
          `${index}`,
          't',
          'b',
        );
    });
    const result = await as('owner').mutation(api.notifications.mutations.markAllRead, {
      clientMutationId: 'bulk-read',
    });
    expect(result).toEqual({ count: MARK_ALL_READ_LIMIT, more: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const after = await notificationsOf(t, ids.owner);
    expect(after.filter((item) => item.readAt === undefined)).toHaveLength(0);
  });

  it('leaves newer notifications and other users untouched', async () => {
    const { t, ids, as } = await setup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    await t.run((ctx) =>
      createNotification(ctx, ids.owner, 'old', 'budget', 'budget', 'b', 'o', 'o'),
    );
    await t.run((ctx) =>
      createNotification(ctx, ids.member, 'm', 'budget', 'budget', 'b', 'm', 'm'),
    );
    const cutoff = Date.now();
    vi.setSystemTime(new Date('2026-03-01T00:05:00Z'));
    await t.run((ctx) =>
      createNotification(ctx, ids.owner, 'new', 'budget', 'budget', 'b', 'n', 'n'),
    );
    await as('owner').mutation(api.notifications.mutations.markAllRead, {
      before: cutoff,
      clientMutationId: 'read-before',
    });
    const owner = await notificationsOf(t, ids.owner);
    expect(owner.find((item) => item.eventKey === 'old')?.readAt).toEqual(expect.any(Number));
    expect(owner.find((item) => item.eventKey === 'new')?.readAt).toBeUndefined();
    expect((await notificationsOf(t, ids.member))[0]?.readAt).toBeUndefined();
  });
});

describe('preferences', () => {
  it('keeps the stored split preference when an older client omits it', async () => {
    const { t, ids, as } = await setup();
    const base = {
      transaction: false,
      budget: true,
      goal: true,
      recurring: true,
      group: true,
      settlement: true,
      security: true,
      sync: true,
    };
    await as('owner').mutation(api.notifications.mutations.setPreferences, {
      preferences: { ...base, split: false },
      clientMutationId: 'prefs-1',
    });
    await as('owner').mutation(api.notifications.mutations.setPreferences, {
      preferences: base,
      clientMutationId: 'prefs-2',
    });
    const settings = await t.run((ctx) =>
      ctx.db
        .query('userSettings')
        .withIndex('by_user', (query) => query.eq('userId', ids.owner))
        .unique(),
    );
    expect(settings?.notificationPreferences).toMatchObject({ split: false, group: true });
    await t.run((ctx) =>
      createNotification(ctx, ids.owner, 'split:1', 'split', 'transaction', 't1', 'Split', 'x'),
    );
    expect(await notificationsOf(t, ids.owner)).toEqual([]);
  });
});

describe('push devices', () => {
  it('registers, deduplicates, moves tokens between accounts, and unregisters', async () => {
    const { t, ids, as } = await setup();
    await expect(
      as('owner').mutation(api.notifications.push.registerDevice, {
        token: 'not-a-token',
        platform: 'ios',
        deviceId: 'phone',
      }),
    ).rejects.toThrow('INVALID_PUSH_TOKEN');
    await as('owner').mutation(api.notifications.push.registerDevice, {
      token: token('one'),
      platform: 'ios',
      deviceId: 'phone',
    });
    await as('owner').mutation(api.notifications.push.registerDevice, {
      token: token('one'),
      platform: 'ios',
      deviceId: 'phone',
    });
    // Same device, rotated token: replaces the old row.
    await as('owner').mutation(api.notifications.push.registerDevice, {
      token: token('two'),
      platform: 'ios',
      deviceId: 'phone',
    });
    let devices = await t.run((ctx) => ctx.db.query('pushDevices').collect());
    expect(devices).toEqual([
      expect.objectContaining({ userId: ids.owner, token: token('two'), deviceId: 'phone' }),
    ]);
    // Another account signs in on the same device.
    await as('member').mutation(api.notifications.push.registerDevice, {
      token: token('two'),
      platform: 'ios',
      deviceId: 'phone',
    });
    devices = await t.run((ctx) => ctx.db.query('pushDevices').collect());
    expect(devices).toEqual([expect.objectContaining({ userId: ids.member })]);
    // Only the owner of a token can unregister it.
    expect(
      await as('owner').mutation(api.notifications.push.unregisterDevice, { token: token('two') }),
    ).toBe(0);
    expect(
      await as('member').mutation(api.notifications.push.unregisterDevice, { token: token('two') }),
    ).toBe(1);
    expect(await t.run((ctx) => ctx.db.query('pushDevices').collect())).toEqual([]);
  });

  it('caps devices per user, dropping the least recently seen', async () => {
    const { t, ids, as } = await setup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
    for (let index = 0; index < MAX_PUSH_DEVICES + 2; index++) {
      vi.advanceTimersByTime(1000);
      await as('owner').mutation(api.notifications.push.registerDevice, {
        token: token(`cap${index}`),
        platform: 'android',
        deviceId: `device-${index}`,
      });
    }
    const devices = await t.run((ctx) =>
      ctx.db
        .query('pushDevices')
        .withIndex('by_user', (query) => query.eq('userId', ids.owner))
        .collect(),
    );
    expect(devices).toHaveLength(MAX_PUSH_DEVICES);
    expect(devices.map((device) => device.deviceId)).not.toContain('device-0');
    expect(devices.map((device) => device.deviceId)).not.toContain('device-1');
  });

  it('schedules delivery only for users with devices and prunes unregistered tokens', async () => {
    const { t, ids, as } = await setup();
    await t.run((ctx) =>
      createNotification(ctx, ids.owner, 'no-device', 'budget', 'budget', 'b', 'T', 'B'),
    );
    expect(await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())).toEqual([]);
    await as('owner').mutation(api.notifications.push.registerDevice, {
      token: token('live'),
      platform: 'ios',
      deviceId: 'phone',
    });
    await as('owner').mutation(api.notifications.push.registerDevice, {
      token: token('gone'),
      platform: 'android',
      deviceId: 'tablet',
    });
    const fetch = vi.fn(async (_url: string, init: { body: string }) => {
      const messages = JSON.parse(init.body) as { to: string }[];
      return new Response(
        JSON.stringify({
          data: messages.map((message) =>
            message.to === token('gone')
              ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
              : { status: 'ok', id: 'ticket' },
          ),
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetch);
    vi.useFakeTimers();
    await t.run((ctx) =>
      createNotification(
        ctx,
        ids.owner,
        'settlement:s1',
        'settlement',
        'settlement',
        'group-1',
        'Settlement recorded',
        'Paid',
      ),
    );
    const scheduled = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect());
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({
      name: expect.stringContaining('notifications/push'),
      args: [expect.objectContaining({ url: '/group/group-1/balances' })],
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    const sent = JSON.parse(init.body) as { to: string; data: { url: string } }[];
    expect(sent.map((message) => message.to).sort()).toEqual([token('gone'), token('live')].sort());
    expect(sent[0]!.data.url).toBe('/group/group-1/balances');
    const remaining = await t.run((ctx) => ctx.db.query('pushDevices').collect());
    expect(remaining.map((device) => device.token)).toEqual([token('live')]);
  });

  it('batches more than 100 tokens into several requests', async () => {
    const { t, ids } = await setup();
    await t.run(async (ctx) => {
      for (let index = 0; index < 150; index++)
        await ctx.db.insert('pushDevices', {
          userId: ids.owner,
          token: token(`batch${index}`),
          platform: 'ios',
          deviceId: `d${index}`,
          lastSeenAt: index,
        });
    });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const ownerNotification = await t.run((ctx) =>
      ctx.db.insert('notifications', {
        recipientId: ids.owner,
        type: 'budget',
        title: 'T',
        body: 'B',
        createdAt: 1,
      }),
    );
    await t.action(internal.notifications.push.deliver, {
      recipientId: ids.owner,
      notificationId: ownerNotification,
      title: 'T',
      body: 'B',
      url: '/budget/b',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('payment reminders', () => {
  async function groupWithDebt() {
    const context = await setup();
    const { as, ids } = context;
    const groupId = await as('owner').mutation(api.groups.mutations.create, {
      name: 'Flat',
      currency: 'INR',
      memberUsernames: [],
    });
    await context.t.run((ctx) =>
      ctx.db.insert('groupMembers', {
        groupId,
        userId: ids.member,
        role: 'member',
        joinedAt: Date.UTC(2026, 0, 1),
      }),
    );
    const accountId = await context.t.run(async (ctx) => {
      const account = await ctx.db
        .query('accounts')
        .filter((query) => query.eq(query.field('ownerId'), ids.owner))
        .first();
      return account!._id;
    });
    const [low, high] = [ids.owner, ids.member].sort();
    await as('owner').mutation(api.groups.mutations.addExpense, {
      groupId,
      accountId,
      title: 'Dinner',
      amountMinor: 3000n,
      currency: 'INR',
      occurredAt: Date.UTC(2026, 5, 1),
      participants: [
        { userId: low!, amountMinor: 1500n, method: 'equal' },
        { userId: high!, amountMinor: 1500n, method: 'equal' },
      ],
    });
    return { ...context, groupId };
  }

  it('hands ownership to a member, keeping the old owner as admin', async () => {
    const { t, ids, as, groupId } = await groupWithDebt();
    await expect(
      as('member').mutation(api.groups.mutations.transferOwnership, {
        groupId,
        newOwnerId: ids.member,
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await as('owner').mutation(api.groups.mutations.transferOwnership, {
      groupId,
      newOwnerId: ids.member,
    });
    const roles = await t.run(async (ctx) => ({
      ownerId: (await ctx.db.get(groupId))!.ownerId,
      members: await ctx.db
        .query('groupMembers')
        .withIndex('by_group', (q) => q.eq('groupId', groupId))
        .collect(),
    }));
    expect(roles.ownerId).toBe(ids.member);
    expect(roles.members.find((m) => m.userId === ids.member)?.role).toBe('owner');
    expect(roles.members.find((m) => m.userId === ids.owner)?.role).toBe('admin');
  });

  it('charges the owner account only for what the owner paid', async () => {
    const { t, ids, as, groupId } = await groupWithDebt();
    const expense = await t.run(async (ctx) =>
      (await ctx.db.query('transactions').collect()).find((row) => row.groupId === groupId),
    );
    const before = (await as('owner').query(api.accounts.queries.list, {}))[0]!.balanceMinor;
    const [low, high] = [ids.owner, ids.member].sort();
    await as('owner').mutation(api.groups.mutations.updateExpense, {
      transactionId: expense!._id,
      accountId: expense!.accountId,
      title: 'Dinner',
      amountMinor: 3000n,
      currency: 'INR',
      occurredAt: expense!.occurredAt,
      participants: [
        { userId: low!, amountMinor: 1500n, method: 'equal' },
        { userId: high!, amountMinor: 1500n, method: 'equal' },
      ],
      payers: [
        { userId: ids.owner, amountMinor: 1000n },
        { userId: ids.member, amountMinor: 2000n },
      ],
      expectedVersion: expense!.version ?? 1,
    });
    const after = (await as('owner').query(api.accounts.queries.list, {}))[0]!.balanceMinor;
    // The account was charged 3000 before; now only the owner's 1000.
    expect(after - before).toBe(2000n);
  });

  it('tells the creditor when the debtor muted reminders', async () => {
    const { t, ids, as, groupId } = await groupWithDebt();
    await t.run(async (ctx) => {
      const settings = await ctx.db
        .query('userSettings')
        .withIndex('by_user', (q) => q.eq('userId', ids.member))
        .unique();
      await ctx.db.patch(settings!._id, {
        notificationPreferences: { ...defaultNotificationPreferences, settlement: false },
      });
    });
    expect(
      await as('owner').mutation(api.notifications.mutations.nudge, {
        groupId,
        userId: ids.member,
      }),
    ).toMatchObject({ status: 'muted' });
    expect(
      (await notificationsOf(t, ids.member)).filter((item) => item.eventKey?.startsWith('nudge:')),
    ).toHaveLength(0);
  });

  it('lets a creditor remind a debtor once per day', async () => {
    const { t, ids, as, groupId } = await groupWithDebt();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T10:00:00Z'));
    const first = await as('owner').mutation(api.notifications.mutations.nudge, {
      groupId,
      userId: ids.member,
    });
    expect(first).toEqual({ status: 'sent', amountMinor: 1500n });
    const reminders = (await notificationsOf(t, ids.member)).filter((item) =>
      item.eventKey?.startsWith('nudge:'),
    );
    expect(reminders).toEqual([
      expect.objectContaining({
        type: 'settlement',
        entityType: 'paymentReminder',
        entityId: `${groupId}:${ids.owner}`,
        title: 'Owner sent a payment reminder',
      }),
    ]);
    vi.setSystemTime(new Date('2026-06-02T20:00:00Z'));
    expect(
      await as('owner').mutation(api.notifications.mutations.nudge, {
        groupId,
        userId: ids.member,
      }),
    ).toMatchObject({ status: 'alreadySent' });
    vi.setSystemTime(new Date('2026-06-03T10:00:00Z'));
    expect(
      await as('owner').mutation(api.notifications.mutations.nudge, {
        groupId,
        userId: ids.member,
      }),
    ).toMatchObject({ status: 'sent' });
  });

  it('rejects reminders when the target does not owe the caller', async () => {
    const { ids, as, groupId } = await groupWithDebt();
    await expect(
      as('member').mutation(api.notifications.mutations.nudge, { groupId, userId: ids.owner }),
    ).rejects.toThrow('NOTHING_OWED');
    await expect(
      as('owner').mutation(api.notifications.mutations.nudge, { groupId, userId: ids.owner }),
    ).rejects.toThrow('INVALID_NUDGE_TARGET');
    await expect(
      as('other').mutation(api.notifications.mutations.nudge, { groupId, userId: ids.member }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await expect(
      as('owner').mutation(api.notifications.mutations.nudge, { groupId, userId: ids.other }),
    ).rejects.toThrow('INVALID_NUDGE_TARGET');
  });
});
