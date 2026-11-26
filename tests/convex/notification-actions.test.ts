import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { createNotification } from '../../convex/notifications/mutations';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';

const modules = import.meta.glob('../../convex/**/*.ts');

const people = {
  me: { subject: 'inbox-me', email: 'me@example.com' },
  other: { subject: 'inbox-other', email: 'other@example.com' },
} as const;

async function setup() {
  const t = convexTest(schema, modules);
  const ids = {} as Record<keyof typeof people, Id<'users'>>;
  for (const key of Object.keys(people) as (keyof typeof people)[]) {
    ids[key] = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {
        emailVerificationTime: 1,
        identityId: people[key].subject,
        email: people[key].email,
        displayName: key,
        username: `${key}_inbox`,
      });
      await ctx.db.insert('userSettings', {
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
      });
      return userId;
    });
  }
  const notificationId = (await t.run((ctx) =>
    createNotification(ctx, ids.me, 'goal:1', 'goal', 'goal', 'g1', 'Goal reached', 'Nice.'),
  ))!;
  const as = (key: keyof typeof people) => t.withIdentity(people[key]);
  return { t, ids, as, notificationId };
}

describe('notification inbox actions', () => {
  it('marks a read notification unread again and publishes the change', async () => {
    const { t, ids, as, notificationId } = await setup();
    await as('me').mutation(api.notifications.mutations.markRead, {
      notificationId,
      clientMutationId: 'read-1',
    });
    expect((await t.run((ctx) => ctx.db.get(notificationId)))?.readAt).toEqual(expect.any(Number));
    await as('me').mutation(api.notifications.mutations.markUnread, {
      notificationId,
      clientMutationId: 'unread-1',
    });
    expect((await t.run((ctx) => ctx.db.get(notificationId)))?.readAt).toBeUndefined();
    const changes = await t.run((ctx) =>
      ctx.db
        .query('syncChanges')
        .filter((query) => query.eq(query.field('scopeUserId'), ids.me))
        .collect(),
    );
    const last = changes.at(-1);
    expect(last).toMatchObject({
      documentId: String(notificationId),
      clientMutationId: 'unread-1',
    });
    expect((last?.document as { readAt?: number }).readAt).toBeUndefined();
  });

  it('deletes a notification, records a tombstone and settles retries', async () => {
    const { t, ids, as, notificationId } = await setup();
    const first = await as('me').mutation(api.notifications.mutations.remove, {
      notificationId: String(notificationId),
      clientMutationId: 'remove-1',
    });
    expect(first).toEqual({ deleted: true });
    expect(await t.run((ctx) => ctx.db.get(notificationId))).toBeNull();
    const tombstone = await t.run((ctx) =>
      ctx.db
        .query('syncChanges')
        .filter((query) =>
          query.and(
            query.eq(query.field('scopeUserId'), ids.me),
            query.eq(query.field('documentId'), String(notificationId)),
            query.neq(query.field('deletedAt'), undefined),
          ),
        )
        .unique(),
    );
    expect(tombstone?.clientMutationId).toBe('remove-1');
    const receipt = await as('me').query(api.sync.queries.mutationReceipt, {
      clientMutationId: 'remove-1',
    });
    expect(receipt).toMatchObject({
      serverId: String(notificationId),
      revision: expect.any(String),
    });

    // Replays and a second delete of the same notification succeed without changes.
    expect(
      await as('me').mutation(api.notifications.mutations.remove, {
        notificationId: String(notificationId),
        clientMutationId: 'remove-1',
      }),
    ).toEqual({ deleted: true });
    expect(
      await as('me').mutation(api.notifications.mutations.remove, {
        notificationId: String(notificationId),
        clientMutationId: 'remove-2',
      }),
    ).toEqual({ deleted: false });
  });

  it('refuses to change or delete someone else’s notification', async () => {
    const { as, notificationId } = await setup();
    await expect(
      as('other').mutation(api.notifications.mutations.markUnread, {
        notificationId,
        clientMutationId: 'x-1',
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
    await expect(
      as('other').mutation(api.notifications.mutations.remove, {
        notificationId: String(notificationId),
        clientMutationId: 'x-2',
      }),
    ).rejects.toThrow('INSUFFICIENT_PERMISSION');
  });
});
