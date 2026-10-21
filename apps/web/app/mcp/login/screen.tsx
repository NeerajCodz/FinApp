'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ThemeProvider } from '@finapp/ui/web';
import { SignInForm } from '@/components/auth/SignInForm';

export function McpLoginScreen() {
  const [nextPath, setNextPath] = useState('/mcp/dashboard');
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (requested?.startsWith('/mcp/') && !requested.startsWith('//')) setNextPath(requested);
  }, []);
  return (
    <ThemeProvider forcedMode="dark">
      <main className="mcp-access-page">
        <a className="mcp-access-skip" href="#mcp-login-title">
          Skip to sign in
        </a>
        <header className="mcp-access-header">
          <Link className="mcp-access-brand" href="/mcp/dashboard">
            finapp<span>MCP</span>
          </Link>
          <Link className="mcp-access-back" href="/mcp/dashboard">
            ← Connection dashboard
          </Link>
        </header>
        <div className="mcp-access-layout mcp-access-layout--login">
          <aside className="mcp-access-story" aria-label="About connecting an MCP client">
            <p className="mcp-access-eyebrow">YOUR ACCOUNT. YOUR PERMISSIONS.</p>
            <h2>
              A connection.
              <br />
              <em>On your terms.</em>
            </h2>
            <p>Connect an AI client to Finapp without handing over your password to that client.</p>
            <ol className="mcp-access-steps">
              <li aria-current="step">
                <span>01</span>
                <div>
                  <strong>Sign in to Finapp</strong>
                  <small>Use your existing account.</small>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Review the request</strong>
                  <small>Check the client and choose its permissions.</small>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Stay in control</strong>
                  <small>Revoke access from your connection dashboard.</small>
                </div>
              </li>
            </ol>
          </aside>
          <div className="mcp-access-bezel">
            <SignInForm
              nextPath={nextPath}
              context={{
                title: 'Sign in to connect.',
                description:
                  'Continue with your Finapp account. Signing in does not approve access to your data.',
              }}
            />
          </div>
        </div>
        <footer className="mcp-access-footer">
          Finapp MCP <span>Only approve clients you trust.</span>
          <Link href="/privacy">Privacy notes ↗</Link>
        </footer>
      </main>
    </ThemeProvider>
  );
}
