import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const root = path.resolve(__dirname, '../../apps/docs/content');
const sections = readdirSync(root);
const pages = sections.flatMap((section) =>
  readdirSync(path.join(root, section))
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(path.join(root, section, file), 'utf8').replace(/\r\n/g, '\n');
      const match = /^---\n([\s\S]*?)\n---\n/.exec(raw);
      return {
        href: `/${section}/${file.replace(/\.md$/, '')}`,
        meta: match ? (parse(match[1]!) as Record<string, unknown>) : null,
        body: match ? raw.slice(match[0].length) : raw,
      };
    }),
);
const hrefs = new Set(pages.map((page) => page.href));

describe('docs content', () => {
  it('has the expected sections', () => {
    expect(sections.sort()).toEqual(['developers', 'guide', 'mcp', 'self-hosting']);
  });

  it.each(pages.map((page) => [page.href, page]))('%s has valid frontmatter', (_href, page) => {
    expect(page.meta).not.toBeNull();
    expect(typeof page.meta!.title).toBe('string');
    expect(typeof page.meta!.description).toBe('string');
    expect(Number.isInteger(page.meta!.order)).toBe(true);
    expect(page.body).not.toMatch(/^# /m);
  });

  it('only links to pages that exist', () => {
    const broken: string[] = [];
    for (const page of pages) {
      const body = page.body.replace(/```[\s\S]*?```/g, '');
      for (const match of body.matchAll(/\]\((\/[^)\s#]*)(#[^)\s]*)?\)/g)) {
        const target = match[1]!.replace(/\/$/, '');
        if (target === '/api-reference' || hrefs.has(target)) continue;
        broken.push(`${page.href} → ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('closes every callout and tab container', () => {
    for (const page of pages) {
      let open = 0;
      let fence = false;
      for (const line of page.body.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) fence = !fence;
        if (fence) continue;
        if (/^:::(note|tip|warning|tabs)/.test(line.trim())) open += 1;
        else if (line.trim() === ':::') open -= 1;
      }
      expect(open, page.href).toBe(0);
    }
  });
});
