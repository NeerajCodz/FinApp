import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { usernameProblem, validateProfileUpdate } from '../../convex/users/domain';

const modules = import.meta.glob('../../convex/**/*.ts');
const me = { subject: 'profile-me', email: 'me@example.com' };

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    await ctx.db.insert('users', {
      emailVerificationTime: 1,
      identityId: 'profile-taken',
      email: 'taken@example.com',
      username: 'taken_name',
    });
    for (const [avatarId, gender] of [
      ['AV0', 'neutral'],
      ['AV1', 'male'],
    ] as const)
      await ctx.db.insert('avatars', { avatarId, gender, createdAt: 1, updatedAt: 1 });
    return ctx.db.insert('users', {
      emailVerificationTime: 1,
      identityId: me.subject,
      email: me.email,
      displayName: 'Me',
      username: 'me_myself',
      avatarId: 'AV0',
      gender: 'neutral',
    });
  });
  return { t, userId, as: t.withIdentity(me) };
}

async function storeImage(
  t: Awaited<ReturnType<typeof setup>>['t'],
  type: string,
  bytes = 4,
): Promise<Id<'_storage'>> {
  return t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
}

describe('username rules', () => {
  it('explains what is wrong with a username', () => {
    expect(usernameProblem('')).toBe('empty');
    expect(usernameProblem('ab')).toBe('short');
    expect(usernameProblem('a'.repeat(33))).toBe('long');
    expect(usernameProblem('bad name')).toBe('characters');
    expect(usernameProblem('@Support')).toBe('reserved');
    expect(usernameProblem('@Good_Name')).toBeNull();
  });

  it('reports availability for the signed-in user', async () => {
    const { as } = await setup();
    const check = (username: string) =>
      as.query(api.users.queries.usernameAvailability, { username });
    expect(await check('me_myself')).toEqual({ status: 'current' });
    expect(await check('@Taken_Name')).toEqual({ status: 'taken' });
    expect(await check('fresh_name')).toEqual({ status: 'available' });
    expect(await check('x')).toEqual({ status: 'invalid', problem: 'short' });
    expect(await check('admin')).toEqual({ status: 'invalid', problem: 'reserved' });
  });

  it('rejects reserved usernames on update', async () => {
    const { as } = await setup();
    await expect(as.mutation(api.users.mutations.update, { username: 'support' })).rejects.toThrow(
      'USERNAME_RESERVED',
    );
  });
});

describe('bio', () => {
  it('saves a trimmed bio and rejects one that is too long', async () => {
    const { t, userId, as } = await setup();
    await as.mutation(api.users.mutations.update, { bio: '  Splits  bills\nfairly. ' });
    expect((await t.run((ctx) => ctx.db.get(userId)))?.bio).toBe('Splits bills fairly.');
    await expect(as.mutation(api.users.mutations.update, { bio: 'x'.repeat(161) })).rejects.toThrow(
      'INVALID_BIO',
    );
    expect(() => validateProfileUpdate({ displayName: 'x'.repeat(81) })).toThrow('INVALID_PROFILE');
  });

  it('shows the bio on the public profile', async () => {
    const { as, t } = await setup();
    await as.mutation(api.users.mutations.update, { bio: 'Hello there' });
    expect(await t.query(api.users.queries.publicProfile, { username: 'me_myself' })).toMatchObject(
      { bio: 'Hello there' },
    );
  });
});

describe('uploaded profile photo', () => {
  it('uses an upload instead of the preset and replaces the previous upload', async () => {
    const { t, userId, as } = await setup();
    expect(typeof (await as.mutation(api.users.mutations.generateAvatarUploadUrl, {}))).toBe(
      'string',
    );
    const first = await storeImage(t, 'image/png');
    const saved = await as.mutation(api.users.mutations.setUploadedAvatar, { storageId: first });
    expect(saved.avatarUrl).toEqual(expect.any(String));
    let user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({ avatarStorageId: String(first) });
    expect(user?.avatarId).toBeUndefined();

    const second = await storeImage(t, 'image/jpeg');
    await as.mutation(api.users.mutations.setUploadedAvatar, { storageId: second });
    expect(await t.run((ctx) => ctx.db.system.get('_storage', first))).toBeNull();

    const removed = await as.mutation(api.users.mutations.removeUploadedAvatar, {
      avatarId: 'av1',
    });
    expect(removed.avatarUrl).toBeNull();
    user = await t.run((ctx) => ctx.db.get(userId));
    expect(user).toMatchObject({ avatarId: 'AV1', gender: 'male' });
    expect(user?.avatarStorageId).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.system.get('_storage', second))).toBeNull();
  });

  it('rejects photos over the size limit', async () => {
    const { t, as } = await setup();
    const file = await storeImage(t, 'image/png', 5 * 1024 * 1024 + 1);
    await expect(
      as.mutation(api.users.mutations.setUploadedAvatar, { storageId: file }),
    ).rejects.toThrow('AVATAR_TOO_LARGE');
  });
});
