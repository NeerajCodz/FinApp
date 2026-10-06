import { describe, expect, it } from 'vitest';
import { accentPalette, createTokens, neutralOpacity } from '@finapp/ui/tokens';
import { DEFAULT_GROUP_COLOR } from '../../packages/ui/src/finance/groupColor';

describe('Finapp visual identity', () => {
  it('exposes the supported named application accents', () => {
    expect(accentPalette).toEqual({
      volt: '#B7FF4A',
      white: '#FFFFFF',
      blue: '#5B8CFF',
    });
    expect(createTokens('dark', 'blue').primary).toBe(accentPalette.blue);
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

  it('keeps the group default color separate from the account accent', () => {
    expect(DEFAULT_GROUP_COLOR).toBe('#78E6A0');
    expect(DEFAULT_GROUP_COLOR).not.toBe(createTokens('dark', 'volt').primary);
    expect(DEFAULT_GROUP_COLOR).not.toBe(createTokens('dark', '#C084FC').primary);
  });
});
