import { describe, expect, it } from 'vitest';
import {
  allocateItemized,
  keptLineItems,
  matchesItemizedAllocation,
  normalizeLineItems,
} from '../../convex/splits/domain';

describe('allocateItemized', () => {
  it('shares each item equally between its participants', () => {
    const shares = allocateItemized(
      [
        { amountMinor: 20000n },
        { amountMinor: 30000n, participantIds: ['b', 'c'] },
        { amountMinor: 50000n, participantIds: ['a'] },
      ],
      ['a', 'b', 'c'],
    );
    expect(shares).toEqual([
      { userId: 'a', amountMinor: 6667n + 50000n },
      { userId: 'b', amountMinor: 6667n + 15000n },
      { userId: 'c', amountMinor: 6666n + 15000n },
    ]);
    expect(shares.reduce((total, row) => total + row.amountMinor, 0n)).toBe(100000n);
  });

  it('rounds deterministically regardless of selection order', () => {
    const items = [{ amountMinor: 100n }, { amountMinor: 1n, participantIds: ['z', 'm'] }];
    const forward = allocateItemized(items, ['m', 'z', 'a']);
    const backward = allocateItemized(items, ['a', 'z', 'm']);
    const byUser = (rows: { userId: string; amountMinor: bigint }[]) =>
      Object.fromEntries(rows.map((row) => [row.userId, row.amountMinor]));
    expect(byUser(forward)).toEqual(byUser(backward));
    expect(byUser(forward)).toEqual({ a: 34n, m: 34n, z: 33n });
    // Rows follow the participant order passed in.
    expect(forward.map((row) => row.userId)).toEqual(['m', 'z', 'a']);
  });

  it('treats an empty participant list as everyone and allows one-person items', () => {
    expect(
      allocateItemized(
        [
          { amountMinor: 10n, participantIds: [] },
          { amountMinor: 7n, participantIds: ['b'] },
        ],
        ['a', 'b'],
      ),
    ).toEqual([
      { userId: 'a', amountMinor: 5n },
      { userId: 'b', amountMinor: 12n },
    ]);
  });

  it('leaves people with no items at zero', () => {
    expect(allocateItemized([{ amountMinor: 9n, participantIds: ['a'] }], ['a', 'b'])).toEqual([
      { userId: 'a', amountMinor: 9n },
      { userId: 'b', amountMinor: 0n },
    ]);
  });

  it('rejects unknown people, empty input and non-positive items', () => {
    expect(() => allocateItemized([{ amountMinor: 5n, participantIds: ['x'] }], ['a'])).toThrow(
      'INVALID_SPLIT',
    );
    expect(() => allocateItemized([], ['a'])).toThrow('INVALID_SPLIT');
    expect(() => allocateItemized([{ amountMinor: 5n }], [])).toThrow('INVALID_SPLIT');
    expect(() => allocateItemized([{ amountMinor: 0n }], ['a'])).toThrow('INVALID_SPLIT');
    expect(() =>
      allocateItemized([{ amountMinor: 5n, participantIds: ['a', 'a'] }], ['a']),
    ).toThrow('INVALID_SPLIT');
  });

  it('validates client rows against the total', () => {
    const items = [{ amountMinor: 3n }, { amountMinor: 4n, participantIds: ['b'] }];
    const rows = allocateItemized(items, ['a', 'b']);
    expect(matchesItemizedAllocation(7n, rows, items)).toBe(true);
    expect(matchesItemizedAllocation(8n, rows, items)).toBe(false);
    expect(
      matchesItemizedAllocation(
        7n,
        [
          { userId: 'a', amountMinor: 1n },
          { userId: 'b', amountMinor: 6n },
        ],
        items,
      ),
    ).toBe(false);
  });
});

describe('normalizeLineItems', () => {
  it('trims titles, drops empty assignments and checks the total', () => {
    expect(
      normalizeLineItems(
        [
          { id: ' a ', title: '  Starters ', amountMinor: 200n, participantIds: [] },
          { id: 'b', title: 'Juice', amountMinor: 300n, quantity: 2 },
        ],
        500n,
      ),
    ).toEqual([
      { id: 'a', title: 'Starters', amountMinor: 200n },
      { id: 'b', title: 'Juice', amountMinor: 300n, quantity: 2 },
    ]);
    expect(normalizeLineItems([], 500n)).toEqual([]);
    expect(() => normalizeLineItems([{ id: 'a', title: 'A', amountMinor: 200n }], 500n)).toThrow(
      'ITEMS_TOTAL_MISMATCH',
    );
  });

  it('rejects invalid items', () => {
    const bad = [
      { id: 'a', title: 'x'.repeat(81), amountMinor: 1n },
      { id: '', title: 'A', amountMinor: 1n },
      { id: 'a', title: 'A', amountMinor: -1n },
      { id: 'a', title: 'A', amountMinor: 1n, quantity: 1.5 },
      { id: 'a', title: 'A', amountMinor: 1n, quantity: 0 },
    ];
    for (const item of bad) expect(() => normalizeLineItems([item], 1n)).toThrow('INVALID_ITEMS');
    expect(() =>
      normalizeLineItems(
        [
          { id: 'a', title: 'A', amountMinor: 1n },
          { id: 'a', title: 'B', amountMinor: 1n },
        ],
        2n,
      ),
    ).toThrow('INVALID_ITEMS');
    const many = Array.from({ length: 101 }, (_, index) => ({
      id: String(index),
      title: 'Item',
      amountMinor: 1n,
    }));
    expect(() => normalizeLineItems(many, 101n)).toThrow('INVALID_ITEMS');
  });

  it('keeps stored items only while they match an edited total', () => {
    const items = [{ amountMinor: 2n }, { amountMinor: 3n }];
    expect(keptLineItems(items, 5n)).toEqual(items);
    expect(keptLineItems(items, 6n)).toBeUndefined();
    expect(keptLineItems(undefined, 6n)).toBeUndefined();
  });
});
