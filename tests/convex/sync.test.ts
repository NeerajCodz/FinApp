import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

async function makeAuthenticatedUser() {
  const t = convexTest(schema, modules);
  const identity = { subject: 'sync-contract-user', email: 'sync@example.com', name: 'Sync User' };
  const userId = await t.run((ctx) =>
    ctx.db.insert('users', {
      emailVerificationTime: 1,
      identityId: identity.subject,
      email: identity.email,
      displayName: identity.name,
    }),
  );
  return { t, userId, authenticated: t.withIdentity(identity) };
}

describe('authenticated local-first sync contract', () => {
  it('rejects unauthenticated bootstrap and oversized pages', async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.sync.queries.bootstrapIdentity, {})).rejects.toThrow('AUTH_REQUIRED');

    const { authenticated } = await makeAuthenticatedUser();
    await expect(
      authenticated.query(api.sync.queries.bootstrapSection, {
        section: 'accounts',
        paginationOpts: { numItems: 101, cursor: null },
      }),
    ).rejects.toThrow('INVALID_PAGE_SIZE');
  });

  it('returns transaction ranges with inclusive start and exclusive end', async () => {
    const { authenticated } = await makeAuthenticatedUser();
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Cash',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    const common = {
      accountId,
      type: 'expense' as const,
      amountMinor: 100n,
      currency: 'INR',
      title: 'Range item',
    };
    await authenticated.mutation(api.transactions.mutations.create, {
      ...common,
      occurredAt: 1_000,
      clientMutationId: 'sync-range-start',
    });
    await authenticated.mutation(api.transactions.mutations.create, {
      ...common,
      occurredAt: 2_000,
      clientMutationId: 'sync-range-end',
    });

    const page = await authenticated.query(api.sync.queries.transactionRange, {
      startAt: 1_000,
      endAt: 2_000,
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(1);
    expect(page.page[0]?.occurredAt).toBe(1_000);
    expect(page.related.accounts).toHaveLength(1);
    await expect(
      authenticated.query(api.sync.queries.transactionRange, {
        startAt: 2_000,
        endAt: 1_000,
        paginationOpts: { numItems: 10, cursor: null },
      }),
    ).rejects.toThrow('INVALID_DATE_RANGE');
  });

  it('replays a write once and exposes its durable change revision', async () => {
    const { t, userId, authenticated } = await makeAuthenticatedUser();
    const input = {
      name: 'Replay-safe wallet',
      type: 'wallet' as const,
      currency: 'INR',
      openingBalanceMinor: 500n,
      isIncludedInTotal: true,
      clientMutationId: 'account-create-once',
    };
    const firstId = await authenticated.mutation(api.accounts.mutations.create, input);
    const replayedId = await authenticated.mutation(api.accounts.mutations.create, input);
    expect(replayedId).toBe(firstId);
    expect(await t.run((ctx) => ctx.db.query('accounts').collect())).toHaveLength(1);
    const page = await authenticated.query(api.sync.queries.changes, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    expect(page.page).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeUserId: userId,
          entityType: 'accounts',
          documentId: firstId,
          revision: 1n,
        }),
      ]),
    );
    expect(page.latestRevision).toBe(1n);
  });

  it('persists, validates, and clears account colors', async () => {
    const { authenticated } = await makeAuthenticatedUser();
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Color test account',
      type: 'bank',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    const setColor = {
      accountId,
      color: '#B7FF4A',
      clientMutationId: 'account-color-set',
    };
    await authenticated.mutation(api.accounts.mutations.setColor, setColor);
    await authenticated.mutation(api.accounts.mutations.setColor, setColor);
    const colored = await authenticated.query(api.accounts.queries.detail, { accountId });
    expect(colored?.account.color).toBe('#B7FF4A');

    await expect(
      authenticated.mutation(api.accounts.mutations.setColor, {
        accountId,
        color: 'lime',
        clientMutationId: 'account-color-invalid',
      }),
    ).rejects.toThrow('INVALID_ACCOUNT');
    const unchanged = await authenticated.query(api.accounts.queries.detail, { accountId });
    expect(unchanged?.account.color).toBe('#B7FF4A');

    await authenticated.mutation(api.accounts.mutations.setColor, {
      accountId,
      color: null,
      clientMutationId: 'account-color-clear',
    });
    const cleared = await authenticated.query(api.accounts.queries.detail, { accountId });
    expect(cleared?.account.color).toBeUndefined();
  });
  it('paginates group transactions and settlements through separate queries', async () => {
    const { t, userId, authenticated } = await makeAuthenticatedUser();
    const groupId = await authenticated.mutation(api.groups.mutations.create, {
      name: 'Range group',
      currency: 'INR',
      memberUsernames: [],
      clientMutationId: 'group-range-create',
    });
    const accountId = await authenticated.mutation(api.accounts.mutations.create, {
      name: 'Range account',
      type: 'cash',
      currency: 'INR',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
    });
    await t.run(async (ctx) => {
      for (const occurredAt of [1_000, 2_000]) {
        await ctx.db.insert('transactions', {
          ownerId: userId,
          accountId,
          type: 'expense',
          amountMinor: 100n,
          currency: 'INR',
          groupId: String(groupId),
          title: `Group transaction ${occurredAt}`,
          occurredAt,
          status: 'posted',
          createdAt: occurredAt,
          updatedAt: occurredAt,
        });
        await ctx.db.insert('settlements', {
          groupId,
          fromUserId: userId,
          toUserId: userId,
          amountMinor: 100n,
          currency: 'INR',
          accountId,
          occurredAt,
          createdAt: occurredAt,
        });
      }
    });

    const firstTransactions = await authenticated.query(api.sync.queries.groupTransactionRange, {
      groupId,
      startAt: 0,
      endAt: 3_000,
      paginationOpts: { numItems: 1, cursor: null },
    });
    const firstSettlements = await authenticated.query(api.sync.queries.groupSettlementRange, {
      groupId,
      startAt: 0,
      endAt: 3_000,
      paginationOpts: { numItems: 1, cursor: null },
    });
    expect(firstTransactions.transactions.page).toHaveLength(1);
    expect(firstTransactions.transactions.isDone).toBe(false);
    expect(firstSettlements.settlements.page).toHaveLength(1);
    expect(firstSettlements.settlements.isDone).toBe(false);

    const secondTransactions = await authenticated.query(api.sync.queries.groupTransactionRange, {
      groupId,
      startAt: 0,
      endAt: 3_000,
      paginationOpts: { numItems: 1, cursor: firstTransactions.transactions.continueCursor },
    });
    const secondSettlements = await authenticated.query(api.sync.queries.groupSettlementRange, {
      groupId,
      startAt: 0,
      endAt: 3_000,
      paginationOpts: { numItems: 1, cursor: firstSettlements.settlements.continueCursor },
    });
    expect(secondTransactions.transactions.page).toHaveLength(1);
    expect(secondTransactions.transactions.isDone).toBe(true);
    expect(secondSettlements.settlements.page).toHaveLength(1);
    expect(secondSettlements.settlements.isDone).toBe(true);
  });
  it('persists a gender-matched avatar and exposes its catalog URL', async () => {
    const { t, authenticated } = await makeAuthenticatedUser();
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([new Uint8Array([1])], { type: 'image/png' })),
    );
    await t.run((ctx) =>
      ctx.db.insert('avatars', {
        avatarId: 'AV1',
        gender: 'male',
        storageId,
        url: 'https://avatars.example/AV1.png',
        createdAt: 1,
        updatedAt: 1,
      }),
    );

    const updated = await authenticated.mutation(api.users.mutations.update, {
      avatarId: 'AV1',
      gender: 'male',
    });
    expect(updated.avatarId).toBe('AV1');
    const profile = await authenticated.query(api.users.queries.current, {});
    expect(profile?.avatarId).toBe('AV1');
    expect(profile?.gender).toBe('male');
    expect(profile?.avatarUrl).toBe('https://avatars.example/AV1.png');
    const groupId = await authenticated.mutation(api.groups.mutations.create, {
      name: 'Avatar group',
      currency: 'INR',
      memberUsernames: [],
      clientMutationId: 'avatar-group-create',
    });
    const group = await authenticated.query(api.groups.queries.detail, { groupId });
    expect(group?.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          avatarId: 'AV1',
          gender: 'male',
          avatarUrl: 'https://avatars.example/AV1.png',
        }),
      ]),
    );
    await expect(
      authenticated.mutation(api.users.mutations.update, {
        avatarId: 'AV1',
        gender: 'female',
      }),
    ).rejects.toThrow('AVATAR_GENDER_MISMATCH');
  });
});
