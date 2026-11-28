import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useSync } = vi.hoisted(() => ({ useSync: vi.fn() }));

vi.mock('@/lib/offline/BrowserSyncProvider', () => ({ useBrowserSync: useSync }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import SyncSettingsPage from '../../apps/web/app/(finance)/settings/sync/page';

describe('sync settings conflicts', () => {
  beforeEach(() => {
    useSync.mockReturnValue({
      userId: 'user-a',
      syncWindow: 30,
      setSyncWindow: vi.fn(async () => undefined),
      isConnected: true,
      isSyncing: true,
      syncError: null,
      failedEntries: [],
      conflicts: [
        {
          id: 'conflict-1',
          entityType: 'transaction',
          recordId: 'transaction-1',
          localRecord: { memo: 'Local-only memo' },
          cloudRecord: { memo: 'Cloud-only memo' },
        },
      ],
      retryNow: vi.fn(async () => undefined),
      retryEntry: vi.fn(async () => undefined),
      resolveConflict: vi.fn(async () => undefined),
    });
  });

  it('disables both conflict actions during sync and shows each version separately', () => {
    const markup = renderToStaticMarkup(React.createElement(SyncSettingsPage));
    const conflictButtons = [...markup.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
      .map(([button]) => button)
      .filter((button) => button.includes('Keep this device') || button.includes('Keep cloud'));

    expect(conflictButtons).toHaveLength(2);
    expect(conflictButtons.every((button) => /\sdisabled(?:="")?(?:\s|>)/.test(button))).toBe(true);
    expect(markup).toContain('<strong>This device</strong>');
    expect(markup).toContain('<strong>Cloud</strong>');
    expect(markup).toContain('Local-only memo');
    expect(markup).toContain('Cloud-only memo');
  });
});
