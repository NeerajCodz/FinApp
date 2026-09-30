'use client';

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import { ConvexReactClient, useQuery } from 'convex/react';
import { usePathname } from 'next/navigation';
import { api } from '@convex/_generated/api';
import { ThemeProvider, useTheme } from '@finapp/ui/web';
import type { AccentValue } from '@finapp/ui/tokens';
import { BrowserSyncProvider, useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

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

const isAccent = (value: unknown): value is AccentValue =>
  value === 'volt' ||
  value === 'white' ||
  value === 'blue' ||
  (typeof value === 'string' && /^#[\da-f]{6}$/i.test(value));

function AccentSync({ children }: { children: ReactNode }) {
  const { userId } = useBrowserSync();
  const profile = useQuery(api.users.queries.current);
  const { setAccent } = useTheme();
  const activeUser = useRef<string | null>(null);

  useEffect(() => {
    activeUser.current = userId;
    if (!userId) {
      setAccent('volt');
      return;
    }
    let cached: string | null = null;
    try {
      cached = window.localStorage.getItem(`finapp.appearance.accent.v1:${userId}`);
    } catch {
      // Keep the in-memory theme when browser storage is unavailable.
    }
    setAccent(isAccent(cached) ? cached : 'volt');
  }, [userId, setAccent]);

  useEffect(() => {
    const profileId = String(profile?._id ?? '');
    if (
      !userId ||
      activeUser.current !== userId ||
      profileId !== userId ||
      !isAccent(profile?.accent)
    )
      return;
    setAccent(profile.accent);
    try {
      window.localStorage.setItem(`finapp.appearance.accent.v1:${userId}`, profile.accent);
    } catch {
      // Keep the in-memory theme when browser storage is unavailable.
    }
  }, [profile, userId, setAccent]);

  return children;
}

function ApplicationProviders({ children }: { children: ReactNode }) {
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
        <BrowserSyncProvider>
          <AccentSync>{children}</AccentSync>
          <ThemedToaster />
        </BrowserSyncProvider>
      </ThemeProvider>
    </ConvexAuthProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return <ThemeProvider forcedMode="dark">{children}</ThemeProvider>;
  return <ApplicationProviders>{children}</ApplicationProviders>;
}
