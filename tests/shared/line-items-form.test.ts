import { describe, expect, it } from 'vitest';
import {
  computeItemizedSplit,
  computeLineItems,
  itemizedBreakdown,
  lineItemDrafts,
  moveLineItem,
  personalItemsState,
  readLineItems,
  startItemizing,
  toggleItemParticipant,
  type LineItemDraft,
} from '../../packages/ui/src/finance/lineItems';
import { computeExpenseDraft } from '../../packages/ui/src/finance/groupExpenseDraft';
import { planExpenseUpdate } from '../../packages/ui/src/finance/groupExpenseOutbox';
import { describeSyncError } from '../../packages/ui/src/finance/syncErrors';

const row = (
  id: string,
  title: string,
  amount: string,
  participantIds: string[] | null = null,
  quantity = '',
): LineItemDraft => ({ id, title, amount, quantity, participantIds });

const bill = [
  row('a', 'Starters', '200'),
  row('b', 'Juice', '300', null, '2'),
  row('c', 'Meal', '500'),
];

describe('line item form logic', () => {
  it('parses rows into items with a live total', () => {
    const parsed = computeLineItems(bill, 'INR');
    expect(parsed.error).toBe('');
    expect(parsed.totalMinor).toBe(100000n);
    expect(parsed.items[1]).toEqual({ id: 'b', title: 'Juice', amountMinor: 30000n, quantity: 2 });
  });

  it('explains incomplete rows while keeping a partial total', () => {
    const parsed = computeLineItems([row('a', 'Starters', '200'), row('b', '', '50')], 'INR');
    expect(parsed.totalMinor).toBe(25000n);
    expect(parsed.items).toEqual([]);
    expect(parsed.rowErrors).toEqual(['', 'Give item 2 a name.']);
    expect(computeLineItems([row('a', 'Tip', 'abc')], 'INR').error).toContain('valid amount');
    expect(computeLineItems([row('a', 'Tip', '5', null, '1.5')], 'INR').error).toContain(
      'whole number',
    );
    expect(computeLineItems([], 'INR').error).toBe('Add at least one item.');
  });

  it('reorders rows and toggles people with an "everyone" default', () => {
    expect(moveLineItem(bill, 'c', -1).map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(moveLineItem(bill, 'a', -1).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    const people = ['u1', 'u2', 'u3'];
    const off = toggleItemParticipant(row('x', 'X', '1'), 'u2', people);
    expect(off.participantIds).toEqual(['u1', 'u3']);
    expect(toggleItemParticipant(off, 'u2', people).participantIds).toBeNull();
  });

  it('previews an itemized split and saves only valid assignments', () => {
    const rows = [
      row('a', 'Starters', '200'),
      row('b', 'Juice', '300', ['u2', 'u3']),
      row('c', 'Meal', '500', ['u1']),
    ];
    const split = computeItemizedSplit(rows, ['u1', 'u2', 'u3'], 'INR');
    expect(split.error).toBe('');
    expect(split.participants.map((item) => item.amountMinor)).toEqual([56667n, 21667n, 21666n]);
    expect(split.participants.every((item) => item.method === 'itemized')).toBe(true);
    expect(split.items[0]).not.toHaveProperty('participantIds');
    expect(split.items[2]?.participantIds).toEqual(['u1']);
  });

  it('asks who shared an item nobody is ticked on', () => {
    const split = computeItemizedSplit(
      [row('a', 'Starters', '200'), row('b', 'Juice', '300', [])],
      ['u1', 'u2'],
      'INR',
    );
    expect(split.error).toBe('Choose who shared “Juice”.');
    expect(split.participants).toEqual([]);
    // The preview still covers the items that are complete.
    expect(split.preview).toEqual([
      { userId: 'u1', amountMinor: 10000n },
      { userId: 'u2', amountMinor: 10000n },
    ]);
    // People removed from the expense are dropped from item selections.
    expect(computeItemizedSplit([row('a', 'Starters', '200', ['gone'])], ['u1'], 'INR').error).toBe(
      'Choose who shared “Starters”.',
    );
  });

  it('feeds the composer draft for itemized and breakdown splits', () => {
    const itemized = computeExpenseDraft({
      amount: '',
      currency: 'INR',
      method: 'itemized',
      participantIds: ['u1', 'u2'],
      basis: {},
      items: [row('a', 'Pizza', '9', ['u2']), row('b', 'Water', '3')],
    });
    expect(itemized.error).toBe('');
    expect(itemized.totalMinor).toBe(1200n);
    expect(itemized.participants).toEqual([
      { userId: 'u1', amountMinor: 150n, method: 'itemized' },
      { userId: 'u2', amountMinor: 1050n, method: 'itemized' },
    ]);
    expect(itemized.items).toHaveLength(2);
    const breakdown = computeExpenseDraft({
      amount: '12',
      currency: 'INR',
      method: 'equal',
      participantIds: ['u1', 'u2'],
      basis: {},
      items: [row('a', 'Pizza', '9', ['u2']), row('b', 'Water', '3')],
    });
    expect(breakdown.participants.map((item) => item.amountMinor)).toEqual([600n, 600n]);
    expect(breakdown.items[0]).not.toHaveProperty('participantIds');
    const plain = computeExpenseDraft({
      amount: '12',
      currency: 'INR',
      method: 'equal',
      participantIds: ['u1'],
      basis: {},
    });
    expect(plain.items).toEqual([]);
  });

  it('drives the personal transaction amount while itemized', () => {
    expect(personalItemsState(null, 'INR', '42')).toMatchObject({ active: false, amount: '42' });
    const state = personalItemsState(bill, 'INR', '1');
    expect(state).toMatchObject({ active: true, amount: '1000.00', error: '' });
    expect(state.items).toHaveLength(3);
    expect(startItemizing('250', ' Lunch ')).toMatchObject([{ title: 'Lunch', amount: '250' }]);
  });

  it('reads stored items back for display and editing', () => {
    const stored = [
      { id: 'a', title: 'Starters', amountMinor: 20000n, participantIds: ['u1'] },
      { id: 'b', title: 'Juice', amountMinor: '30000', quantity: 2 },
      { title: 'broken' },
    ];
    expect(readLineItems(stored)).toHaveLength(2);
    expect(lineItemDrafts(stored, 'INR')).toEqual([
      { id: 'a', title: 'Starters', amount: '200.00', quantity: '', participantIds: ['u1'] },
      { id: 'b', title: 'Juice', amount: '300.00', quantity: '2', participantIds: null },
    ]);
    const breakdown = itemizedBreakdown(readLineItems(stored), [
      { userId: 'u1', amountMinor: 35000n },
      { userId: 'u2', amountMinor: 15000n },
    ]);
    expect(breakdown.items.map((item) => item.sharers)).toEqual([['u1'], ['u1', 'u2']]);
  });

  it('queues items with a group expense edit', () => {
    const plan = planExpenseUpdate({
      transaction: { _id: 't1', accountId: 'acc', version: 2, items: [{ id: 'old' }] },
      payerRows: [{ userId: 'u1', amountMinor: 1200n }],
      participantRows: [{ userId: 'u1', amountMinor: 1200n, method: 'equal' }],
      title: 'Dinner',
      amountMinor: 1200n,
      currency: 'INR',
      occurredAt: 1,
      participants: [
        { userId: 'u1', amountMinor: 150n, method: 'itemized' },
        { userId: 'u2', amountMinor: 1050n, method: 'itemized' },
      ],
      payers: [{ userId: 'u1', amountMinor: 1200n }],
      items: [
        { id: 'a', title: 'Pizza', amountMinor: 900n, participantIds: ['u2'] },
        { id: 'b', title: 'Water', amountMinor: 300n },
      ],
    });
    expect(plan.payload.items).toHaveLength(2);
    expect(plan.record.items).toEqual(plan.payload.items);
    const cleared = planExpenseUpdate({
      transaction: { _id: 't1', accountId: 'acc', items: [{ id: 'old' }] },
      payerRows: [],
      participantRows: [],
      title: 'Dinner',
      amountMinor: 1200n,
      currency: 'INR',
      occurredAt: 1,
      participants: [],
      payers: [],
      items: [],
    });
    expect(cleared.record).not.toHaveProperty('items');
    expect(cleared.payload.items).toEqual([]);
  });

  it('describes item errors from the server', () => {
    expect(describeSyncError(new Error('Uncaught Error: ITEMS_TOTAL_MISMATCH'), 'x')).toBe(
      'The line items no longer add up to the total.',
    );
  });
});
