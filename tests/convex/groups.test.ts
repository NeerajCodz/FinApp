import { describe, expect, it } from 'vitest';
import { calculateNetBalances, createSplit } from '../../convex/splits/domain';
import { createSettlement } from '../../convex/settlements/domain';
import { changeMemberRole, renameGroup } from '../../convex/groups/domain';

describe('group split ledger', () => {
  it('supports multi-payer expenses and preserves payer participant totals', () => {
    const split = createSplit(
      100n,
      [
        { userId: 'a', amountMinor: 60n },
        { userId: 'b', amountMinor: 40n },
      ],
      [
        { userId: 'a', amountMinor: 50n },
        { userId: 'b', amountMinor: 25n },
        { userId: 'c', amountMinor: 25n },
      ],
    );
    expect(split.payers.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(100n);
    expect(calculateNetBalances(split.payers, split.participants, [])).toEqual({
      a: 10n,
      b: 15n,
      c: -25n,
    });
  });

  it('adds settlements without deleting the original expense', () => {
    const settlement = createSettlement('a', 'c', 25n);
    expect(settlement.amountMinor).toBe(25n);
  });
});

describe('group settings permissions', () => {
  const group = { id: 'group', ownerId: 'owner', name: 'Weekend trip', currency: 'INR' };
  const members = [
    { userId: 'owner', role: 'owner' as const },
    { userId: 'admin', role: 'admin' as const },
    { userId: 'member', role: 'member' as const },
  ];

  it('allows admins to rename a group and trims the saved name', () => {
    expect(renameGroup('admin', group, members, '  Goa weekend  ').name).toBe('Goa weekend');
  });

  it('rejects blank names and edits by regular members', () => {
    expect(() => renameGroup('owner', group, members, '   ')).toThrow('INVALID_GROUP');
    expect(() => renameGroup('member', group, members, 'Not allowed')).toThrow(
      'INSUFFICIENT_PERMISSION',
    );
  });

  it('lets admins promote and demote members without changing ownership', () => {
    expect(
      changeMemberRole('owner', group, members, 'member', 'admin').find(
        (member) => member.userId === 'member',
      )?.role,
    ).toBe('admin');
    expect(
      changeMemberRole('admin', group, members, 'member', 'member').find(
        (member) => member.userId === 'member',
      )?.role,
    ).toBe('member');
    expect(() => changeMemberRole('member', group, members, 'admin', 'member')).toThrow(
      'INSUFFICIENT_PERMISSION',
    );
    expect(() => changeMemberRole('owner', group, members, 'member', 'owner')).toThrow(
      'INSUFFICIENT_PERMISSION',
    );
  });
});
