import { describe, expect, it } from 'vitest';
import {
  basisInputFromRow,
  computeExpenseDraft,
  computePayerDraft,
  formatBasisPoints,
  parsePercentBasisPoints,
} from '../../packages/ui/src/finance/groupExpenseDraft';
import { matchesAllocation } from '../../convex/splits/domain';

describe('percent entry', () => {
  it('accepts real percentages and converts them to basis points', () => {
    expect(parsePercentBasisPoints('33.33')).toBe(3333n);
    expect(parsePercentBasisPoints('33.33%')).toBe(3333n);
    expect(parsePercentBasisPoints(' 50 % ')).toBe(5000n);
    expect(parsePercentBasisPoints('12,5')).toBe(1250n);
    expect(parsePercentBasisPoints('0.5')).toBe(50n);
    expect(parsePercentBasisPoints('.25')).toBe(25n);
    expect(parsePercentBasisPoints('100')).toBe(10_000n);
    expect(parsePercentBasisPoints('0')).toBe(0n);
  });

  it('rejects out-of-range, over-precise and malformed input', () => {
    for (const input of ['100.01', '101', '33.333', '-5', '', '.', 'abc', '1e2', '5%%'])
      expect(() => parsePercentBasisPoints(input), input).toThrow('INVALID_PERCENT');
  });

  it('round-trips basis points into editable text', () => {
    expect(formatBasisPoints(3333n)).toBe('33.33');
    expect(formatBasisPoints(3350n)).toBe('33.5');
    expect(formatBasisPoints(3305n)).toBe('33.05');
    expect(formatBasisPoints(5000n)).toBe('50');
    for (const value of [1n, 50n, 999n, 3333n, 10_000n])
      expect(parsePercentBasisPoints(formatBasisPoints(value))).toBe(value);
  });
});

describe('expense draft', () => {
  const ids = ['b-user', 'a-user', 'c-user'];

  it('splits equally with a stable remainder and live preview', () => {
    const draft = computeExpenseDraft({
      amount: '100',
      currency: 'INR',
      method: 'equal',
      participantIds: ids,
      basis: {},
    });
    expect(draft.error).toBe('');
    expect(draft.totalMinor).toBe(10_000n);
    expect(draft.shares.map((share) => share.amountMinor)).toEqual([3333n, 3334n, 3333n]);
    expect(draft.allocation).toMatchObject({ tone: 'positive' });
    expect(draft.participants.every((row) => row.basisValue === undefined)).toBe(true);
  });

  it('saves real percentages as basis points the server accepts', () => {
    const draft = computeExpenseDraft({
      amount: '90',
      currency: 'INR',
      method: 'percentage',
      participantIds: ids,
      basis: { 'b-user': '33.33', 'a-user': '33.33%', 'c-user': '33.34' },
    });
    expect(draft.error).toBe('');
    expect(draft.participants.map((row) => row.basisValue)).toEqual(['3333', '3333', '3334']);
    expect(draft.shares.reduce((total, share) => total + share.amountMinor, 0n)).toBe(9000n);
    expect(matchesAllocation(9000n, draft.participants, 'percentage', [3333n, 3333n, 3334n])).toBe(
      true,
    );
  });

  it('shows what is left to assign and turns destructive when over', () => {
    const partial = computeExpenseDraft({
      amount: '100',
      currency: 'INR',
      method: 'percentage',
      participantIds: ids,
      basis: { 'b-user': '50', 'a-user': '25' },
    });
    expect(partial.error).toMatch(/every selected person/);
    expect(partial.allocation).toMatchObject({ tone: 'destructive', remaining: 2500n });
    expect(partial.allocation.label).toBe('25% left to assign');
    expect(partial.preview.map((row) => row.amountMinor)).toEqual([5000n, 2500n, null]);

    const over = computeExpenseDraft({
      amount: '10',
      currency: 'INR',
      method: 'exact',
      participantIds: ids.slice(0, 2),
      basis: { 'b-user': '6', 'a-user': '5' },
    });
    expect(over.allocation).toMatchObject({ tone: 'destructive', remaining: -100n });
    expect(over.allocation.label).toContain('over');
    expect(over.error).toBe('Amounts must add up to the total.');
  });

  it('accepts exact amounts that add up and records them as basis values', () => {
    const draft = computeExpenseDraft({
      amount: '10.50',
      currency: 'INR',
      method: 'exact',
      participantIds: ['x', 'y'],
      basis: { x: '4.25', y: '6.25' },
    });
    expect(draft.error).toBe('');
    expect(draft.participants).toEqual([
      { userId: 'x', amountMinor: 425n, method: 'exact', basisValue: '425' },
      { userId: 'y', amountMinor: 625n, method: 'exact', basisValue: '625' },
    ]);
  });

  it('splits by shares and validates whole numbers', () => {
    const draft = computeExpenseDraft({
      amount: '30',
      currency: 'INR',
      method: 'shares',
      participantIds: ['x', 'y'],
      basis: { x: '2', y: '1' },
    });
    expect(draft.shares.map((share) => share.amountMinor)).toEqual([2000n, 1000n]);
    expect(draft.allocation.label).toBe('3 shares in total');
    const fractional = computeExpenseDraft({
      amount: '30',
      currency: 'INR',
      method: 'shares',
      participantIds: ['x'],
      basis: { x: '1.5' },
    });
    expect(fractional.error).toBe('Shares must be whole numbers.');
  });

  it('explains a missing or invalid amount', () => {
    const base = { currency: 'INR', method: 'equal' as const, participantIds: ['x'], basis: {} };
    expect(computeExpenseDraft({ ...base, amount: '' }).error).toBe('Enter the total amount.');
    expect(computeExpenseDraft({ ...base, amount: '0' }).error).toMatch(/greater than zero/);
    expect(computeExpenseDraft({ ...base, amount: '1.234' }).error).toMatch(/valid amount/);
    expect(computeExpenseDraft({ ...base, amount: '5', participantIds: [] }).error).toMatch(
      /at least one person/,
    );
  });

  it('restores editable values from saved rows', () => {
    expect(basisInputFromRow('percentage', { basisValue: '3333' }, 'INR')).toBe('33.33');
    expect(basisInputFromRow('exact', { amountMinor: 1250n }, 'INR')).toBe('12.50');
    expect(basisInputFromRow('shares', { basisValue: '2' }, 'INR')).toBe('2');
    expect(basisInputFromRow('equal', { amountMinor: 1n }, 'INR')).toBe('');
  });
});

describe('payer draft', () => {
  it('lets one payer cover the total', () => {
    expect(
      computePayerDraft({ totalMinor: 500n, currency: 'INR', payerIds: ['x'], amounts: {} }),
    ).toMatchObject({ payers: [{ userId: 'x', amountMinor: 500n }], error: '' });
  });

  it('requires several payers to add up to the total', () => {
    const short = computePayerDraft({
      totalMinor: 1000n,
      currency: 'INR',
      payerIds: ['x', 'y'],
      amounts: { x: '4', y: '5' },
    });
    expect(short.error).toBe('Payments must add up to the total.');
    expect(short.allocation).toMatchObject({ tone: 'destructive', remaining: 100n });
    const exact = computePayerDraft({
      totalMinor: 1000n,
      currency: 'INR',
      payerIds: ['x', 'y'],
      amounts: { x: '4', y: '6' },
    });
    expect(exact.payers).toEqual([
      { userId: 'x', amountMinor: 400n },
      { userId: 'y', amountMinor: 600n },
    ]);
  });
});
