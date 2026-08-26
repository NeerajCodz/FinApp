import { describe, expect, it } from 'vitest';
import {
  accentPalette,
  createTokens,
  neutralOpacity,
} from '../../app/mobile/lib/theme/tokens';

describe('Finapp visual identity', () => {
  it('exposes Volt as the only application accent', () => {
    expect(Object.keys(accentPalette)).toEqual(['volt']);
    expect(accentPalette.volt).toBe('#B7FF4A');
  });

  it('builds dark surfaces from white opacity over pure black', () => {
    const tokens = createTokens('dark');
    expect(tokens.background).toBe('#000000');
    expect(tokens.foreground).toBe('#FFFFFF');
    expect(tokens.primary).toBe(accentPalette.volt);
    expect(tokens.card).toBe(neutralOpacity.white4);
    expect(tokens.surfaceRaised).toBe(neutralOpacity.white6);
    expect(tokens.border).toBe(neutralOpacity.white12);
    expect(tokens.borderSubtle).toBe(neutralOpacity.white8);
  });
});
