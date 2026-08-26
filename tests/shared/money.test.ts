import { describe, expect, it } from 'vitest';
import {
  allocateRemainder,
  allocateSplit,
  formatMinor,
  parseMinor,
} from '../../convex/shared/money';

describe('integer money', () => {
  it('parses Indian currency without floating point', () => {
    expect(parseMinor('₹1,240.50', 'INR')).toBe(124050n);
  });

  it('formats bigint minor units at the presentation boundary', () => {
    expect(formatMinor(124050n, 'INR', 'en-IN')).toContain('1,240.50');
  });

  it('allocates remainders by supplied participant order', () => {
    expect(allocateRemainder(100n, ['a', 'b', 'c'])).toEqual({ a: 34n, b: 33n, c: 33n });
  });

  it('supports every split method and preserves the total', () => {
    expect(allocateSplit(100n, ['a', 'b', 'c'], { method: 'equal' })).toEqual({
      a: 34n,
      b: 33n,
      c: 33n,
    });
    expect(allocateSplit(100n, ['a', 'b'], { method: 'exact', values: [25n, 75n] })).toEqual({
      a: 25n,
      b: 75n,
    });
    expect(
      allocateSplit(100n, ['a', 'b', 'c'], { method: 'percentage', values: [3333, 3333, 3334] }),
    ).toEqual({ a: 33n, b: 33n, c: 34n });
    expect(
      allocateSplit(100n, ['a', 'b', 'c'], { method: 'shares', values: [1n, 1n, 1n] }),
    ).toEqual({ a: 34n, b: 33n, c: 33n });
    expect(allocateSplit(100n, ['a', 'b'], { method: 'adjustment', values: [40n, 60n] })).toEqual({
      a: 40n,
      b: 60n,
    });
  });

  it('rejects invalid totals and allocations', () => {
    expect(() => allocateSplit(100n, ['a', 'b'], { method: 'exact', values: [25n, 25n] })).toThrow(
      'INVALID_SPLIT',
    );
    expect(() =>
      allocateSplit(100n, ['a', 'b'], { method: 'percentage', values: [5000, 5000] }),
    ).not.toThrow();
    expect(() =>
      allocateSplit(100n, ['a', 'b'], { method: 'percentage', values: [5000, 4000] }),
    ).toThrow('INVALID_SPLIT');
  });
});
