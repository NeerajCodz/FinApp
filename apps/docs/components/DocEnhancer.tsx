'use client';

import { useEffect } from 'react';

const TAB_KEY = 'finapp-docs-tab';

function selectTab(label: string) {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((group) => {
    const tabs = group.querySelectorAll<HTMLButtonElement>('[data-tab]');
    if (![...tabs].some((tab) => tab.dataset.tab === label)) return;
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === label)));
    group.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== label;
    });
  });
}

/**
 * Adds behaviour to statically rendered Markdown: copy buttons on code blocks, and code tabs
 * that stay in sync across the page (and remember the reader's language).
 */
export function DocEnhancer() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved) selectTab(saved);
    } catch {
      // Storage unavailable: tabs still work for this page.
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const copy = target.closest<HTMLButtonElement>('[data-copy]');
      if (copy) {
        const code = copy.closest('.code-block')?.querySelector('pre')?.textContent ?? '';
        void navigator.clipboard?.writeText(code).then(() => {
          copy.textContent = 'Copied';
          window.setTimeout(() => (copy.textContent = 'Copy'), 1500);
        });
        return;
      }
      const tab = target.closest<HTMLButtonElement>('[data-tab]');
      if (tab?.dataset.tab) {
        selectTab(tab.dataset.tab);
        try {
          localStorage.setItem(TAB_KEY, tab.dataset.tab);
        } catch {
          // Ignore.
        }
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
