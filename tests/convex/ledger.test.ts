import { describe, expect, it } from 'vitest';
import { deriveBalance } from '../../convex/accounts/domain';
import { seedCategories, validateCategorySelection } from '../../convex/categories/domain';
import { assertMutationAvailable } from '../../convex/transactions/domain';

describe('personal ledger invariants', () => {
  it('derives account balance from ledger direction', () => {
    expect(
      deriveBalance(1000n, [
        { type: 'income', amountMinor: 500n },
        { type: 'expense', amountMinor: 200n },
        { type: 'transfer-in', amountMinor: 300n },
        { type: 'transfer-out', amountMinor: 100n },
      ]),
    ).toBe(1500n);
  });

  it('seeds stable system categories and rejects archived selection', () => {
    expect(seedCategories().some((category) => category.name === 'Food')).toBe(true);
    expect(() => validateCategorySelection({ archivedAt: Date.now() })).toThrow('INVALID_CATEGORY');
    expect(() => validateCategorySelection({ archivedAt: undefined })).not.toThrow();
  });

  it('rejects duplicate client mutation IDs', () => {
    expect(() => assertMutationAvailable({ clientMutationId: 'm-1' }, 'm-1')).toThrow(
      'DUPLICATE_MUTATION',
    );
    expect(() => assertMutationAvailable(null, 'm-1')).not.toThrow();
  });
});
