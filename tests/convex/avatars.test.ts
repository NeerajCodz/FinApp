import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

describe('built-in avatar storage cleanup', () => {
  it('deletes catalog-only files and preserves profile uploads', async () => {
    const t = convexTest(schema, modules);
    const catalogStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: 'image/webp' })),
    );
    const profileStorageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([2])], { type: 'image/jpeg' })),
    );

    await t.run(async (ctx) => {
      await ctx.db.insert('users', { avatarStorageId: profileStorageId });
      for (const [avatarId, gender, storageId] of [
        ['AV0', 'neutral', catalogStorageId],
        ['AV1', 'male', profileStorageId],
        ['AV51', 'female', undefined],
      ] as const) {
        await ctx.db.insert('avatars', {
          avatarId,
          gender,
          ...(storageId ? { storageId } : {}),
          url: `https://avatars.example/${avatarId}.webp`,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    });

    const result = await t.mutation(internal.avatars.mutations.removeCatalogStorage, {});
    expect(result).toEqual({
      catalogEntries: 3,
      deletedObjects: 1,
      preservedUserObjects: 1,
      clearedEntries: 3,
    });

    const storageState = await t.run(async (ctx) => ({
      catalog: await ctx.db.system.get('_storage', catalogStorageId),
      profile: await ctx.db.system.get('_storage', profileStorageId),
      entries: await ctx.db.query('avatars').collect(),
    }));
    expect(storageState.catalog).toBeNull();
    expect(storageState.profile).not.toBeNull();
    expect(
      storageState.entries.every(
        (entry) => entry.storageId === undefined && entry.url === undefined,
      ),
    ).toBe(true);
  });
});
