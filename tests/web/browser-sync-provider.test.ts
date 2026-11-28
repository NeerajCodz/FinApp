import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { signOutAndClearLocalData } from '../../apps/web/lib/offline/signOut';

const { useConvex, useConvexAuth, useConvexConnectionState, useQuery } = vi.hoisted(() => ({
  useConvex: vi.fn(),
  useConvexAuth: vi.fn(),
  useConvexConnectionState: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useConvex,
  useConvexAuth,
  useConvexConnectionState,
  useQuery,
}));

import {
  BrowserSyncProvider,
  useBrowserSync,
} from '../../apps/web/lib/offline/BrowserSyncProvider';

describe('BrowserSyncProvider sign-out coordination', () => {
  it('waits for an in-flight transaction range fetch before clearing local data', async () => {
    const { promise: response, resolve } = Promise.withResolvers<{
      page: never[];
      related: {
        accounts: never[];
        categories: never[];
        groups: never[];
        payers: never[];
        participants: never[];
        tags: never[];
        receipts: never[];
      };
      isDone: true;
      continueCursor: null;
    }>();
    const query = vi.fn(() => response);
    useConvex.mockReturnValue({ query });
    useConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    useConvexConnectionState.mockReturnValue({ isWebSocketConnected: true });
    useQuery.mockReset();
    useQuery.mockReturnValueOnce({ _id: 'user-a' }).mockReturnValueOnce(undefined);

    let sync:
      | {
          stopSyncBeforeSignOut: () => Promise<void>;
          fetchTransactionRange: (startAt: number, endAt: number) => Promise<void>;
        }
      | undefined;
    function CaptureSync() {
      sync = useBrowserSync();
      return null;
    }

    const originalUseState = React.useState;
    let stateCalls = 0;
    const useStateSpy = vi.spyOn(React, 'useState').mockImplementation(((initial: unknown) => {
      stateCalls += 1;
      return originalUseState(stateCalls === 3 ? true : (initial as never));
    }) as typeof React.useState);
    try {
      renderToStaticMarkup(
        React.createElement(BrowserSyncProvider, null, React.createElement(CaptureSync)),
      );
      expect(sync).toBeDefined();

      const rangeFetch = sync!.fetchTransactionRange(10, 20);
      await Promise.resolve();
      await Promise.resolve();
      expect(query).toHaveBeenCalledOnce();

      const events: string[] = [];
      const operation = signOutAndClearLocalData(
        'user-a',
        async () => {
          events.push('stop');
          await sync!.stopSyncBeforeSignOut();
        },
        async () => {
          events.push('clear');
        },
        async () => {
          events.push('signOut');
        },
      );

      expect(events).toEqual(['stop']);
      resolve({
        page: [],
        related: {
          accounts: [],
          categories: [],
          groups: [],
          payers: [],
          participants: [],
          tags: [],
          receipts: [],
        },
        isDone: true,
        continueCursor: null,
      });
      await Promise.all([rangeFetch, operation]);
      expect(events).toEqual(['stop', 'clear', 'signOut']);
    } finally {
      useStateSpy.mockRestore();
    }
  });
});
