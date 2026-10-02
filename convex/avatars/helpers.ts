import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';

export async function avatarUrlForUser(ctx: QueryCtx, user: Doc<'users'>): Promise<string | null> {
  if (user.image) return user.image;
  const storageId = user.avatarStorageId as Id<'_storage'> | undefined;
  return storageId ? ctx.storage.getUrl(storageId) : null;
}
