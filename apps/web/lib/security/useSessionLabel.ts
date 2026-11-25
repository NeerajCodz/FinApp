'use client';

import * as React from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';

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

/** Labels this browser's session for Settings → Security → Devices (once per page load). */
export function useSessionLabel(signedIn: boolean) {
  const touch = useMutation(api.security.touchSession);
  React.useEffect(() => {
    if (!signedIn) return;
    touch({ platform: 'web', label: browserLabel(navigator.userAgent) }).catch(() => undefined);
  }, [signedIn, touch]);
}
