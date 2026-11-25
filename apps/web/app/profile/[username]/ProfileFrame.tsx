'use client';

import type { ReactNode } from 'react';
import { BrowserLockGate } from '@/components/finance/BrowserLockGate';
import { FinanceShell } from '@/components/finance/FinanceShell';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

/**
 * Public profiles are open to everyone. Signed-in viewers get the full app frame (sidebar, phone
 * bar, app lock); signed-out viewers get the bare page.
 */
export function ProfileFrame({ children }: { children: ReactNode }) {
  const { userId, identityReady } = useBrowserSync();
  if (identityReady && userId)
    return (
      <BrowserLockGate>
        <FinanceShell>{children}</FinanceShell>
      </BrowserLockGate>
    );
  return <main className="public-profile-page">{children}</main>;
}
