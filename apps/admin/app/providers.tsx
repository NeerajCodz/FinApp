'use client';

import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient } from 'convex/react';
import { ThemeProvider, useTheme } from '@finapp/ui/web';

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();

function ThemedToaster() {
  const { tokens, isDark } = useTheme();
  return (
    <Toaster
      position="top-right"
      theme={isDark ? 'dark' : 'light'}
      closeButton
      toastOptions={{
        style: {
          background: tokens.popover,
          border: `1px solid ${tokens.border}`,
          borderRadius: 14,
          color: tokens.foreground,
        } as CSSProperties,
      }}
    />
  );
}

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

  if (!client)
    return (
      <ThemeProvider>
        <main className="admin-center" role="alert">
          <h1>The admin console needs a Convex deployment URL.</h1>
          <p>Set NEXT_PUBLIC_CONVEX_URL to the same deployment the Finapp web app uses.</p>
        </main>
      </ThemeProvider>
    );

  return (
    <ConvexAuthProvider client={client} storageNamespace="finapp-admin">
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}
