import { describe, expect, it } from 'vitest';
import {
  illustrationCssPalette,
  illustrationPalette,
  illustrationScenes,
} from '../../packages/ui/src/illustrations/scenes';
import { createTokens, withAlpha } from '../../packages/ui/src/tokens';

const roles = new Set(Object.keys(illustrationCssPalette));

describe('theme-driven illustrations', () => {
  it('only reference theme colour roles, never literal colours', () => {
    for (const [scene, shapes] of Object.entries(illustrationScenes)) {
      for (const shape of shapes as { fill?: string; stroke?: string }[]) {
        for (const paint of [shape.fill, shape.stroke])
          if (paint !== undefined) expect(roles.has(paint), `${scene}: ${paint}`).toBe(true);
      }
    }
  });

  it('resolves every role from tokens in light and dark themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const palette = illustrationPalette(createTokens(mode, 'blue'), withAlpha);
      for (const [role, color] of Object.entries(palette))
        if (role !== 'none') expect(color, role).toMatch(/^#[\da-f]{6}([\da-f]{2})?$/i);
      expect(palette.accent).toBe(createTokens(mode, 'blue').primary);
    }
  });

  it('covers every empty-state kind and the money-flow scenes', () => {
    for (const scene of [
      'account',
      'group',
      'message',
      'allSettled',
      'youOwe',
      'owedToYou',
      'splitBill',
      'settleUp',
      'memberJoined',
      'notifications',
      'offline',
      'error',
      'success',
      'history',
      'welcome',
    ])
      expect(illustrationScenes).toHaveProperty(scene);
  });
});
