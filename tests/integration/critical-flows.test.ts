import { describe, expect, it } from 'vitest';
import { allocateSplit, parseMinor } from '../../convex/shared/money';
import { composeDashboard } from '../../convex/dashboard/domain';
import { notificationRoute } from '../../convex/notifications/domain';
import { markConflict } from '../../app/mobile/local/outbox/queue';

describe('Finapp critical flow contracts', () => {
  it('keeps amount parsing, split rounding, and dashboard derivation consistent', () => {
    const amount = parseMinor('₹1,240.50', 'INR');
    const split = allocateSplit(amount, ['payer', 'friend', 'third'], { method: 'equal' });
    const total = Object.values(split).reduce((sum, value) => sum + value, 0n);
    expect(total).toBe(amount);
    expect(
      composeDashboard({
        openingBalanceMinor: 1000n,
        incomeMinor: amount,
        expenseMinor: 24050n,
        owedToUserMinor: 0n,
        owesUserMinor: 0n,
        recentTransactions: [],
        goalProgress: 50,
      }).availableBalanceMinor,
    ).toBe(101000n);
  });
  it('keeps conflict review and deep-link routing explicit', () => {
    expect(markConflict('TRANSACTION_CHANGED').action).toBe('Review changes');
    expect(
      notificationRoute({ type: 'expense', entityType: 'transaction', entityId: 'tx-1' }),
    ).toBe('finapp://transaction/tx-1');
  });
});
