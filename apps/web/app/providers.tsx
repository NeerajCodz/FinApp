'use client';

import { useMemo, type ReactNode } from 'react';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { ThemeProvider } from '@finapp/ui/web';
import { BrowserSyncProvider } from '@/lib/offline/BrowserSyncProvider';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);

  if (!client) {
    return (
      <ThemeProvider>
        <main className="configuration-error" role="alert">
          <h1>Finapp needs a Convex deployment URL.</h1>
          <p>Set NEXT_PUBLIC_CONVEX_URL to your Convex HTTP endpoint and restart the web app.</p>
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ConvexAuthProvider client={client}>
      <ThemeProvider>
        <BrowserSyncProvider>{children}</BrowserSyncProvider>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}
