import type { Doc } from '../_generated/dataModel';

/**
 * Whether an account may use API credentials. Deleted accounts never can; any suspension or ban
 * marker on the user record (`bannedAt`, `suspendedAt`, `disabledAt`) also stops every token.
 */
export function isActiveUser(user: Doc<'users'> | null | undefined): user is Doc<'users'> {
  if (!user || user.deletedAt !== undefined) return false;
  const record = user as Record<string, unknown>;
  for (const field of ['bannedAt', 'suspendedAt', 'disabledAt']) {
    const value = record[field];
    if (typeof value === 'number' && value <= Date.now()) return false;
  }
  return record.banned !== true && record.status !== 'banned' && record.status !== 'suspended';
}

/** Personal access tokens a user may hold at once (active, not revoked or expired). */
export const MAX_ACTIVE_TOKENS = 25;
export const MAX_APPS_PER_USER = 10;
export const MAX_WEBHOOKS_PER_USER = 10;
