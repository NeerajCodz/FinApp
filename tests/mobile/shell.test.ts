import { describe, expect, it } from 'vitest';
import { lightTokens, darkTokens } from '../../app/mobile/lib/theme/tokens';
import { getTouchTargetStyle } from '../../app/mobile/components/ui/touch-target';
import { quickAddActions } from '../../app/mobile/lib/navigation/quick-add';

describe('native shell contracts', () => {
  it('provides semantic light and dark product tokens', () => {
    expect(lightTokens.primary).toBe('#315CFF');
    expect(darkTokens.background).toBe('#111827');
    expect(lightTokens.income).not.toBe(lightTokens.expense);
  });

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
