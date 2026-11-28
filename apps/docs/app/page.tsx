import Link from 'next/link';
import { docsIn, SECTIONS } from '@/lib/content';

export default function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">FinApp documentation</p>
        <h1>
          Money, in sync.
          <br />
          <em>Documented.</em>
        </h1>
        <p className="lede">
          How FinApp works on the web and on your phone, how to connect AI apps over MCP, and how to
          build on the public REST API with tokens, OAuth apps and webhooks.
        </p>
        <div className="hero-actions">
          <Link className="button primary" href="/guide/getting-started">
            Get started
          </Link>
          <Link className="button" href="/developers/overview">
            Build with the API
          </Link>
        </div>
      </section>
      <section className="cards" aria-label="Sections">
        {SECTIONS.map((section) => {
          const pages = docsIn(section.id);
          if (!pages.length) return null;
          return (
            <div key={section.id} className="card">
              <h2>
                <Link href={pages[0]!.href}>{section.title}</Link>
              </h2>
              <p>{section.description}</p>
              <ul>
                {pages.slice(0, 6).map((page) => (
                  <li key={page.href}>
                    <Link href={page.href}>{page.title}</Link>
                  </li>
                ))}
                {pages.length > 6 ? <li className="muted">+{pages.length - 6} more</li> : null}
              </ul>
            </div>
          );
        })}
        <div className="card">
          <h2>
            <Link href="/api-reference">API reference</Link>
          </h2>
          <p>Every endpoint, generated from the same registry that serves the API.</p>
          <ul>
            <li>
              <Link href="/api-reference#tag-transactions">Transactions</Link>
            </li>
            <li>
              <Link href="/api-reference#tag-webhooks">Webhooks</Link>
            </li>
            <li>
              <a href="/openapi.json">OpenAPI 3.1 (JSON)</a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
