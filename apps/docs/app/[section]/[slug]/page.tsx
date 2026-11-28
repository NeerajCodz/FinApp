import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { allDocs, findDoc, neighbours, SECTIONS } from '@/lib/content';
import { renderMarkdown } from '@/lib/markdown';
import { DocEnhancer } from '@/components/DocEnhancer';
import { Toc } from '@/components/Toc';

type Props = { params: Promise<{ section: string; slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return allDocs().map((doc) => ({ section: doc.section, slug: doc.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section, slug } = await params;
  const doc = findDoc(section, slug);
  return doc ? { title: doc.title, description: doc.description } : {};
}

export default async function DocPage({ params }: Props) {
  const { section, slug } = await params;
  const doc = findDoc(section, slug);
  if (!doc) notFound();
  const { html, toc } = await renderMarkdown(doc.body);
  const { previous, next } = neighbours(doc.href);
  const sectionTitle = SECTIONS.find((item) => item.id === doc.section)?.title;
  return (
    <div className="doc-layout">
      <article className="doc">
        <p className="eyebrow">{sectionTitle}</p>
        <h1>{doc.title}</h1>
        {doc.description ? <p className="lede">{doc.description}</p> : null}
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <nav className="pager" aria-label="Pagination">
          {previous ? (
            <Link href={previous.href} className="pager-link">
              <small>Previous</small>
              {previous.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next.href} className="pager-link pager-next">
              <small>Next</small>
              {next.title}
            </Link>
          ) : null}
        </nav>
        <DocEnhancer />
      </article>
      <Toc entries={toc} />
    </div>
  );
}
