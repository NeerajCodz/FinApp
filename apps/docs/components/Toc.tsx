'use client';

import { useEffect, useState } from 'react';

type Entry = { id: string; text: string; depth: 2 | 3 };

/** "On this page" with the heading currently in view highlighted. */
export function Toc({ entries }: { entries: Entry[] }) {
  const [active, setActive] = useState(entries[0]?.id);
  useEffect(() => {
    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!headings.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px' },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [entries]);
  if (!entries.length) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id} data-depth={entry.depth}>
            <a href={`#${entry.id}`} aria-current={active === entry.id ? 'true' : undefined}>
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
