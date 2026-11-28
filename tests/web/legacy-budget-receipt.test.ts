import { describe, expect, it, vi } from 'vitest';
import { legacyBudgetReceipt } from '../../apps/web/lib/offline/legacyBudgetReceipt';

describe('legacy budget outbox receipts', () => {
  it('keeps the current sync revision when dropping an obsolete budget write', async () => {
    const readSyncState = vi.fn(async () => ({ revision: '27' }));
    const before = Date.now();

    const receipt = await legacyBudgetReceipt('user-a', 'budget-record', readSyncState);

    expect(readSyncState).toHaveBeenCalledWith('user-a');
    expect(receipt).toMatchObject({ serverId: 'budget-record', revision: '27' });
    expect(receipt.updatedAt).toBeGreaterThanOrEqual(before);
  });
});
