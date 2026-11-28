import { notFound, redirect } from 'next/navigation';
import { docsIn, SECTIONS } from '@/lib/content';

type Props = { params: Promise<{ section: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SECTIONS.filter((section) => docsIn(section.id).length).map((section) => ({
    section: section.id,
  }));
}

/** A section's index opens its first page. */
export default async function SectionPage({ params }: Props) {
  const { section } = await params;
  const first = docsIn(section)[0];
  if (!first) notFound();
  redirect(first.href);
}
