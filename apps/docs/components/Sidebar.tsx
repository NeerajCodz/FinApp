'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

type Nav = { id: string; title: string; pages: { title: string; href: string }[] }[];

const OPEN_CLASS = 'nav-open';

export function MenuButton() {
  return (
    <button
      type="button"
      className="icon-button menu-button"
      aria-label="Open navigation"
      onClick={() => document.body.classList.toggle(OPEN_CLASS)}
    >
      <span aria-hidden="true">☰</span>
    </button>
  );
}

export function Sidebar({ nav }: { nav: Nav }) {
  const pathname = usePathname();
  useEffect(() => {
    document.body.classList.remove(OPEN_CLASS);
  }, [pathname]);
  return (
    <aside className="sidebar" aria-label="Documentation">
      <nav>
        {nav.map((section) => (
          <div key={section.id} className="sidebar-section">
            <p className="sidebar-title">{section.title}</p>
            <ul>
              {section.pages.map((page) => (
                <li key={page.href}>
                  <Link href={page.href} aria-current={pathname === page.href ? 'page' : undefined}>
                    {page.title}
                  </Link>
                </li>
              ))}
              {section.id === 'developers' ? (
                <li>
                  <Link
                    href="/api-reference"
                    aria-current={pathname === '/api-reference' ? 'page' : undefined}
                  >
                    API reference
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
