import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import { defaultNotificationPreferences } from '../../convex/notifications/domain';
import { finaiToolAllowed, resolveFinaiSettings } from '../../convex/shared/finaiSettings';
import { blockedReason } from '@finapp/mcp/server';

const modules = import.meta.glob('../../convex/**/*.ts');

async function setup() {
  const t = convexTest(schema, modules);
  const subject = 'manage-owner';
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', {
      identityId: subject,
      email: `${subject}@example.com`,
      emailVerificationTime: 1,
      displayName: 'Owner',
    }),
  );
  await t.run((ctx) =>
    ctx.db.insert('userSettings', {
      userId,
      currency: 'INR',
      timezone: 'UTC',
      firstDayOfWeek: 1,
      financialMonthStart: 1,
      language: 'en',
      appearance: 'system',
      notificationPreferences: defaultNotificationPreferences,
      appLockPreferences: { enabled: false, fallback: 'device-pin' },
      updatedAt: 1,
    }),
  );
  const me = t.withIdentity({ subject, email: `${subject}@example.com`, name: 'Owner' });
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const accountId = await ctx.db.insert('accounts', {
      ownerId: userId,
      name: 'Wallet',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
      createdAt: now,
      updatedAt: now,
    });
    const categoryId = await ctx.db.insert('categories', {
      ownerId: userId,
      name: 'Food',
      kind: 'expense',
      isSystem: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    });
    const transactionId = await ctx.db.insert('transactions', {
      ownerId: userId,
      accountId,
      type: 'expense',
      amountMinor: 50_000n,
      currency: 'INR',
      categoryId: String(categoryId),
      title: 'Dinner',
      occurredAt: now,
      status: 'posted',
      createdAt: now,
      updatedAt: now,
    });
    return { accountId, categoryId, transactionId };
  });
  /** Stores a pending FinAI card the way `propose` does, then confirms it as the user. */
  const confirm = async (kind: string, payload: Record<string, unknown>) => {
    const actionId = await t.run((ctx) =>
      ctx.db.insert('finaiActions', {
        userId,
        scopeType: 'assistant',
        scopeId: 'conversation',
        messageId: 'message',
        kind: kind as 'goal.create',
        payload: JSON.stringify(payload, (_key, value: unknown) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
        title: kind,
        status: 'pending',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );
    return me.action(api.ai.actions.confirm, { actionId });
  };
  return { t, me, userId, ids, confirm };
}

describe('FinAI management actions', () => {
  it('creates and edits a goal, keeping fields that were not mentioned', async () => {
    const { t, confirm } = await setup();
    const created = await confirm('goal.create', {
      name: 'Laptop',
      targetAmountMinor: 8_000_000n,
      currency: 'INR',
      notes: 'Work machine',
    });
    expect(created.status).toBe('done');
    const goalId = created.resultId!;
    const edited = await confirm('goal.update', { goalId, targetAmountMinor: 9_000_000n });
    expect(edited.status).toBe('done');
    const goal = await t.run((ctx) => ctx.db.get(goalId as never));
    expect(goal).toMatchObject({
      name: 'Laptop',
      targetAmountMinor: 9_000_000n,
      notes: 'Work machine',
    });
  });

  it('edits only the given transaction fields', async () => {
    const { t, ids, confirm } = await setup();
    const result = await confirm('transaction.update', {
      transactionId: String(ids.transactionId),
      title: 'Team dinner',
    });
    expect(result.status).toBe('done');
    const row = await t.run((ctx) => ctx.db.get(ids.transactionId));
    expect(row).toMatchObject({ title: 'Team dinner', amountMinor: 50_000n });
  });

  it('moves a category to Trash with its transactions, then deletes it for good', async () => {
    const { t, me, ids, confirm } = await setup();
    expect(
      (
        await confirm('entity.delete', {
          kind: 'category',
          id: String(ids.categoryId),
          deleteTransactions: true,
        })
      ).status,
    ).toBe('done');
    const trash = await me.query(api.trash.list, {});
    expect(trash.items.map((item) => item.kind).sort()).toEqual(['category', 'transaction']);
    expect(
      (await confirm('trash.purge', { kind: 'category', id: String(ids.categoryId) })).status,
    ).toBe('done');
    expect(await t.run((ctx) => ctx.db.get(ids.categoryId))).toBeNull();
  });

  it('refuses to act on records the user does not own', async () => {
    const { t, confirm } = await setup();
    const strangerAccount = await t.run(async (ctx) => {
      const stranger = await ctx.db.insert('users', { email: 's@example.com', displayName: 'S' });
      return ctx.db.insert('accounts', {
        ownerId: stranger,
        name: 'Theirs',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
        createdAt: 1,
        updatedAt: 1,
      });
    });
    const result = await confirm('entity.delete', { kind: 'account', id: String(strangerAccount) });
    expect(result.status).toBe('failed');
    expect((await t.run((ctx) => ctx.db.get(strangerAccount)))?.archivedAt).toBeUndefined();
  });

  it('delete and restore tools follow the "prepare changes" setting', () => {
    const off = resolveFinaiSettings({ allowActions: false });
    expect(finaiToolAllowed(off, 'delete_transaction')).toBe(false);
    expect(finaiToolAllowed(off, 'propose_delete')).toBe(false);
    expect(finaiToolAllowed(off, 'list_trash')).toBe(true);
  });
});

describe('MCP access control', () => {
  it('stores settings, edits grant scopes and reports the live policy', async () => {
    const { t, me, userId } = await setup();
    const grantId = await t.run((ctx) =>
      ctx.db.insert('mcpOAuthGrants', {
        clientId: 'a'.repeat(64),
        userId,
        scopes: ['finapp:read', 'finapp:write:finance'],
        createdAt: 1,
      }),
    );
    expect(await me.query(api.mcpOAuth.getSettings, {})).toEqual({
      enabled: true,
      readOnly: false,
      allowDestructive: true,
      blockedTools: [],
    });
    await me.mutation(api.mcpOAuth.updateSettings, {
      readOnly: true,
      blockedTools: ['finapp.finance.trash.purge'],
    });
    expect(
      await me.mutation(api.mcpOAuth.updateGrantScopes, {
        grantId,
        scopes: ['finapp:write:groups'],
      }),
    ).toEqual(['finapp:read', 'finapp:write:groups']);
    const policy = await me.query(api.mcpOAuth.accessPolicy, { grantId });
    expect(policy).toEqual({
      scopes: ['finapp:read', 'finapp:write:groups'],
      settings: {
        enabled: true,
        readOnly: true,
        allowDestructive: true,
        blockedTools: ['finapp.finance.trash.purge'],
      },
    });
    await expect(
      me.mutation(api.mcpOAuth.updateSettings, { blockedTools: ['rm -rf'] }),
    ).rejects.toThrow('INVALID_TOOL_NAME');
  });

  it('hides tools according to the policy', () => {
    const open = { enabled: true, readOnly: false, allowDestructive: true, blockedTools: [] };
    const write = { name: 'finapp.finance.goals.create', scope: 'finapp:write:finance' };
    const remove = {
      name: 'finapp.finance.goals.archive',
      scope: 'finapp:write:finance',
      destructive: true,
    };
    const read = { name: 'finapp.finance.goals.list', scope: 'finapp:read' };
    expect(blockedReason(write, open)).toBeNull();
    expect(blockedReason(write, { ...open, readOnly: true })).toMatch(/read-only/);
    expect(blockedReason(read, { ...open, readOnly: true })).toBeNull();
    expect(blockedReason(remove, { ...open, allowDestructive: false })).toMatch(/Deletes/);
    expect(blockedReason(read, { ...open, blockedTools: [read.name] })).toMatch(/blocked/);
    expect(blockedReason(read, { ...open, enabled: false })).toMatch(/turned off/);
  });
});
