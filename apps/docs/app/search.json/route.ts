import { allDocs, SECTIONS } from '@/lib/content';
import { plainText, slugify } from '@/lib/markdown';
import { apiReference } from '@/lib/api';

export const dynamic = 'force-static';

/** The search index: every page, its headings and every API operation. */
export function GET() {
  const entries: { title: string; section: string; href: string; text: string }[] = [];
  for (const doc of allDocs()) {
    const section = SECTIONS.find((item) => item.id === doc.section)?.title ?? doc.section;
    entries.push({
      title: doc.title,
      section,
      href: doc.href,
      text: `${doc.description} ${plainText(doc.body)}`.slice(0, 4000),
    });
    for (const match of doc.body.matchAll(/^(##|###)\s+(.+)$/gm)) {
      const heading = match[2]!.replace(/[`*_]/g, '').trim();
      entries.push({
        title: `${doc.title} › ${heading}`,
        section,
        href: `${doc.href}#${slugify(heading)}`,
        text: heading,
      });
    }
  }
  for (const tag of apiReference())
    for (const endpoint of tag.endpoints)
      entries.push({
        title: `${endpoint.method} ${endpoint.path}`,
        section: 'API reference',
        href: `/api-reference#${endpoint.id}`,
        text: `${endpoint.summary}. ${endpoint.description ?? ''} ${endpoint.scope ?? ''}`,
      });
  return Response.json(entries);
}
