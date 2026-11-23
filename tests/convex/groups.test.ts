import { describe, expect, it } from 'vitest';
import {
  allocateParticipants,
  balanceDeltas,
  calculateNetBalances,
  createSplit,
  matchesAllocation,
  settledImpact,
  simplifyDebts,
} from '../../convex/splits/domain';
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

describe('deterministic split allocation', () => {
  it('assigns leftover units by user id, not selection order', () => {
    const forward = allocateParticipants(100n, ['u-b', 'u-a', 'u-c'], 'equal');
    const reversed = allocateParticipants(100n, ['u-c', 'u-a', 'u-b'], 'equal');
    const byUser = (rows: { userId: string; amountMinor: bigint }[]) =>
      Object.fromEntries(rows.map((row) => [row.userId, row.amountMinor]));
    expect(byUser(forward)).toEqual({ 'u-a': 34n, 'u-b': 33n, 'u-c': 33n });
    expect(byUser(reversed)).toEqual(byUser(forward));
    expect(forward.map((row) => row.userId)).toEqual(['u-b', 'u-a', 'u-c']);
  });

  it('keeps proportional ties stable regardless of order', () => {
    const left = allocateParticipants(10n, ['z', 'a', 'm'], 'shares', [1n, 1n, 1n]);
    const right = allocateParticipants(10n, ['a', 'm', 'z'], 'shares', [1n, 1n, 1n]);
    expect(left.find((row) => row.userId === 'a')?.amountMinor).toBe(4n);
    expect(right.find((row) => row.userId === 'a')?.amountMinor).toBe(4n);
  });

  it('accepts both deterministic and legacy selection-order allocations', () => {
    const legacy = [
      { userId: 'u-b', amountMinor: 34n },
      { userId: 'u-a', amountMinor: 33n },
      { userId: 'u-c', amountMinor: 33n },
    ];
    expect(matchesAllocation(100n, legacy, 'equal')).toBe(true);
    expect(
      matchesAllocation(100n, allocateParticipants(100n, ['u-b', 'u-a', 'u-c'], 'equal'), 'equal'),
    ).toBe(true);
    expect(
      matchesAllocation(
        100n,
        [
          { userId: 'u-b', amountMinor: 50n },
          { userId: 'u-a', amountMinor: 25n },
          { userId: 'u-c', amountMinor: 25n },
        ],
        'equal',
      ),
    ).toBe(false);
  });
});

describe('edit impact', () => {
  it('reports per-member deltas and credits for members who already settled', () => {
    const before = { owner: 1500n, member: 0n, other: -1500n };
    const after = { owner: 500n, member: 1000n, other: -1500n };
    expect(balanceDeltas(before, after)).toEqual({ owner: -1000n, member: 1000n });
    expect(settledImpact(before, after, ['member', 'other'])).toEqual([
      { userId: 'member', before: 0n, after: 1000n, credit: true },
    ]);
  });
});

describe('simplifyDebts', () => {
  it('clears every balance with the fewest greedy transfers', () => {
    const balances = { a: 600n, b: -200n, c: -300n, d: -100n };
    const transfers = simplifyDebts(balances);
    expect(transfers).toEqual([
      { fromUserId: 'c', toUserId: 'a', amountMinor: 300n },
      { fromUserId: 'b', toUserId: 'a', amountMinor: 200n },
      { fromUserId: 'd', toUserId: 'a', amountMinor: 100n },
    ]);
    const settled = { ...balances } as Record<string, bigint>;
    for (const transfer of transfers) {
      settled[transfer.fromUserId]! += transfer.amountMinor;
      settled[transfer.toUserId]! -= transfer.amountMinor;
    }
    expect(Object.values(settled).every((amount) => amount === 0n)).toBe(true);
  });

  it('chains through several creditors and returns nothing when settled', () => {
    expect(simplifyDebts({ a: 500n, b: 300n, c: -800n })).toEqual([
      { fromUserId: 'c', toUserId: 'a', amountMinor: 500n },
      { fromUserId: 'c', toUserId: 'b', amountMinor: 300n },
    ]);
    expect(simplifyDebts({ a: 0n, b: 0n })).toEqual([]);
  });
});
