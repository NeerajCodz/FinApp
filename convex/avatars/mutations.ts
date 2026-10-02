import { internalMutation } from '../_generated/server';

export const removeCatalogStorage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query('avatars').collect();
    const users = await ctx.db.query('users').collect();
    const userAvatarStorageIds = new Set(
      users.flatMap((user) => (user.avatarStorageId ? [user.avatarStorageId] : [])),
    );
    const storageIds = new Set(
      entries.flatMap((entry) => (entry.storageId ? [entry.storageId] : [])),
    );
    let deletedObjects = 0;
    let preservedUserObjects = 0;

    for (const storageId of storageIds) {
      if (userAvatarStorageIds.has(storageId)) {
        preservedUserObjects++;
        continue;
      }
      if (await ctx.db.system.get('_storage', storageId)) {
        await ctx.storage.delete(storageId);
        deletedObjects++;
      }
    }

    let clearedEntries = 0;
    const updatedAt = Date.now();
    for (const entry of entries) {
      if (entry.storageId !== undefined || entry.url !== undefined) {
        await ctx.db.patch(entry._id, {
          storageId: undefined,
          url: undefined,
          updatedAt,
        });
        clearedEntries++;
      }
    }
    return {
      catalogEntries: entries.length,
      deletedObjects,
      preservedUserObjects,
      clearedEntries,
    };
  },
});
