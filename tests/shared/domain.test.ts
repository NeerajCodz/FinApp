import { describe, expect, it } from 'vitest';
import { DomainError } from '../../convex/shared/errors';
import {
  requireAdmin,
  requireMember,
  requireSettlementParticipant,
} from '../../convex/shared/permissions';
import { assertCurrency, assertPositiveAmount } from '../../convex/shared/validators';

describe('domain boundaries', () => {
  it('rejects unsupported currencies and non-positive amounts', () => {
    expect(() => assertCurrency('XYZ')).toThrow('INVALID_CURRENCY');
    expect(() => assertPositiveAmount(0n)).toThrow('INVALID_AMOUNT');
  });

  it('denies non-members and non-participant settlements with typed errors', () => {
    expect(() => requireMember('outsider', [{ userId: 'member', role: 'member' }])).toThrow(
      DomainError,
    );
    expect(() => requireSettlementParticipant('outsider', 'from', 'to')).toThrow(
      'INSUFFICIENT_PERMISSION',
    );
  });

  it('allows owners and admins to administer groups', () => {
    expect(() => requireAdmin('owner', 'owner', [])).not.toThrow();
    expect(() =>
      requireAdmin('admin', 'owner', [{ userId: 'admin', role: 'admin' }]),
    ).not.toThrow();
  });
});
