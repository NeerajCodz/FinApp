import { describe, expect, it } from 'vitest';
import { accentPalette, createTokens } from '../../app/mobile/lib/theme/tokens';

describe('customizable accent palette', () => {
  it('limits accents to blue, red, and white', () => {
    expect(Object.keys(accentPalette)).toEqual(['blue', 'red', 'white']);
  });

  it('applies the selected accent without changing monochrome surfaces', () => {
    const tokens = createTokens('dark', 'red');
    expect(tokens.primary).toBe(accentPalette.red);
    expect(tokens.background).toBe('#000000');
    expect(tokens.foreground).toBe('#FFFFFF');
    expect(tokens.card).toBe('#000000');
    expect(tokens.surfaceRaised).toBe('#FFFFFF0D');
    expect(tokens.borderSubtle).toBe('#FFFFFF1F');
  });
});
