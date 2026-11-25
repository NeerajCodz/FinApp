'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { pendingGroupInvitationPath } from '@/lib/authRoutes';

/**
 * Signed-in visitors don't belong on the landing or sign-in pages: send them to the dashboard (or
 * to the MCP authorization or group invitation they were in the middle of).
 */
export function SignedInRedirect() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  React.useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    const next = new URLSearchParams(window.location.search).get('next');
    const safeNext = next?.startsWith('/mcp/') && !next.startsWith('//') ? next : null;
    router.replace(safeNext ?? pendingGroupInvitationPath() ?? '/dashboard');
  }, [isAuthenticated, isLoading, router]);
  return null;
}
