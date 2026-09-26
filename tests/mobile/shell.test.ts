import { describe, expect, it } from 'vitest';
import { getTouchTargetStyle } from '../../packages/ui/src/native/touch-target';
import { quickAddActions } from '../../apps/mobile/lib/navigation/quick-add';

describe('native shell contracts', () => {
  it('enforces a 44 point minimum touch target', () => {
    expect(getTouchTargetStyle({ width: 24 })).toMatchObject({ minWidth: 44, minHeight: 44 });
  });

  it('keeps quick add actions complete and ordered', () => {
    expect(quickAddActions.map((action) => action.label)).toEqual([
      'Expense',
      'Income',
      'Transfer',
      'Split expense',
      'Settlement',
    ]);
  });
});
