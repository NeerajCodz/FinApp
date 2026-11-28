/**
 * Staff roles and members (Discord-style). See ./permissions.ts for the hierarchy rules; every
 * function here checks them server-side and writes the admin audit log.
 *
 * Bootstrap the first owner (an existing FinApp username) from a terminal:
 *
 *   bunx convex run admin/roles:bootstrapOwner '{"username":"neeraj"}'
 */
import { v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from '../_generated/server';
import { normalizeUsername } from '../users/domain';
import {
  adminError,
  getAdminContext,
  hasSecondFactor,
  logAdminAction,
  memberFor,
  requireAdminPermission,
  requireAnyAdminPermission,
  rolesOf,
  settingValue,
  userCard,
  type AdminContext,
} from './guard';
import {
  ADMIN_PERMISSIONS,
  badgeRole,
  canActOnMember,
  canAssignRole,
  canManageRole,
  highestPosition,
  isOwner,
  normalizePermissions,
  OWNER_POSITION,
  permissionChangeAllowed,
  reorderPositions,
  validateRoleInput,
} from './permissions';

function roleView(role: Doc<'adminRoles'>, admin: AdminContext | null) {
  return {
    id: role._id,
    name: role.name,
    color: role.color,
    icon: role.icon ?? null,
    position: role.system === 'owner' ? OWNER_POSITION : role.position,
    permissions: role.permissions,
    hoist: role.hoist,
    mentionable: role.mentionable,
    system: role.system ?? null,
    manageable: admin ? canManageRole(admin.roles, role) : false,
    assignable: admin ? canAssignRole(admin.roles, role) : false,
  };
}

async function allRoles(ctx: { db: QueryCtx['db'] }) {
  const roles = await ctx.db.query('adminRoles').collect();
  return roles.sort(
    (a, b) =>
      (b.system === 'owner' ? OWNER_POSITION : b.position) -
      (a.system === 'owner' ? OWNER_POSITION : a.position),
  );
}

async function userByUsername(ctx: MutationCtx, username: string) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9_]{3,32}$/.test(normalized)) throw adminError('ADMIN_USER_NOT_FOUND');
  const user = await ctx.db
    .query('users')
    .withIndex('by_username', (q) => q.eq('username', normalized))
    .unique();
  if (!user || user.deletedAt !== undefined) throw adminError('ADMIN_USER_NOT_FOUND');
  return user;
}

// ---------- Queries ----------

/** The signed-in user's staff status for the console shell (never throws). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const admin = await getAdminContext(ctx);
    if (!admin) return { staff: false as const };
    const mfa = await hasSecondFactor(ctx, admin.user);
    const requireMfa = await settingValue(ctx, 'requireStaffMfa', false);
    return {
      staff: true as const,
      user: await userCard(ctx, admin.user._id),
      owner: admin.owner,
      permissions: [...admin.permissions],
      roles: admin.roles.map((role) => roleView(role, admin)),
      highest: admin.highest,
      mfaEnabled: mfa,
      mfaRequired: requireMfa,
      blockedByMfa: requireMfa && !admin.owner && !mfa,
    };
  },
});

export const listRoles = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAnyAdminPermission(ctx, ['MANAGE_ROLES', 'ASSIGN_ROLES']);
    const roles = await allRoles(ctx);
    const members = await ctx.db.query('adminMembers').collect();
    return roles.map((role) => ({
      ...roleView(role, admin),
      memberCount: members.filter((member) => member.roleIds.includes(role._id)).length,
    }));
  },
});

/** Staff list (visible to any staff member). */
export const listStaff = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdminPermission(ctx, null);
    const roles = await allRoles(ctx);
    const byId = new Map(roles.map((role) => [String(role._id), role]));
    const members = await ctx.db.query('adminMembers').collect();
    const rows = await Promise.all(
      members.map(async (member) => {
        const memberRoles = member.roleIds
          .map((id) => byId.get(String(id)))
          .filter((role): role is Doc<'adminRoles'> => Boolean(role));
        const activity = await ctx.db
          .query('userActivity')
          .withIndex('by_user', (q) => q.eq('userId', member.userId))
          .unique();
        return {
          id: member._id,
          user: await userCard(ctx, member.userId),
          roles: memberRoles.map((role) => roleView(role, admin)),
          highest: highestPosition(memberRoles),
          owner: isOwner(memberRoles),
          addedAt: member.addedAt,
          lastActiveAt: activity?.lastActiveAt ?? null,
          editable: canActOnMember(admin.roles, memberRoles, member.userId === admin.user._id),
        };
      }),
    );
    return rows.sort((a, b) => b.highest - a.highest);
  },
});

/** The hoisted staff badge for a FinApp profile (public: name, color and icon only). */
export const staffBadge = query({
  args: { userId: v.optional(v.id('users')), username: v.optional(v.string()) },
  handler: async (ctx, { userId, username }) => {
    let id = userId ?? null;
    if (!id && username) {
      const normalized = normalizeUsername(username);
      if (!/^[a-z0-9_]{3,32}$/.test(normalized)) return null;
      const user = await ctx.db
        .query('users')
        .withIndex('by_username', (q) => q.eq('username', normalized))
        .unique();
      id = user?._id ?? null;
    }
    if (!id) return null;
    const member = await memberFor(ctx, id);
    const role = badgeRole(await rolesOf(ctx, member));
    return role ? { name: role.name, color: role.color, icon: role.icon ?? null } : null;
  },
});

export const permissionCatalog = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminPermission(ctx, null);
    return [...ADMIN_PERMISSIONS];
  },
});

// ---------- Role editing ----------

const roleFields = {
  name: v.string(),
  color: v.string(),
  icon: v.optional(v.string()),
  permissions: v.array(v.string()),
  hoist: v.boolean(),
  mentionable: v.boolean(),
};

export const createRole = mutation({
  args: roleFields,
  handler: async (ctx, args) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ROLES');
    const clean = validateRoleInput(args);
    const permissions = normalizePermissions(args.permissions);
    if (!permissionChangeAllowed(admin.roles, [], permissions))
      throw adminError('ADMIN_PERMISSION_NOT_GRANTABLE');
    // New roles go just below the creator's highest role.
    const roles = await allRoles(ctx);
    const below = roles
      .filter((role) => role.system !== 'owner' && role.position < admin.highest)
      .map((role) => role.position);
    const top = below.length ? Math.max(...below) : 0;
    const position = top + 1 < admin.highest ? top + 1 : (top + admin.highest) / 2;
    const now = Date.now();
    const id = await ctx.db.insert('adminRoles', {
      ...clean,
      position,
      permissions,
      hoist: args.hoist,
      mentionable: args.mentionable,
      createdAt: now,
      updatedAt: now,
    });
    await logAdminAction(ctx, admin.user._id, 'role.create', 'role', String(id), clean.name);
    return id;
  },
});

export const updateRole = mutation({
  args: { roleId: v.id('adminRoles'), ...roleFields },
  handler: async (ctx, { roleId, ...args }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ROLES');
    const role = await ctx.db.get(roleId);
    if (!role) throw adminError('ADMIN_ROLE_NOT_FOUND');
    if (!canManageRole(admin.roles, role)) throw adminError('ADMIN_ROLE_HIERARCHY');
    const clean = validateRoleInput(args);
    const permissions = normalizePermissions(args.permissions);
    if (!permissionChangeAllowed(admin.roles, role.permissions, permissions))
      throw adminError('ADMIN_PERMISSION_NOT_GRANTABLE');
    await ctx.db.patch(roleId, {
      name: clean.name,
      color: clean.color,
      icon: clean.icon,
      permissions,
      hoist: args.hoist,
      mentionable: args.mentionable,
      updatedAt: Date.now(),
    });
    const added = permissions.filter((permission) => !role.permissions.includes(permission));
    const removed = role.permissions.filter(
      (permission) => !permissions.includes(permission as never),
    );
    await logAdminAction(
      ctx,
      admin.user._id,
      'role.update',
      'role',
      String(roleId),
      [
        clean.name,
        added.length ? `+${added.join(',')}` : '',
        removed.length ? `-${removed.join(',')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    return null;
  },
});

export const deleteRole = mutation({
  args: { roleId: v.id('adminRoles') },
  handler: async (ctx, { roleId }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ROLES');
    const role = await ctx.db.get(roleId);
    if (!role) throw adminError('ADMIN_ROLE_NOT_FOUND');
    if (!canManageRole(admin.roles, role)) throw adminError('ADMIN_ROLE_HIERARCHY');
    for (const member of await ctx.db.query('adminMembers').collect()) {
      if (!member.roleIds.includes(roleId)) continue;
      const roleIds = member.roleIds.filter((id) => id !== roleId);
      if (roleIds.length) await ctx.db.patch(member._id, { roleIds });
      else await ctx.db.delete(member._id);
    }
    await ctx.db.delete(roleId);
    await logAdminAction(ctx, admin.user._id, 'role.delete', 'role', String(roleId), role.name);
    return null;
  },
});

/** Drag-to-reorder: `orderedIds` lists every role the caller can manage, top first. */
export const reorderRoles = mutation({
  args: { orderedIds: v.array(v.id('adminRoles')) },
  handler: async (ctx, { orderedIds }) => {
    const admin = await requireAdminPermission(ctx, 'MANAGE_ROLES');
    const roles = await allRoles(ctx);
    let positions: Map<string, number>;
    try {
      positions = reorderPositions(
        admin.roles,
        roles,
        orderedIds.map((id) => String(id)),
      );
    } catch {
      throw adminError('ADMIN_ROLE_ORDER_INVALID');
    }
    const now = Date.now();
    for (const role of roles) {
      const position = positions.get(String(role._id));
      if (position !== undefined && position !== role.position)
        await ctx.db.patch(role._id, { position, updatedAt: now });
    }
    await logAdminAction(
      ctx,
      admin.user._id,
      'role.reorder',
      'role',
      undefined,
      `${orderedIds.length} roles`,
    );
    return null;
  },
});

// ---------- Members ----------

async function memberRoles(ctx: MutationCtx, userId: Id<'users'>) {
  const member = await memberFor(ctx, userId);
  return { member, roles: await rolesOf(ctx, member) };
}

/** Gives a role to a FinApp user by username (making them staff if they weren't). */
export const assignRole = mutation({
  args: { username: v.string(), roleId: v.id('adminRoles') },
  handler: async (ctx, { username, roleId }) => {
    const admin = await requireAnyAdminPermission(ctx, ['ASSIGN_ROLES', 'MANAGE_ROLES']);
    const role = await ctx.db.get(roleId);
    if (!role) throw adminError('ADMIN_ROLE_NOT_FOUND');
    if (!canAssignRole(admin.roles, role)) throw adminError('ADMIN_ROLE_HIERARCHY');
    const user = await userByUsername(ctx, username);
    const target = await memberRoles(ctx, user._id);
    if (target.member && !canActOnMember(admin.roles, target.roles, user._id === admin.user._id))
      throw adminError('ADMIN_ROLE_HIERARCHY');
    if (target.member) {
      if (target.member.roleIds.includes(roleId)) return target.member._id;
      await ctx.db.patch(target.member._id, { roleIds: [...target.member.roleIds, roleId] });
    } else {
      await ctx.db.insert('adminMembers', {
        userId: user._id,
        roleIds: [roleId],
        addedBy: admin.user._id,
        addedAt: Date.now(),
      });
    }
    await logAdminAction(
      ctx,
      admin.user._id,
      'role.assign',
      'user',
      String(user._id),
      `${role.name} → @${user.username}`,
    );
    return (await memberFor(ctx, user._id))!._id;
  },
});

/** Takes a role from a staff member (removing them from staff with their last role). */
export const unassignRole = mutation({
  args: { userId: v.id('users'), roleId: v.id('adminRoles') },
  handler: async (ctx, { userId, roleId }) => {
    const admin = await requireAnyAdminPermission(ctx, ['ASSIGN_ROLES', 'MANAGE_ROLES']);
    const role = await ctx.db.get(roleId);
    if (!role) throw adminError('ADMIN_ROLE_NOT_FOUND');
    const self = userId === admin.user._id;
    const target = await memberRoles(ctx, userId);
    if (!target.member || !target.member.roleIds.includes(roleId)) return null;
    if (role.system === 'owner') {
      // Owners can't be removed by others; an owner may step down if another owner remains.
      if (!self) throw adminError('ADMIN_OWNER_PROTECTED');
      const owners = (await ctx.db.query('adminMembers').collect()).filter((member) =>
        member.roleIds.includes(roleId),
      );
      if (owners.length <= 1) throw adminError('ADMIN_LAST_OWNER');
    } else {
      if (!canAssignRole(admin.roles, role)) throw adminError('ADMIN_ROLE_HIERARCHY');
      if (!canActOnMember(admin.roles, target.roles, self))
        throw adminError('ADMIN_ROLE_HIERARCHY');
    }
    const roleIds = target.member.roleIds.filter((id) => id !== roleId);
    if (roleIds.length) await ctx.db.patch(target.member._id, { roleIds });
    else await ctx.db.delete(target.member._id);
    await logAdminAction(ctx, admin.user._id, 'role.unassign', 'user', String(userId), role.name);
    return null;
  },
});

/** Removes someone from staff entirely (all roles). */
export const removeStaff = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const admin = await requireAnyAdminPermission(ctx, ['ASSIGN_ROLES', 'MANAGE_ROLES']);
    const target = await memberRoles(ctx, userId);
    if (!target.member) return null;
    if (isOwner(target.roles)) throw adminError('ADMIN_OWNER_PROTECTED');
    if (!canActOnMember(admin.roles, target.roles, false) || userId === admin.user._id)
      throw adminError('ADMIN_ROLE_HIERARCHY');
    if (!target.roles.every((role) => canAssignRole(admin.roles, role)))
      throw adminError('ADMIN_ROLE_HIERARCHY');
    await ctx.db.delete(target.member._id);
    await logAdminAction(ctx, admin.user._id, 'staff.remove', 'user', String(userId));
    return null;
  },
});

// ---------- Bootstrap ----------

const DEFAULT_ROLES: Array<{
  name: string;
  color: string;
  icon: string;
  position: number;
  permissions: string[];
}> = [
  { name: 'Admin', color: '#e5484d', icon: '🛡️', position: 30, permissions: ['ADMINISTRATOR'] },
  {
    name: 'Moderator',
    color: '#3e63dd',
    icon: '🔨',
    position: 20,
    permissions: [
      'VIEW_USERS',
      'BAN_USERS',
      'VIEW_GROUPS',
      'MANAGE_GROUPS',
      'MANAGE_REPORTS',
      'VIEW_TICKETS',
      'VIEW_SECURITY',
      'VIEW_AUDIT_LOG',
    ],
  },
  {
    name: 'Support',
    color: '#30a46c',
    icon: '💬',
    position: 10,
    permissions: ['VIEW_USERS', 'VIEW_TICKETS', 'MANAGE_TICKETS'],
  },
];

/**
 * Makes an existing FinApp user an Owner. Creates the Owner role (and the default Admin,
 * Moderator and Support roles) the first time. Internal: run it with `bunx convex run`.
 */
export const bootstrapOwner = internalMutation({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const user = await userByUsername(ctx, username);
    const now = Date.now();
    const roles = await ctx.db.query('adminRoles').collect();
    let owner = roles.find((role) => role.system === 'owner');
    if (!owner) {
      const ownerId = await ctx.db.insert('adminRoles', {
        name: 'Owner',
        color: '#f5d90a',
        icon: '👑',
        position: OWNER_POSITION,
        permissions: ['ADMINISTRATOR'],
        hoist: true,
        mentionable: false,
        system: 'owner',
        createdAt: now,
        updatedAt: now,
      });
      owner = (await ctx.db.get(ownerId))!;
      if (!roles.length)
        for (const role of DEFAULT_ROLES)
          await ctx.db.insert('adminRoles', {
            ...role,
            hoist: true,
            mentionable: true,
            createdAt: now,
            updatedAt: now,
          });
    }
    const member = await memberFor(ctx, user._id);
    if (member) {
      if (!member.roleIds.includes(owner._id))
        await ctx.db.patch(member._id, { roleIds: [...member.roleIds, owner._id] });
    } else {
      await ctx.db.insert('adminMembers', { userId: user._id, roleIds: [owner._id], addedAt: now });
    }
    await logAdminAction(
      ctx,
      user._id,
      'owner.bootstrap',
      'user',
      String(user._id),
      `@${user.username}`,
    );
    return { userId: user._id, roleId: owner._id };
  },
});
