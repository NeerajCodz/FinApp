import { describe, expect, it } from 'vitest';
import { resolveConvexUrl } from '../../apps/mobile/lib/convex-url';

describe('Convex deployment configuration', () => {
  it('uses the explicitly configured production URL', () => {
    expect(resolveConvexUrl('https://finapp.convex.cloud', 'android')).toBe(
      'https://finapp.convex.cloud',
    );
  });

  it('preserves an explicitly configured local emulator endpoint', () => {
    expect(resolveConvexUrl('http://10.0.2.2:2608', 'android')).toBe(
      'http://10.0.2.2:2608',
    );
  });

  it('fails closed when configuration is missing or invalid', () => {
    expect(() => resolveConvexUrl(undefined, 'android')).toThrow(
      'EXPO_PUBLIC_CONVEX_URL must be set',
    );
    expect(() => resolveConvexUrl('not a URL', 'android')).toThrow(
      'EXPO_PUBLIC_CONVEX_URL must be a valid HTTP(S) URL',
    );
    expect(() => resolveConvexUrl('javascript:alert(1)', 'android')).toThrow(
      'EXPO_PUBLIC_CONVEX_URL must use HTTP or HTTPS',
    );
  });
});
