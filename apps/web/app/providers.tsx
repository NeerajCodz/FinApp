'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { ThemeProvider, useTheme } from '@finapp/ui/web';
import { BrowserSyncProvider } from '@/lib/offline/BrowserSyncProvider';

function ThemedToaster() {
  const { tokens, isDark } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={isDark ? 'dark' : 'light'}
      closeButton
      toastOptions={{
        style: {
          background: tokens.surfaceRaised,
          border: `1px solid ${tokens.borderSubtle}`,
          borderRadius: 14,
          color: tokens.foreground,
          fontFamily: 'var(--font-space-grotesk, sans-serif)',
        } as CSSProperties,
      }}
    />
  );
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    if (!convexUrl) return null;
    try {
      const url = new URL(convexUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      return new ConvexReactClient(convexUrl);
    } catch {
      return null;
    }
  }, []);

  if (!client) {
    return (
      <ThemeProvider>
        <main className="configuration-error" role="alert">
          <h1>Finapp needs a Convex deployment URL.</h1>
          <p>Set NEXT_PUBLIC_CONVEX_URL to a valid Convex HTTP endpoint in the app environment.</p>
        </main>
      </ThemeProvider>
    );
  }

  return (
    <ConvexAuthProvider client={client}>
      <ThemeProvider>
        <BrowserSyncProvider>{children}</BrowserSyncProvider>
        <ThemedToaster />
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}
