import { v } from 'convex/values';
import { internalMutation } from '../_generated/server';
import { avatarGenderForId } from './domain';

export const generateUploadUrls = internalMutation({
  args: { avatarIds: v.array(v.string()) },
  handler: async (ctx, { avatarIds }) => {
    const unique = new Set(avatarIds);
    if (unique.size !== avatarIds.length || avatarIds.some((id) => avatarGenderForId(id) === null))
      throw new Error('INVALID_AVATAR_CATALOG');
    return Promise.all(
      avatarIds.map(async (avatarId) => ({
        avatarId,
        uploadUrl: await ctx.storage.generateUploadUrl(),
      })),
    );
  },
});

export const upsertCatalog = internalMutation({
  args: {
    entries: v.array(v.object({ avatarId: v.string(), storageId: v.id('_storage') })),
  },
  handler: async (ctx, { entries }) => {
    const seen = new Set<string>();
    let upserted = 0;
    for (const { avatarId, storageId } of entries) {
      const gender = avatarGenderForId(avatarId);
      if (!gender || seen.has(avatarId)) throw new Error('INVALID_AVATAR_CATALOG');
      seen.add(avatarId);
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new Error('AVATAR_STORAGE_MISSING');
      const current = await ctx.db
        .query('avatars')
        .withIndex('by_avatarId', (query) => query.eq('avatarId', avatarId))
        .unique();
      const value = { avatarId, gender, storageId, url, updatedAt: Date.now() };
      if (current) await ctx.db.patch(current._id, value);
      else await ctx.db.insert('avatars', { ...value, createdAt: Date.now() });
      upserted++;
    }
    return { upserted };
  },
});
