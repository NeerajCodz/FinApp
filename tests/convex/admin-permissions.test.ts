import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  badgeRole,
  canActOnMember,
  canAssignRole,
  canManageRole,
  effectivePermissions,
  hasPermission,
  highestPosition,
  normalizePermissions,
  OWNER_POSITION,
  permissionChangeAllowed,
  reorderPositions,
  validateRoleInput,
  type RoleLike,
} from '../../convex/admin/permissions';

const role = (
  id: string,
  position: number,
  permissions: string[],
  extra: Partial<RoleLike & { hoist: boolean }> = {},
) => ({ _id: id, position, permissions, hoist: false, ...extra });

const owner = role('owner', OWNER_POSITION, ['ADMINISTRATOR'], { system: 'owner', hoist: true });
const admin = role('admin', 30, ['ADMINISTRATOR'], { hoist: true });
const moderator = role('mod', 20, ['MANAGE_ROLES', 'ASSIGN_ROLES', 'BAN_USERS'], { hoist: true });
const support = role('support', 10, ['VIEW_TICKETS', 'MANAGE_TICKETS']);
const helper = role('helper', 5, ['VIEW_TICKETS']);
const all = [owner, admin, moderator, support, helper];

describe('effective permissions', () => {
  it('unions role permissions and ignores unknown ones', () => {
    expect([
      ...effectivePermissions([support, helper, role('x', 1, ['NOT_A_PERMISSION'])]),
    ]).toEqual(['VIEW_TICKETS', 'MANAGE_TICKETS']);
  });

  it('expands ADMINISTRATOR and Owner to every permission', () => {
    expect(effectivePermissions([admin]).size).toBe(ADMIN_PERMISSIONS.length);
    expect(effectivePermissions([role('o', OWNER_POSITION, [], { system: 'owner' })]).size).toBe(
      ADMIN_PERMISSIONS.length,
    );
    expect(hasPermission([support], 'BAN_USERS')).toBe(false);
    expect(hasPermission([admin], 'BAN_USERS')).toBe(true);
  });

  it('normalizes permission lists to the canonical order without duplicates', () => {
    expect(normalizePermissions(['VIEW_USERS', 'ADMINISTRATOR', 'VIEW_USERS', 'nope'])).toEqual([
      'ADMINISTRATOR',
      'VIEW_USERS',
    ]);
  });
});

describe('role hierarchy', () => {
  it('ranks the owner above everything', () => {
    expect(highestPosition([owner])).toBe(OWNER_POSITION);
    expect(highestPosition([support, moderator])).toBe(20);
    expect(highestPosition([])).toBe(-1);
  });

  it('only manages roles strictly below your highest role, and never the Owner role', () => {
    expect(canManageRole([moderator], support)).toBe(true);
    expect(canManageRole([moderator], moderator)).toBe(false);
    expect(canManageRole([moderator], admin)).toBe(false);
    expect(canManageRole([admin], moderator)).toBe(true);
    expect(canManageRole([owner], admin)).toBe(true);
    expect(canManageRole([owner], owner)).toBe(false);
    // Needs MANAGE_ROLES even when ranked higher.
    expect(canManageRole([support], helper)).toBe(false);
  });

  it('assigns only lower roles, and only an owner can make an owner', () => {
    expect(canAssignRole([moderator], support)).toBe(true);
    expect(canAssignRole([moderator], moderator)).toBe(false);
    expect(canAssignRole([admin], owner)).toBe(false);
    expect(canAssignRole([owner], owner)).toBe(true);
    expect(canAssignRole([support], helper)).toBe(false);
  });

  it('acts on members ranked below only; owners are protected from others', () => {
    expect(canActOnMember([admin], [moderator], false)).toBe(true);
    expect(canActOnMember([moderator], [moderator], false)).toBe(false);
    expect(canActOnMember([moderator], [admin], false)).toBe(false);
    expect(canActOnMember([admin], [owner], false)).toBe(false);
    expect(
      canActOnMember([owner], [role('o2', OWNER_POSITION, [], { system: 'owner' })], false),
    ).toBe(false);
    expect(canActOnMember([owner], [admin], false)).toBe(true);
  });

  it('grants only permissions the actor holds, keeping ones already on the role', () => {
    expect(permissionChangeAllowed([moderator], [], ['BAN_USERS'])).toBe(true);
    expect(permissionChangeAllowed([moderator], [], ['MANAGE_SETTINGS'])).toBe(false);
    expect(permissionChangeAllowed([moderator], ['MANAGE_SETTINGS'], ['MANAGE_SETTINGS'])).toBe(
      true,
    );
    expect(permissionChangeAllowed([admin], [], ['MANAGE_SETTINGS', 'ADMINISTRATOR'])).toBe(true);
  });
});

describe('reordering', () => {
  it('reuses the manageable roles’ slots in the new order', () => {
    const positions = reorderPositions([moderator], all, ['helper', 'support']);
    expect(positions.get('helper')).toBe(10);
    expect(positions.get('support')).toBe(5);
    expect(positions.has('admin')).toBe(false);
  });

  it('rejects orders that include roles you cannot manage or miss some', () => {
    expect(() => reorderPositions([moderator], all, ['support', 'helper', 'admin'])).toThrow(
      'ADMIN_ROLE_ORDER_INVALID',
    );
    expect(() => reorderPositions([moderator], all, ['support'])).toThrow();
    expect(() => reorderPositions([moderator], all, ['support', 'support'])).toThrow();
  });

  it('keeps distinct positions when roles shared one', () => {
    const tied = [role('a', 3, []), role('b', 3, []), role('c', 3, [])];
    const positions = reorderPositions([owner], [owner, ...tied], ['c', 'a', 'b']);
    expect(new Set(positions.values()).size).toBe(3);
    expect(positions.get('c')! > positions.get('a')!).toBe(true);
    expect(positions.get('a')! > positions.get('b')!).toBe(true);
  });
});

describe('badges and validation', () => {
  it('shows the highest hoisted role', () => {
    expect(badgeRole([support, moderator])?._id).toBe('mod');
    expect(badgeRole([support, helper])).toBeNull();
    expect(badgeRole([moderator, owner])?._id).toBe('owner');
  });

  it('validates names, colors and icons', () => {
    expect(validateRoleInput({ name: '  Support   team ', color: '#AABBCC', icon: '💬' })).toEqual({
      name: 'Support team',
      color: '#aabbcc',
      icon: '💬',
    });
    expect(() => validateRoleInput({ name: '', color: '#aabbcc' })).toThrow();
    expect(() => validateRoleInput({ name: 'x'.repeat(33), color: '#aabbcc' })).toThrow();
    expect(() => validateRoleInput({ name: 'Ok', color: 'red' })).toThrow();
  });
});
