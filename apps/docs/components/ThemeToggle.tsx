'use client';

import { useEffect, useState } from 'react';

type Choice = 'system' | 'light' | 'dark';
const NEXT: Record<Choice, Choice> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Choice, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

/** Cycles system → light → dark; the choice is remembered on this device. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>('system');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('finapp-docs-theme');
      if (stored === 'light' || stored === 'dark') setChoice(stored);
    } catch {
      // Storage can be unavailable (private mode); the system theme still applies.
    }
  }, []);
  const apply = (next: Choice) => {
    setChoice(next);
    if (next === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem('finapp-docs-theme');
      else localStorage.setItem('finapp-docs-theme', next);
    } catch {
      // Ignore storage failures.
    }
  };
  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => apply(NEXT[choice])}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[NEXT[choice]]}.`}
      title={`Theme: ${LABEL[choice]}`}
    >
      <span aria-hidden="true">{choice === 'dark' ? '☾' : choice === 'light' ? '☀' : '◐'}</span>
    </button>
  );
}
