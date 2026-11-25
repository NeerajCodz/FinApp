'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

/**
 * The landing page renders without the Convex providers (fast, static). If this browser holds a
 * Convex Auth session, go to the dashboard; it validates the session and sends an expired one to
 * sign-in (which clears it), so this can't loop.
 */
export function LandingSessionRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    try {
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index);
        if (key?.startsWith('__convexAuthRefreshToken') && window.localStorage.getItem(key)) {
          router.replace('/dashboard');
          return;
        }
      }
    } catch {
      // Storage blocked: stay on the landing page.
    }
  }, [router]);
  return null;
}
