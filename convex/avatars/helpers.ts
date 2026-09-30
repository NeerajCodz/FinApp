import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

export async function avatarUrlForUser(ctx: QueryCtx, user: Doc<'users'>): Promise<string | null> {
  if (user.avatarId) {
    const avatar = await ctx.db
      .query('avatars')
      .withIndex('by_avatarId', (query) => query.eq('avatarId', user.avatarId!))
      .unique();
    if (avatar) return avatar.url;
  }
  if (user.image) return user.image;
  const storageId = user.avatarStorageId as Id<'_storage'> | undefined;
  return storageId ? ctx.storage.getUrl(storageId) : null;
}
