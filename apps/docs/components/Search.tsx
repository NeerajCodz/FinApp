'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

type Entry = { title: string; section: string; href: string; text: string };

function score(entry: Entry, terms: string[]) {
  const title = entry.title.toLowerCase();
  const text = entry.text.toLowerCase();
  let total = 0;
  for (const term of terms) {
    if (title.includes(term)) total += title.startsWith(term) ? 12 : 8;
    else if (text.includes(term)) total += 2;
    else return 0;
  }
  return total;
}

function snippet(text: string, term: string) {
  const index = text.toLowerCase().indexOf(term);
  if (index < 0) return text.slice(0, 120);
  const start = Math.max(0, index - 50);
  return `${start ? '…' : ''}${text.slice(start, index + 90)}…`;
}

/** ⌘K / Ctrl+K search over every page, heading and API operation (index built at build time). */
export function Search() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<Entry[] | null>(null);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const show = useCallback(() => {
    setOpen(true);
    if (!index)
      void fetch('/search.json')
        .then((response) => response.json() as Promise<Entry[]>)
        .then(setIndex)
        .catch(() => setIndex([]));
  }, [index]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        show();
      } else if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  useEffect(() => {
    if (open) window.setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results =
    terms.length && index
      ? index
          .map((entry) => ({ entry, score: score(entry, terms) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
          .map((item) => item.entry)
      : [];

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <>
      <button type="button" className="search-button" onClick={show} aria-haspopup="dialog">
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="search-overlay" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Search the docs"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              ref={input}
              value={query}
              placeholder="Search guides, API endpoints, scopes…"
              aria-label="Search"
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setCursor(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setCursor((value) => Math.min(value + 1, results.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setCursor((value) => Math.max(value - 1, 0));
                } else if (event.key === 'Enter' && results[cursor]) go(results[cursor].href);
              }}
            />
            <ul className="search-results" role="listbox">
              {index === null && query ? <li className="search-empty">Loading…</li> : null}
              {index && terms.length && !results.length ? (
                <li className="search-empty">No results for “{query}”.</li>
              ) : null}
              {results.map((entry, position) => (
                <li key={entry.href} role="option" aria-selected={position === cursor}>
                  <button type="button" onClick={() => go(entry.href)}>
                    <small>{entry.section}</small>
                    <strong>{entry.title}</strong>
                    <span>{snippet(entry.text, terms[0] ?? '')}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
