import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

const previousKey = process.env.ADMIN_DATA_KEY;
beforeAll(() => {
  process.env.ADMIN_DATA_KEY = Buffer.alloc(32, 3).toString('base64');
});
afterAll(() => {
  if (previousKey === undefined) delete process.env.ADMIN_DATA_KEY;
  else process.env.ADMIN_DATA_KEY = previousKey;
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const user = (username: string) =>
      ctx.db.insert('users', {
        email: `${username}@example.com`,
        username,
        displayName: username,
        emailVerificationTime: now,
      });
    const ownerId = await user('owner');
    const modId = await user('moddy');
    const supportId = await user('helper');
    const memberId = await user('member');
    const session = (userId: typeof ownerId) =>
      ctx.db.insert('authSessions', { userId, expirationTime: now + 86_400_000 });
    return {
      ownerId,
      modId,
      supportId,
      memberId,
      sessions: {
        owner: await session(ownerId),
        mod: await session(modId),
        support: await session(supportId),
        member: await session(memberId),
      },
    };
  });
  const as = (userId: string, sessionId: string) =>
    t.withIdentity({ subject: `${userId}|${sessionId}` });
  return {
    t,
    ids,
    owner: as(ids.ownerId, ids.sessions.owner),
    mod: as(ids.modId, ids.sessions.mod),
    support: as(ids.supportId, ids.sessions.support),
    member: as(ids.memberId, ids.sessions.member),
  };
}

async function bootstrapped() {
  const f = await fixture();
  await f.t.mutation(internal.admin.roles.bootstrapOwner, { username: 'owner' });
  const roles = await f.owner.query(api.admin.roles.listRoles, {});
  const byName = Object.fromEntries(roles.map((role) => [role.name, role]));
  await f.owner.mutation(api.admin.roles.assignRole, {
    username: 'moddy',
    roleId: byName.Moderator!.id,
  });
  await f.owner.mutation(api.admin.roles.assignRole, {
    username: 'helper',
    roleId: byName.Support!.id,
  });
  return { ...f, roles: byName };
}

describe('staff RBAC', () => {
  it('bootstraps an owner with default roles and reports staff status', async () => {
    const { owner, member, roles } = await bootstrapped();
    expect(Object.keys(roles)).toEqual(['Owner', 'Admin', 'Moderator', 'Support']);
    const me = await owner.query(api.admin.roles.me, {});
    expect(me.staff && me.owner).toBe(true);
    expect(await member.query(api.admin.roles.me, {})).toEqual({ staff: false });
  });

  it('denies non-staff and staff without the permission, server-side', async () => {
    const { member, support } = await bootstrapped();
    await expect(member.query(api.admin.analytics.overview, {})).rejects.toThrow(/ADMIN_FORBIDDEN/);
    await expect(support.query(api.admin.analytics.overview, {})).rejects.toThrow(
      /ADMIN_FORBIDDEN/,
    );
    await expect(
      support.query(api.admin.users.list, { paginationOpts: { numItems: 10, cursor: null } }),
    ).resolves.toMatchObject({ page: expect.any(Array) });
  });

  it('enforces the role hierarchy for assignment and editing', async () => {
    const { mod, owner, roles, ids, t } = await bootstrapped();
    // A moderator without ASSIGN_ROLES/MANAGE_ROLES can't assign at all.
    await expect(
      mod.mutation(api.admin.roles.assignRole, { username: 'member', roleId: roles.Support!.id }),
    ).rejects.toThrow(/ADMIN_FORBIDDEN/);
    // Give moderators MANAGE_ROLES: they can manage Support but not Admin or their own role.
    await owner.mutation(api.admin.roles.updateRole, {
      roleId: roles.Moderator!.id,
      name: 'Moderator',
      color: '#3e63dd',
      permissions: [...roles.Moderator!.permissions, 'MANAGE_ROLES'],
      hoist: true,
      mentionable: true,
    });
    await mod.mutation(api.admin.roles.assignRole, {
      username: 'member',
      roleId: roles.Support!.id,
    });
    await expect(
      mod.mutation(api.admin.roles.assignRole, { username: 'member', roleId: roles.Admin!.id }),
    ).rejects.toThrow(/ADMIN_ROLE_HIERARCHY/);
    await expect(
      mod.mutation(api.admin.roles.updateRole, {
        roleId: roles.Moderator!.id,
        name: 'Mods',
        color: '#000000',
        permissions: [],
        hoist: true,
        mentionable: true,
      }),
    ).rejects.toThrow(/ADMIN_ROLE_HIERARCHY/);
    // Can't grant a permission they don't hold.
    await expect(
      mod.mutation(api.admin.roles.updateRole, {
        roleId: roles.Support!.id,
        name: 'Support',
        color: '#30a46c',
        permissions: ['MANAGE_SETTINGS'],
        hoist: true,
        mentionable: true,
      }),
    ).rejects.toThrow(/ADMIN_PERMISSION_NOT_GRANTABLE/);
    // Owners can't be removed by others.
    await expect(
      mod.mutation(api.admin.roles.removeStaff, { userId: ids.ownerId }),
    ).rejects.toThrow(/ADMIN_OWNER_PROTECTED/);
    await expect(
      owner.mutation(api.admin.roles.unassignRole, {
        userId: ids.ownerId,
        roleId: roles.Owner!.id,
      }),
    ).rejects.toThrow(/ADMIN_LAST_OWNER/);
    // Every action is audited.
    const log = await t.run((ctx) => ctx.db.query('adminAuditLog').collect());
    expect(log.map((entry) => entry.action)).toContain('role.assign');
  });

  it('shows the hoisted staff badge publicly', async () => {
    const { member, ids } = await bootstrapped();
    expect(await member.query(api.admin.roles.staffBadge, { username: 'moddy' })).toMatchObject({
      name: 'Moderator',
    });
    expect(await member.query(api.admin.roles.staffBadge, { userId: ids.memberId })).toBeNull();
  });
});

describe('bans and suspensions', () => {
  it('blocks a banned user everywhere, ends sessions and lifts cleanly', async () => {
    const { mod, member, ids, t } = await bootstrapped();
    expect(await member.query(api.users.queries.current, {})).not.toBeNull();
    await mod.mutation(api.admin.users.restrict, {
      userId: ids.memberId,
      kind: 'ban',
      reason: 'Spam',
    });
    expect(await member.query(api.users.queries.current, {})).toBeNull();
    await expect(member.mutation(api.presence.mutations.heartbeat, {})).rejects.toThrow(
      /ACCOUNT_SUSPENDED/,
    );
    expect(await member.query(api.admin.account.status, {})).toMatchObject({
      state: 'banned',
      reason: 'Spam',
    });
    const sessions = await t.run((ctx) =>
      ctx.db
        .query('authSessions')
        .withIndex('userId', (q) => q.eq('userId', ids.memberId))
        .collect(),
    );
    expect(sessions).toHaveLength(0);
    // The reason is encrypted at rest.
    const stored = await t.run((ctx) => ctx.db.query('accountRestrictions').first());
    expect(stored!.reason).not.toContain('Spam');
    expect(await t.query(internal.admin.account.signInAllowed, { userId: ids.memberId })).toBe(
      false,
    );
    await mod.mutation(api.admin.users.liftRestriction, { userId: ids.memberId });
    expect(await t.query(internal.admin.account.signInAllowed, { userId: ids.memberId })).toBe(
      true,
    );
  });

  it('expires suspensions and refuses to act on higher staff or yourself', async () => {
    const { mod, ids, t } = await bootstrapped();
    await expect(
      mod.mutation(api.admin.users.restrict, {
        userId: ids.ownerId,
        kind: 'ban',
        reason: 'no',
      }),
    ).rejects.toThrow(/ADMIN_ROLE_HIERARCHY/);
    await expect(
      mod.mutation(api.admin.users.restrict, { userId: ids.modId, kind: 'ban', reason: 'no' }),
    ).rejects.toThrow(/ADMIN_CANNOT_TARGET_SELF/);
    await expect(
      mod.mutation(api.admin.users.restrict, {
        userId: ids.memberId,
        kind: 'suspension',
        reason: 'cool off',
      }),
    ).rejects.toThrow(/ADMIN_DURATION_INVALID/);
    await t.run(async (ctx) => {
      await ctx.db.insert('accountRestrictions', {
        userId: ids.memberId,
        kind: 'suspension',
        reason: 'expired',
        expiresAt: Date.now() - 1,
        createdBy: ids.modId,
        createdAt: Date.now() - 10_000,
      });
    });
    expect(await t.query(internal.admin.account.signInAllowed, { userId: ids.memberId })).toBe(
      true,
    );
  });
});

describe('usage tracking and analytics', () => {
  it('counts whitelisted events only and exposes counts, not content', async () => {
    const { member, owner, ids, t } = await bootstrapped();
    await member.mutation(api.presence.mutations.heartbeat, {});
    await t.run(async (ctx) => {
      const { trackUsage } = await import('../../convex/admin/usage');
      await trackUsage(ctx, ids.memberId, 'transaction.create');
      await trackUsage(ctx, ids.memberId, 'transaction.create');
      await trackUsage(ctx, ids.memberId, 'transaction.amount=500');
    });
    const counters = await t.run((ctx) => ctx.db.query('usageDaily').collect());
    expect(counters.map((row) => row.metric).sort()).toEqual(['app.active', 'transaction.create']);
    const detail = await owner.query(api.admin.users.detail, { userId: ids.memberId });
    expect(detail!.usage.features).toEqual([
      { metric: 'transaction.create', label: 'Transactions added', count: 2 },
    ]);
    expect(detail).not.toHaveProperty('email');
    const overview = await owner.query(api.admin.analytics.overview, {});
    expect(overview.dau).toBeGreaterThanOrEqual(1);
  });
});

describe('support tickets and reports', () => {
  it('runs a ticket thread with encrypted text, internal notes and reply notifications', async () => {
    const { member, support, ids, t } = await bootstrapped();
    const ticketId = await member.mutation(api.support.tickets.create, {
      category: 'sync',
      subject: 'Phone not syncing',
      message: 'Since yesterday my phone shows old data.',
    });
    const raw = await t.run((ctx) => ctx.db.get(ticketId));
    expect(raw!.subject).not.toContain('syncing');
    await support.mutation(api.support.tickets.staffReply, {
      ticketId,
      message: 'Checked logs, looks like a stale token.',
      internal: true,
    });
    await support.mutation(api.support.tickets.staffReply, {
      ticketId,
      message: 'Could you sign out and in again?',
      internal: false,
    });
    const mine = await member.query(api.support.tickets.mineDetail, { ticketId });
    expect(mine!.status).toBe('pending');
    expect(mine!.unread).toBe(true);
    expect(mine!.messages.map((message) => message.body)).toEqual([
      'Since yesterday my phone shows old data.',
      'Could you sign out and in again?',
    ]);
    const staff = await support.query(api.support.tickets.staffDetail, { ticketId });
    expect(staff!.messages).toHaveLength(3);
    expect(staff!.assignee?.id).toBe(ids.supportId);
    const notifications = await t.run((ctx) =>
      ctx.db
        .query('notifications')
        .withIndex('by_recipient_createdAt', (q) => q.eq('recipientId', ids.memberId))
        .collect(),
    );
    expect(notifications.some((row) => row.entityType === 'supportTicket')).toBe(true);
    // Another user can't read it.
    const other = await t.run(async (ctx) => {
      const id = await ctx.db.insert('users', { username: 'other', displayName: 'other' });
      const session = await ctx.db.insert('authSessions', {
        userId: id,
        expirationTime: Date.now() + 60_000,
      });
      return { id, session };
    });
    expect(
      await t
        .withIdentity({ subject: `${other.id}|${other.session}` })
        .query(api.support.tickets.mineDetail, { ticketId }),
    ).toBeNull();
  });

  it('files reports with encrypted descriptions and resolves them with an action', async () => {
    const { member, mod, ids, t } = await bootstrapped();
    const reportId = await member.mutation(api.support.reports.create, {
      targetType: 'user',
      targetUsername: 'helper',
      reason: 'spam',
      description: 'Keeps sending me links',
    });
    const raw = await t.run((ctx) => ctx.db.get(reportId));
    expect(raw!.description).not.toContain('links');
    await expect(
      member.mutation(api.support.reports.create, {
        targetType: 'user',
        targetUsername: 'member',
        reason: 'spam',
        description: 'me',
      }),
    ).rejects.toThrow(/REPORT_SELF/);
    const queue = await mod.query(api.support.reports.queue, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(queue.page[0]).toMatchObject({
      description: 'Keeps sending me links',
      targetUser: { id: ids.supportId },
    });
    await mod.mutation(api.support.reports.resolve, { reportId, action: 'dismiss' });
    expect((await t.run((ctx) => ctx.db.get(reportId)))!.status).toBe('dismissed');
  });
});
