'use client';

import { useState } from 'react';
import { useConvexAuth } from '@convex-dev/auth/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { McpDashboard } from '@finapp/ui/mcp';

export function McpDashboardClient({ endpoint }: { endpoint: string }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const profile = useQuery(api.mcpOAuth.currentUser, isAuthenticated ? {} : 'skip');
  const grants = useQuery(api.mcpOAuth.listGrants, isAuthenticated ? { limit: 50 } : 'skip');
  const [activityDomain, setActivityDomain] = useState<
    'all' | 'finance' | 'social' | 'groups' | 'personal'
  >('all');
  const [activityOutcome, setActivityOutcome] = useState<'all' | 'success' | 'failed'>('all');
  const [activityWindow, setActivityWindow] = useState<'day' | 'week' | 'month' | 'all'>('week');
  const [activityBounds, setActivityBounds] = useState(() => ({
    startAt: Date.now() - 7 * 24 * 60 * 60_000,
  }));
  const activity = useQuery(
    api.mcpOAuth.listActivity,
    isAuthenticated && profile
      ? {
          limit: 50,
          ...(activityDomain === 'all' ? {} : { domain: activityDomain }),
          ...(activityOutcome === 'all' ? {} : { succeeded: activityOutcome === 'success' }),
          ...(activityWindow === 'all' ? {} : activityBounds),
        }
      : 'skip',
  );
  function updateActivityWindow(window: 'day' | 'week' | 'month' | 'all') {
    setActivityWindow(window);
    const days = window === 'day' ? 1 : window === 'week' ? 7 : window === 'month' ? 30 : 0;
    setActivityBounds({ startAt: days ? Date.now() - days * 24 * 60 * 60_000 : 0 });
  }
  const revokeGrant = useMutation(api.mcpOAuth.revokeGrant);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  async function handleRevoke(grantId: string) {
    setRevokingGrantId(grantId);
    try {
      await revokeGrant({ grantId: grantId as never });
      return true;
    } catch {
      return false;
    } finally {
      setRevokingGrantId(null);
    }
  }

  return (
    <McpDashboard
      signedIn={isAuthenticated && Boolean(profile) && grants !== undefined}
      accountLoading={
        isLoading || (isAuthenticated && (profile === undefined || grants === undefined))
      }
      displayName={profile?.displayName}
      endpoint={endpoint}
      connectHref="/mcp/login?next=%2Fmcp%2Fdashboard"
      connections={
        grants?.map((grant) => ({
          id: String(grant.id),
          clientName: grant.clientName,
          scopes: grant.scopes,
          createdAt: grant.createdAt,
          revokedAt: grant.revokedAt,
        })) ?? []
      }
      onRevoke={handleRevoke}
      activity={
        activity?.events.map((event) => ({
          id: String(event.id),
          clientName: event.clientName,
          toolName: event.toolName,
          succeeded: event.succeeded,
          createdAt: event.createdAt,
        })) ?? []
      }
      activityLoading={Boolean(isAuthenticated && profile && activity === undefined)}
      activityRetained={activity?.retained ?? 0}
      activityMatching={activity?.matching ?? 0}
      activityHasMore={activity?.hasMore ?? false}
      activityDomain={activityDomain}
      onActivityDomainChange={setActivityDomain}
      activityOutcome={activityOutcome}
      onActivityOutcomeChange={setActivityOutcome}
      activityWindow={activityWindow}
      onActivityWindowChange={updateActivityWindow}
      revokingGrantId={revokingGrantId}
    />
  );
}
