import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const user = (email: string, username: string) =>
      ctx.db.insert('users', {
        email,
        username,
        displayName: username,
        emailVerificationTime: now,
      });
    const aliceId = await user('alice@example.com', 'alice');
    const bobId = await user('bob@example.com', 'bobby');
    const session = (userId: typeof aliceId) =>
      ctx.db.insert('authSessions', { userId, expirationTime: now + 86_400_000 });
    const laptop = await session(aliceId);
    const phone = await session(aliceId);
    const old = await ctx.db.insert('authSessions', { userId: aliceId, expirationTime: now - 1 });
    const bobSession = await session(bobId);
    await ctx.db.insert('authRefreshTokens', {
      sessionId: phone,
      expirationTime: now + 86_400_000,
    } as never);
    return { aliceId, bobId, laptop, phone, old, bobSession };
  });
  const alice = (session = ids.laptop) => t.withIdentity({ subject: `${ids.aliceId}|${session}` });
  const bob = t.withIdentity({ subject: `${ids.bobId}|${ids.bobSession}` });
  return { t, ids, alice, bob };
}

describe('privacy preferences', () => {
  it('defaults to open and saves partial changes', async () => {
    const { alice } = await fixture();
    expect(await alice().query(api.security.privacy, {})).toEqual({
      showActive: true,
      showLastSeen: true,
      discoverable: true,
      friendRequests: 'everyone',
      signInAlerts: true,
    });
    expect(
      await alice().mutation(api.security.updatePrivacy, {
        discoverable: false,
        showLastSeen: false,
      }),
    ).toMatchObject({ discoverable: false, showLastSeen: false, showActive: true });
    expect(await alice().query(api.presence.queries.privacySettings, {})).toEqual({
      showActive: true,
      showLastSeen: false,
    });
  });

  it('hides people who turned off discovery, except for their exact username', async () => {
    const { alice, bob } = await fixture();
    expect((await alice().query(api.users.queries.search, { query: 'bob' })).length).toBe(1);
    await bob.mutation(api.security.updatePrivacy, { discoverable: false });
    expect(await alice().query(api.users.queries.search, { query: 'bob' })).toEqual([]);
    expect((await alice().query(api.users.queries.search, { query: 'bobby' })).length).toBe(1);
  });

  it('refuses friend requests when they are turned off', async () => {
    const { ids, alice, bob } = await fixture();
    await bob.mutation(api.security.updatePrivacy, { friendRequests: 'nobody' });
    await expect(
      alice().mutation(api.social.mutations.sendRequest, { recipientId: ids.bobId }),
    ).rejects.toThrow('FRIEND_REQUESTS_OFF');
  });
});

describe('devices', () => {
  it('lists active sessions with labels, marks this one, and alerts on a new device', async () => {
    const { t, ids, alice } = await fixture();
    await alice(ids.laptop).mutation(api.security.touchSession, {
      platform: 'web',
      label: 'Chrome on Windows',
    });
    await alice(ids.phone).mutation(api.security.touchSession, {
      platform: 'android',
      label: 'Pixel 8',
    });
    const sessions = await alice(ids.laptop).query(api.security.sessions, {});
    expect(sessions.map((row) => [row.label, row.platform, row.current])).toEqual([
      ['Chrome on Windows', 'web', true],
      ['Pixel 8', 'android', false],
    ]);
    const alerts = await t.run((ctx) => ctx.db.query('notifications').collect());
    expect(alerts.map((row) => [row.type, row.title])).toEqual([
      ['security', 'New sign-in to your account'],
      ['security', 'New sign-in to your account'],
    ]);
    expect(alerts.some((row) => row.body.startsWith('Pixel 8 signed in.'))).toBe(true);
  });

  it('signs out one device or every other device, never the current one', async () => {
    const { t, ids, alice, bob } = await fixture();
    await expect(
      alice().mutation(api.security.signOutSession, { sessionId: ids.laptop }),
    ).rejects.toThrow('CURRENT_SESSION');
    await expect(
      bob.mutation(api.security.signOutSession, { sessionId: ids.phone }),
    ).rejects.toThrow('SESSION_NOT_FOUND');
    await alice().mutation(api.security.signOutSession, { sessionId: ids.phone });
    expect(await t.run((ctx) => ctx.db.get(ids.phone))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('authRefreshTokens').collect())).toEqual([]);

    expect(await alice().mutation(api.security.signOutOtherSessions, {})).toBe(1); // the expired one
    expect((await alice().query(api.security.sessions, {})).map((row) => row.id)).toEqual([
      ids.laptop,
    ]);
    expect(await t.run((ctx) => ctx.db.get(ids.bobSession))).not.toBeNull();
  });
});

describe('account deletion request', () => {
  it('records and cancels a request, notifying the user each time', async () => {
    const { t, alice } = await fixture();
    const at = await alice().mutation(api.security.requestDeletion, {});
    expect(at).toEqual(expect.any(Number));
    expect(await alice().query(api.security.privacy, {})).toMatchObject({
      deletionRequestedAt: at,
    });
    await alice().mutation(api.security.requestDeletion, { cancel: true });
    expect(await alice().query(api.security.privacy, {})).not.toHaveProperty('deletionRequestedAt');
    const titles = (await t.run((ctx) => ctx.db.query('notifications').collect())).map(
      (row) => row.title,
    );
    expect(titles).toEqual(['Account deletion requested', 'Account deletion cancelled']);
  });
});
