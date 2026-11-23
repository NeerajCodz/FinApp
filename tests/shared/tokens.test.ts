import { describe, expect, it } from 'vitest';
import { createTokens, typeScale, withAlpha } from '../../packages/ui/src/tokens';

describe('design tokens', () => {
  it('applies alpha to opaque and translucent hex colours', () => {
    expect(withAlpha('#ff5c5c', 0.1)).toBe('#FF5C5C1A');
    expect(withAlpha('#FFFFFF80', 0.5)).toBe('#FFFFFF40');
    expect(withAlpha('rgb(0,0,0)', 0.5)).toBe('rgb(0,0,0)');
  });

  it('keeps every theme colour a hex value so tints can be derived', () => {
    for (const mode of ['light', 'dark'] as const) {
      const tokens = createTokens(mode, 'blue');
      for (const [name, value] of Object.entries(tokens)) {
        if (name === 'chart') continue;
        expect(value, name).toMatch(/^#[\da-f]{6}([\da-f]{2})?$/i);
      }
    }
  });

  it('defines a complete type scale', () => {
    for (const type of Object.values(typeScale)) {
      expect(type.lineHeight).toBeGreaterThanOrEqual(type.fontSize);
    }
  });
});
