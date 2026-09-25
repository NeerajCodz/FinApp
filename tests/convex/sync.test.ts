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
});
