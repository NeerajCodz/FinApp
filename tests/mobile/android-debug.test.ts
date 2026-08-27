import { describe, expect, it } from 'vitest';
import { resolveConvexUrl } from '../../app/mobile/lib/convex-url';

describe('production Convex connectivity', () => {
  it('falls back to the configured production cloud deployment', () => {
    expect(resolveConvexUrl(undefined, 'android')).toBe('https://secret-kiwi-640.convex.cloud');
  });

  it('preserves configured deployment URLs', () => {
    expect(resolveConvexUrl('https://finapp.convex.cloud', 'android')).toBe(
      'https://finapp.convex.cloud',
    );
  });
});
