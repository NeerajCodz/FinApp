'use client';

import React from 'react';
import { Toast } from '@finapp/ui/web';

const key = 'finapp.flash.v1';
type Flash = { message: string; tone: 'success' | 'error' | 'info' };

/** Queues a one-time message for the next screen (survives a client-side navigation). */
export function setFlash(message: string, tone: Flash['tone'] = 'success') {
  try {
    sessionStorage.setItem(key, JSON.stringify({ message, tone } satisfies Flash));
  } catch {
    // Storage can be unavailable (private mode); the message is simply skipped.
  }
}

/** Shows a queued message (or an immediate one) as a polite toast for a few seconds. */
export function FlashToast({ message }: { message?: string | null }) {
  const [flash, setFlashState] = React.useState<string | null>(null);
  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (!stored) return;
      sessionStorage.removeItem(key);
      const parsed = JSON.parse(stored) as Partial<Flash>;
      if (typeof parsed.message === 'string') setFlashState(parsed.message);
    } catch {
      // Ignore unreadable storage.
    }
  }, []);
  React.useEffect(() => {
    if (message) setFlashState(message);
  }, [message]);
  React.useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlashState(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);
  return flash ? <Toast message={flash} /> : null;
}
