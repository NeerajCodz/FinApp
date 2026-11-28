/**
 * Docs content: Markdown files under ./content/<section>/<slug>.md with YAML frontmatter.
 * Read at build time (all pages are statically generated).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export const SECTIONS = [
  {
    id: 'guide',
    title: 'Product guide',
    description: 'Using FinApp on the web and on your phone.',
  },
  { id: 'mcp', title: 'MCP', description: 'Connect ChatGPT, Claude and other AI apps.' },
  {
    id: 'developers',
    title: 'Developers',
    description: 'The REST API, tokens, OAuth apps and webhooks.',
  },
  {
    id: 'self-hosting',
    title: 'Self-hosting',
    description: 'Architecture, running locally and deploying.',
  },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];

export type DocMeta = {
  section: SectionId;
  slug: string;
  title: string;
  description: string;
  order: number;
  href: string;
};
export type Doc = DocMeta & { body: string };

const CONTENT_DIR = path.join(process.cwd(), 'content');

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const text = raw.replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) return { data: {}, body: text };
  return {
    data: (parseYaml(match[1]!) as Record<string, unknown>) ?? {},
    body: text.slice(match[0].length),
  };
}

let cache: Doc[] | null = null;

export function allDocs(): Doc[] {
  if (cache) return cache;
  const docs: Doc[] = [];
  for (const section of SECTIONS) {
    const dir = path.join(CONTENT_DIR, section.id);
    let files: string[];
    try {
      files = readdirSync(dir).filter((file) => file.endsWith('.md'));
    } catch {
      continue;
    }
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      const { data, body } = parseFrontmatter(readFileSync(path.join(dir, file), 'utf8'));
      docs.push({
        section: section.id,
        slug,
        title: typeof data.title === 'string' ? data.title : slug,
        description: typeof data.description === 'string' ? data.description : '',
        order: typeof data.order === 'number' ? data.order : 999,
        href: `/${section.id}/${slug}`,
        body,
      });
    }
  }
  docs.sort((a, b) =>
    a.section === b.section
      ? a.order - b.order || a.title.localeCompare(b.title)
      : SECTIONS.findIndex((s) => s.id === a.section) -
        SECTIONS.findIndex((s) => s.id === b.section),
  );
  cache = docs;
  return docs;
}

export function docsIn(section: string): DocMeta[] {
  return allDocs()
    .filter((doc) => doc.section === section)
    .map(({ body: _body, ...meta }) => meta);
}

export function findDoc(section: string, slug: string): Doc | undefined {
  return allDocs().find((doc) => doc.section === section && doc.slug === slug);
}

/** Sidebar navigation: every section with its pages, plus the API reference. */
export function navigation() {
  return SECTIONS.map((section) => ({
    ...section,
    pages: docsIn(section.id).map(({ title, href }) => ({ title, href })),
  }));
}

/** Previous/next links across the whole docs order. */
export function neighbours(href: string) {
  const docs = allDocs();
  const index = docs.findIndex((doc) => doc.href === href);
  const pick = (doc: Doc | undefined) => (doc ? { title: doc.title, href: doc.href } : null);
  return { previous: pick(docs[index - 1]), next: pick(docs[index + 1]) };
}
