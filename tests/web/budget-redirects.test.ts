import { describe, expect, it } from 'vitest';
import nextConfig from '../../apps/web/next.config';

describe('budgets folded into categories', () => {
  it('redirects every old budget page to Categories', async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    const target = (path: string) =>
      redirects.find((rule) => {
        const pattern = new RegExp(
          `^${rule.source.replace(/:path\*/g, '.*').replace(/:[a-z]+/gi, '[^/]+')}$`,
        );
        return pattern.test(path);
      })?.destination;
    for (const path of ['/budgets', '/budgets/new', '/budget/abc', '/budget/abc/edit'])
      expect(target(path)).toBe('/categories');
    expect(target('/categories')).toBeUndefined();
  });
});
