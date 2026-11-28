/**
 * Server-side guard for every admin query and mutation:
 *
 *   const admin = await requireAdminPermission(ctx, 'VIEW_USERS');
 *
 * Resolves the signed-in FinApp user (banned users never get here: `getOptionalUser` returns
 * null for them), loads their staff roles and throws `ADMIN_FORBIDDEN` unless the permission is
 * granted. Client-side checks only hide UI; this is the enforcement point.
 */
import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { avatarUrlForUser } from '../avatars/helpers';
import { getOptionalUser } from '../shared/auth';
import {
  effectivePermissions,
  highestPosition,
  isOwner,
  type AdminPermission,
} from './permissions';

type Ctx = QueryCtx | MutationCtx;

export type AdminContext = {
  user: Doc<'users'>;
  member: Doc<'adminMembers'>;
  roles: Doc<'adminRoles'>[];
  permissions: Set<AdminPermission>;
  highest: number;
  owner: boolean;
};

export function adminError(code: string, extra: Record<string, unknown> = {}) {
  return new ConvexError({ code, ...extra });
}

export async function memberFor(ctx: Ctx, userId: Id<'users'>) {
  return ctx.db
    .query('adminMembers')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
}

export async function rolesOf(ctx: Ctx, member: Doc<'adminMembers'> | null) {
  if (!member) return [];
  const roles = await Promise.all(member.roleIds.map((id) => ctx.db.get(id)));
  return roles.filter((role): role is Doc<'adminRoles'> => role !== null);
}

export async function settingValue<T>(ctx: Ctx, key: string, fallback: T): Promise<T> {
  const row = await ctx.db
    .query('adminSettings')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique();
  return row ? (row.value as T) : fallback;
}

/** Whether the user has a second sign-in factor (email code or authenticator app). */
export async function hasSecondFactor(ctx: Ctx, user: Doc<'users'>): Promise<boolean> {
  const settings = await ctx.db
    .query('userSettings')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  if (settings?.twoFactorEnabled ?? user.signupTwoFactorEnabled ?? false) return true;
  const factors = await ctx.db
    .query('mfaFactors')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .unique();
  return Boolean(factors?.totpSecret && factors.totpConfirmedAt !== undefined);
}

/** The staff context for the signed-in user, or null when they aren't staff. */
export async function getAdminContext(ctx: Ctx): Promise<AdminContext | null> {
  const user = await getOptionalUser(ctx);
  if (!user || user.deletedAt !== undefined) return null;
  const member = await memberFor(ctx, user._id);
  if (!member) return null;
  const roles = await rolesOf(ctx, member);
  if (!roles.length) return null;
  return {
    user,
    member,
    roles,
    permissions: effectivePermissions(roles),
    highest: highestPosition(roles),
    owner: isOwner(roles),
  };
}

/** Throws unless the signed-in user is staff with `permission` (and passes the MFA policy). */
export async function requireAdminPermission(
  ctx: Ctx,
  permission: AdminPermission | null,
): Promise<AdminContext> {
  const admin = await getAdminContext(ctx);
  if (!admin) throw adminError('ADMIN_FORBIDDEN');
  // Optional policy: staff (other than owners, so the console can't lock itself out) must have
  // a second sign-in factor.
  if (!admin.owner && (await settingValue(ctx, 'requireStaffMfa', false))) {
    if (!(await hasSecondFactor(ctx, admin.user))) throw adminError('ADMIN_MFA_REQUIRED');
  }
  if (permission && !admin.permissions.has(permission))
    throw adminError('ADMIN_FORBIDDEN', { permission });
  return admin;
}

/** Throws unless the staff member holds at least one of the permissions. */
export async function requireAnyAdminPermission(
  ctx: Ctx,
  permissions: readonly AdminPermission[],
): Promise<AdminContext> {
  const admin = await requireAdminPermission(ctx, null);
  if (!permissions.some((permission) => admin.permissions.has(permission)))
    throw adminError('ADMIN_FORBIDDEN', { permission: permissions[0] });
  return admin;
}

/** Records an admin action. `detail` must be metadata only (names, ids, flags), never content. */
export async function logAdminAction(
  ctx: MutationCtx,
  actorId: Id<'users'>,
  action: string,
  targetType: string,
  targetId?: string,
  detail?: string,
) {
  await ctx.db.insert('adminAuditLog', {
    actorId,
    action,
    targetType,
    ...(targetId ? { targetId } : {}),
    ...(detail ? { detail: detail.slice(0, 500) } : {}),
    createdAt: Date.now(),
  });
}

/** Records a security event (no content; identifiers must already be hashed). */
export async function recordSecurityEvent(
  ctx: MutationCtx,
  event: {
    kind: string;
    userId?: Id<'users'>;
    actorId?: Id<'users'>;
    identifierHash?: string;
    platform?: string;
  },
) {
  await ctx.db.insert('securityEvents', { ...event, createdAt: Date.now() });
}

/** Public-safe user card for admin tables (usage-only metadata). */
export async function userCard(ctx: Ctx, userId: Id<'users'>) {
  const user = await ctx.db.get(userId);
  if (!user) return null;
  return {
    id: user._id,
    username: user.username ?? null,
    displayName: user.displayName ?? user.name ?? 'Finapp user',
    avatarId: user.avatarId ?? null,
    avatarUrl: await avatarUrlForUser(ctx, user),
    deleted: user.deletedAt !== undefined,
  };
}
