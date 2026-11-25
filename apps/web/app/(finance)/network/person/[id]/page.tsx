'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { PersonAnalyticsScreen } from '@finapp/ui/finance';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

export default function PersonAnalyticsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { userId, isConnected } = useBrowserSync();
  const data = useQuery(
    api.social.queries.personAnalytics,
    userId && isConnected
      ? { userId: id as Id<'users'>, tzOffsetMinutes: new Date().getTimezoneOffset() }
      : 'skip',
  );
  const username = data?.profile.username;
  const conversationId = data?.conversationId;
  return (
    <PersonAnalyticsScreen
      data={userId && !isConnected ? null : data}
      onBack={() => router.push('/network')}
      onMessage={
        conversationId
          ? () => router.push(`/messages/${encodeURIComponent(conversationId)}`)
          : undefined
      }
      onOpenProfile={
        username ? () => router.push(`/profile/${encodeURIComponent(username)}`) : undefined
      }
      onOpenGroup={(groupId) => router.push(`/group/${encodeURIComponent(groupId)}`)}
    />
  );
}
