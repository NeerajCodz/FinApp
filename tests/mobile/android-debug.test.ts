import { describe, expect, it } from 'vitest';
import { resolveConvexUrl } from '../../app/mobile/lib/convex-url';

describe('Android debug Convex connectivity', () => {
  it('maps Android emulator localhost to the host machine', () => {
    expect(resolveConvexUrl(undefined, 'android')).toBe('http://10.0.2.2:3212');
  });

  it('preserves configured deployment URLs', () => {
    expect(resolveConvexUrl('https://finapp.convex.cloud', 'android')).toBe(
      'https://finapp.convex.cloud',
    );
  });
});
