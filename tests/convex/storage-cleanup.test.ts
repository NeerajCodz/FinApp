import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { internal } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

describe('orphaned Convex storage cleanup', () => {
  it('deletes unreferenced files and preserves every app-owned storage reference', async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerId = await ctx.db.insert('users', {
        identityId: 'storage-cleanup-owner',
        email: 'storage-cleanup@example.com',
        emailVerificationTime: 1,
        displayName: 'Storage cleanup owner',
      });
      const accountId = await ctx.db.insert('accounts', {
        ownerId,
        name: 'Wallet',
        type: 'cash',
        currency: 'INR',
        openingBalanceMinor: 0n,
        isIncludedInTotal: true,
        createdAt: now,
        updatedAt: now,
      });
      const categoryId = await ctx.db.insert('categories', {
        ownerId,
        name: 'Food',
        kind: 'expense',
        isSystem: false,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
      });
      const transactionId = await ctx.db.insert('transactions', {
        ownerId,
        accountId,
        type: 'expense',
        amountMinor: 500n,
        currency: 'INR',
        categoryId: String(categoryId),
        title: 'Receipt test',
        occurredAt: now,
        status: 'posted',
        createdAt: now,
        updatedAt: now,
      });
      const orphan = await ctx.storage.store(new Blob(['orphan'], { type: 'text/plain' }));
      const userAvatar = await ctx.storage.store(new Blob(['user avatar'], { type: 'image/png' }));
      const catalogAvatar = await ctx.storage.store(new Blob(['catalog avatar'], { type: 'image/png' }));
      const receipt = await ctx.storage.store(new Blob(['receipt'], { type: 'image/png' }));
      await ctx.db.patch(ownerId, { avatarStorageId: String(userAvatar) });
      await ctx.db.insert('avatars', {
        avatarId: 'storage-cleanup-avatar',
        gender: 'neutral',
        storageId: catalogAvatar,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('receipts', {
        transactionId,
        ownerId,
        storageId: receipt,
        mimeType: 'image/png',
        size: 7,
        createdAt: now,
      });
      return { orphan, userAvatar, catalogAvatar, receipt };
    });

    await t.mutation(internal.ai.receipts.purgeOrphanedStorage, {
      olderThan: Date.now() + 60_000,
    });

    const files = await t.run(async (ctx) => ({
      orphan: await ctx.db.system.get('_storage', ids.orphan),
      userAvatar: await ctx.db.system.get('_storage', ids.userAvatar),
      catalogAvatar: await ctx.db.system.get('_storage', ids.catalogAvatar),
      receipt: await ctx.db.system.get('_storage', ids.receipt),
    }));
    expect(files.orphan).toBeNull();
    expect(files.userAvatar).not.toBeNull();
    expect(files.catalogAvatar).not.toBeNull();
    expect(files.receipt).not.toBeNull();
  });
});
