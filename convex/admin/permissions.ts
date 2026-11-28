/**
 * Staff permissions and the Discord-style role hierarchy, as pure functions (no database), so
 * the rules can be tested on their own and shared with the admin console.
 *
 * Rules:
 * - A member's permissions are the union of their roles' permissions. ADMINISTRATOR grants all.
 * - Roles are ordered by `position` (higher ranks higher). The Owner role (`system: 'owner'`)
 *   ranks above every other role and implies every permission.
 * - You can only edit, delete, assign or remove roles strictly below your own highest role.
 * - You can only grant permissions you hold yourself.
 * - You can only act on staff members whose highest role is below yours; nobody but an owner
 *   (acting on themselves) can take the Owner role away from an owner.
 */

export const ADMIN_PERMISSIONS = [
  'ADMINISTRATOR',
  'VIEW_ANALYTICS',
  'VIEW_USERS',
  'MANAGE_USERS',
  'BAN_USERS',
  'VIEW_GROUPS',
  'MANAGE_GROUPS',
  'MANAGE_ROLES',
  'ASSIGN_ROLES',
  'VIEW_AUDIT_LOG',
  'VIEW_SECURITY',
  'MANAGE_TICKETS',
  'VIEW_TICKETS',
  'MANAGE_REPORTS',
  'MANAGE_ANNOUNCEMENTS',
  'MANAGE_SETTINGS',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<AdminPermission, { label: string; description: string }> = {
  ADMINISTRATOR: {
    label: 'Administrator',
    description: 'Every permission. Still limited by role order.',
  },
  VIEW_ANALYTICS: { label: 'View analytics', description: 'Usage dashboards and KPIs.' },
  VIEW_USERS: { label: 'View users', description: 'Search users and see usage-only details.' },
  MANAGE_USERS: {
    label: 'Manage users',
    description: 'Sign users out everywhere, add staff notes.',
  },
  BAN_USERS: { label: 'Ban users', description: 'Suspend, ban and unban accounts.' },
  VIEW_GROUPS: { label: 'View groups', description: 'Group metadata and activity counts.' },
  MANAGE_GROUPS: { label: 'Manage groups', description: 'Moderate reported groups.' },
  MANAGE_ROLES: { label: 'Manage roles', description: 'Create, edit, reorder and delete roles.' },
  ASSIGN_ROLES: { label: 'Assign roles', description: 'Give or take roles from staff.' },
  VIEW_AUDIT_LOG: { label: 'View audit log', description: 'Every staff action.' },
  VIEW_SECURITY: {
    label: 'View security',
    description: 'Sign-in events, failed sign-ins and MFA adoption.',
  },
  MANAGE_TICKETS: {
    label: 'Manage tickets',
    description: 'Reply, assign, set status and priority, internal notes.',
  },
  VIEW_TICKETS: { label: 'View tickets', description: 'Read the support inbox.' },
  MANAGE_REPORTS: { label: 'Manage reports', description: 'Work the moderation queue.' },
  MANAGE_ANNOUNCEMENTS: {
    label: 'Manage announcements',
    description: 'Post system notices to everyone.',
  },
  MANAGE_SETTINGS: { label: 'Manage settings', description: 'Console settings.' },
};

/** The Owner role's position: above anything a role editor can produce. */
export const OWNER_POSITION = 1_000_000;

export type RoleLike = {
  _id: string;
  position: number;
  permissions: readonly string[];
  system?: 'owner';
};

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

/** Keeps known permissions only, de-duplicated and in canonical order. */
export function normalizePermissions(values: readonly string[]): AdminPermission[] {
  const wanted = new Set(values);
  return ADMIN_PERMISSIONS.filter((permission) => wanted.has(permission));
}

export function isOwner(roles: readonly RoleLike[]): boolean {
  return roles.some((role) => role.system === 'owner');
}

/** Union of the roles' permissions; ADMINISTRATOR or Owner expands to every permission. */
export function effectivePermissions(roles: readonly RoleLike[]): Set<AdminPermission> {
  const granted = new Set<AdminPermission>();
  for (const role of roles)
    for (const permission of role.permissions)
      if (isAdminPermission(permission)) granted.add(permission);
  if (isOwner(roles) || granted.has('ADMINISTRATOR')) return new Set(ADMIN_PERMISSIONS);
  return granted;
}

export function hasPermission(roles: readonly RoleLike[], permission: AdminPermission): boolean {
  return effectivePermissions(roles).has(permission);
}

/** Highest role position held (Owner counts as OWNER_POSITION); -1 with no roles. */
export function highestPosition(roles: readonly RoleLike[]): number {
  let highest = -1;
  for (const role of roles)
    highest = Math.max(highest, role.system === 'owner' ? OWNER_POSITION : role.position);
  return highest;
}

/** Whether the actor may edit or delete `target` (needs MANAGE_ROLES and a higher role). */
export function canManageRole(actorRoles: readonly RoleLike[], target: RoleLike): boolean {
  if (target.system === 'owner') return false;
  if (!hasPermission(actorRoles, 'MANAGE_ROLES')) return false;
  return target.position < highestPosition(actorRoles);
}

/** Whether the actor may give `role` to (or take it from) someone. */
export function canAssignRole(actorRoles: readonly RoleLike[], role: RoleLike): boolean {
  // Only an owner can make another owner.
  if (role.system === 'owner') return isOwner(actorRoles);
  if (!hasPermission(actorRoles, 'ASSIGN_ROLES') && !hasPermission(actorRoles, 'MANAGE_ROLES'))
    return false;
  return role.position < highestPosition(actorRoles);
}

/**
 * Whether the actor may change another staff member's roles at all: the target's highest role
 * must be below the actor's, and owners can't be acted on by anyone else.
 */
export function canActOnMember(
  actorRoles: readonly RoleLike[],
  targetRoles: readonly RoleLike[],
  self: boolean,
): boolean {
  if (self) return isOwner(actorRoles) || highestPosition(actorRoles) > -1;
  if (isOwner(targetRoles)) return false;
  return highestPosition(targetRoles) < highestPosition(actorRoles);
}

/** Permissions the actor may put on a role: only ones they hold themselves. */
export function grantablePermissions(actorRoles: readonly RoleLike[]): Set<AdminPermission> {
  return effectivePermissions(actorRoles);
}

/**
 * Validates a role permission change: every permission added must be one the actor holds.
 * Permissions already on the role may stay even if the actor lacks them.
 */
export function permissionChangeAllowed(
  actorRoles: readonly RoleLike[],
  before: readonly string[],
  after: readonly string[],
): boolean {
  const grantable = grantablePermissions(actorRoles);
  const had = new Set(before);
  return after.every((permission) => had.has(permission) || grantable.has(permission as never));
}

/**
 * Reorders the roles the actor can manage. `orderedIds` lists those roles top first; their
 * existing position slots are reused in that order, so roles the actor can't manage (and the
 * Owner role) keep their positions. Returns the new position per role id.
 */
export function reorderPositions(
  actorRoles: readonly RoleLike[],
  allRoles: readonly RoleLike[],
  orderedIds: readonly string[],
): Map<string, number> {
  const manageable = allRoles.filter((role) => canManageRole(actorRoles, role));
  const manageableIds = new Set(manageable.map((role) => role._id));
  if (
    orderedIds.length !== manageable.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    orderedIds.some((id) => !manageableIds.has(id))
  )
    throw new Error('ADMIN_ROLE_ORDER_INVALID');
  const slots = manageable.map((role) => role.position).sort((a, b) => b - a);
  // Distinct slots keep the order stable even when positions were equal.
  for (let index = 1; index < slots.length; index += 1)
    if (slots[index]! >= slots[index - 1]!) slots[index] = slots[index - 1]! - 1;
  return new Map(orderedIds.map((id, index) => [id, slots[index]!]));
}

/** The hoisted role to show as a staff badge: the highest-ranked role with `hoist` on. */
export function badgeRole<T extends RoleLike & { hoist: boolean }>(roles: readonly T[]): T | null {
  let best: T | null = null;
  for (const role of roles) {
    if (!role.hoist) continue;
    const position = role.system === 'owner' ? OWNER_POSITION : role.position;
    const bestPosition = best ? (best.system === 'owner' ? OWNER_POSITION : best.position) : -1;
    if (position > bestPosition) best = role;
  }
  return best;
}

export const ROLE_NAME_MAX = 32;
const COLOR = /^#[0-9a-f]{6}$/i;

export function validateRoleInput(input: { name: string; color: string; icon?: string }): {
  name: string;
  color: string;
  icon?: string;
} {
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (!name || name.length > ROLE_NAME_MAX) throw new Error('ADMIN_ROLE_NAME_INVALID');
  if (!COLOR.test(input.color)) throw new Error('ADMIN_ROLE_COLOR_INVALID');
  const icon = input.icon?.trim();
  if (icon !== undefined && icon.length > 32) throw new Error('ADMIN_ROLE_ICON_INVALID');
  return { name, color: input.color.toLowerCase(), ...(icon ? { icon } : {}) };
}
