import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Doc } from '../_generated/dataModel';
import { ConvexError } from 'convex/values';
import { activeRestriction } from '../admin/restrictions';

type Identity = { subject: string; email?: string; name?: string; image?: string; phone?: string };
type AuthIdentityContext = { auth: { getUserIdentity: () => Promise<unknown> } };

function asIdentity(value: unknown): Identity | null {
  if (
    !value ||
    typeof value !== 'object' ||
    !('subject' in value) ||
    typeof value.subject !== 'string'
  )
    return null;
  const record = value as Record<string, unknown>;
  return {
    subject: value.subject,
    email: typeof record.email === 'string' ? record.email : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    image: typeof record.image === 'string' ? record.image : undefined,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
  };
}

export async function requireIdentity(ctx: AuthIdentityContext): Promise<Identity> {
  const identity = asIdentity(await ctx.auth.getUserIdentity());
  if (!identity) throw new Error('AUTH_REQUIRED');
  return identity;
}

async function findUserForIdentity(
  db: QueryCtx['db'],
  identity: Identity,
): Promise<Doc<'users'> | null> {
  const indexedUser = await db
    .query('users')
    .withIndex('by_identityId', (query) => query.eq('identityId', identity.subject))
    .unique();
  if (indexedUser) return indexedUser;

  // Convex Auth uses `<userId>|<sessionId>` as the JWT subject. Legacy
  // users created by our identity-based flow are still resolved by index.
  const userId = db.normalizeId('users', identity.subject.split('|', 1)[0] ?? '');
  return userId ? db.get(userId) : null;
}

/**
 * The signed-in user whatever their account state (no ban check). Only for the few places that
 * must work for suspended accounts, such as the account-status query behind the suspended screen.
 */
export async function getIdentityUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'> | null> {
  const identity = asIdentity(await ctx.auth.getUserIdentity());
  if (!identity) return null;
  return findUserForIdentity(ctx.db, identity);
}

/** The signed-in user, or null when signed out or banned/suspended (see convex/admin). */
export async function getOptionalUser(ctx: QueryCtx | MutationCtx): Promise<Doc<'users'> | null> {
  const user = await getIdentityUser(ctx);
  if (!user) return null;
  return (await activeRestriction(ctx, user._id)) ? null : user;
}

/** The signed-in user (created on first use). Banned or suspended: ACCOUNT_SUSPENDED. */
export async function requireUser(ctx: MutationCtx): Promise<Doc<'users'> | null> {
  const identity = await requireIdentity(ctx);
  const existing = await findUserForIdentity(ctx.db, identity);
  if (existing) {
    if (await activeRestriction(ctx, existing._id))
      throw new ConvexError({ code: 'ACCOUNT_SUSPENDED' });
    return existing;
  }
  const now = Date.now();
  const userId = await ctx.db.insert('users', {
    identityId: identity.subject,
    displayName: identity.name ?? 'Finapp user',
    email: identity.email ?? '',
    defaultCurrency: 'INR',
    timezone: 'Asia/Kolkata',
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert('userSettings', {
    userId,
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    firstDayOfWeek: 1,
    financialMonthStart: 1,
    language: 'en',
    appearance: 'system',
    notificationPreferences: {},
    appLockPreferences: { enabled: false, fallback: 'device-pin' },
    twoFactorEnabled: false,
    updatedAt: now,
  });
  return ctx.db.get(userId);
}
