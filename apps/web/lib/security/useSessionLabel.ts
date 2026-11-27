'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

// Slightly longer than touchSession's five-minute throttle so each tick refreshes activity.
const SESSION_HEARTBEAT_MS = 6 * 60_000;
/** "Chrome on Windows", "Safari on iPhone"… from the user agent (best effort). */
export function browserLabel(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  const os = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent)
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(userAgent)
            ? 'Mac'
            : /CrOS/.test(userAgent)
              ? 'ChromeOS'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : 'this device';
  return `${browser} on ${os}`;
}

/** Labels this browser's session and keeps its last-active time fresh while the SPA is open. */
export function useSessionLabel(signedIn: boolean) {
  const touch = useMutation(api.security.touchSession);
  React.useEffect(() => {
    if (!signedIn) return;
    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      void touch({ platform: 'web', label: browserLabel(navigator.userAgent) }).catch(
        () => undefined,
      );
    };
    heartbeat();
    const interval = window.setInterval(heartbeat, SESSION_HEARTBEAT_MS);
    document.addEventListener('visibilitychange', heartbeat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', heartbeat);
    };
  }, [signedIn, touch]);
}
