import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';

const modules = import.meta.glob('../../convex/**/*.ts');

function identity(subject: string) {
  return { subject, email: `${subject}@example.com`, name: subject };
}

describe('category preferences mutation', () => {
  it('persists kind and color, replays idempotently, validates fields, and enforces ownership', async () => {
    const t = convexTest(schema, modules);
    const ownerIdentity = identity('category-preferences-owner');
    const otherIdentity = identity('category-preferences-other');
    for (const user of [ownerIdentity, otherIdentity]) {
      await t.run((ctx) =>
        ctx.db.insert('users', {
          emailVerificationTime: 1,
          identityId: user.subject,
          email: user.email,
          displayName: user.name,
        }),
      );
    }
    const owner = t.withIdentity(ownerIdentity);
    const other = t.withIdentity(otherIdentity);
    await expect(
      owner.mutation(api.categories.mutations.create, {
        name: 'Invalid color',
        color: '#12ab',
      }),
    ).rejects.toThrow('INVALID_CATEGORY');
    const categoryId = await owner.mutation(api.categories.mutations.create, {
      name: 'Personal category',
      icon: '🛒',
      kind: 'expense',
      color: '#34AA56',
    });
    const created = await owner.run((ctx) => ctx.db.get(categoryId));
    expect(created?.kind).toBe('expense');
    expect(created?.color).toBe('#34AA56');
    const args = {
      categoryId,
      kind: 'income' as const,
      color: '#12abEF',
      clientMutationId: 'category-preferences-once',
    };
    expect(await owner.mutation(api.categories.mutations.setPreferences, args)).toBe(categoryId);
    const first = await owner.run((ctx) => ctx.db.get(categoryId));
    expect(first?.kind).toBe('income');
    expect(first?.color).toBe('#12abEF');
    expect(await owner.mutation(api.categories.mutations.setPreferences, args)).toBe(categoryId);
    const replayed = await owner.run((ctx) => ctx.db.get(categoryId));
    expect(replayed?.updatedAt).toBe(first?.updatedAt);
    await expect(other.mutation(api.categories.mutations.setPreferences, args)).rejects.toThrow(
      'INVALID_CATEGORY',
    );
    await expect(
      owner.mutation(api.categories.mutations.setPreferences, {
        categoryId,
        kind: 'expense',
        color: 'red',
      }),
    ).rejects.toThrow('INVALID_CATEGORY');
    const unchanged = await owner.run((ctx) => ctx.db.get(categoryId));
    expect(unchanged?.kind).toBe('income');
    expect(unchanged?.color).toBe('#12abEF');
  });
});
