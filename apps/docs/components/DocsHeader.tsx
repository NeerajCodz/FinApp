import Link from 'next/link';
import { Search } from './Search';
import { ThemeToggle } from './ThemeToggle';
import { MenuButton } from './Sidebar';

export function DocsHeader() {
  return (
    <header className="topbar">
      <MenuButton />
      <Link className="brand" href="/">
        finapp<span>docs</span>
      </Link>
      <nav className="topnav" aria-label="Sections">
        <Link href="/guide/getting-started">Guide</Link>
        <Link href="/mcp/overview">MCP</Link>
        <Link href="/developers/overview">API</Link>
        <Link href="/api-reference">Reference</Link>
      </nav>
      <div className="topbar-actions">
        <Search />
        <ThemeToggle />
      </div>
    </header>
  );
}
