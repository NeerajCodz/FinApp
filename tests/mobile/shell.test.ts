import { describe, expect, it } from 'vitest';
import { lightTokens, darkTokens } from '../../app/mobile/lib/theme/tokens';
import { getTouchTargetStyle } from '../../app/mobile/components/ui/touch-target';
import { quickAddActions } from '../../app/mobile/lib/navigation/quick-add';

describe('native shell contracts', () => {
  it('provides pure monochrome foundations with quiet financial amounts', () => {
    expect(lightTokens.background).toBe('#FFFFFF');
    expect(lightTokens.foreground).toBe('#000000');
    expect(darkTokens.background).toBe('#000000');
    expect(darkTokens.foreground).toBe('#FFFFFF');
    expect(darkTokens.income).toBe(darkTokens.foreground);
    expect(darkTokens.expense).toBe(darkTokens.foreground);
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
