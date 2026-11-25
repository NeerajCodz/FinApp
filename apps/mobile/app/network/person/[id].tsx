import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { PersonAnalyticsScreen } from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';

const back = () =>
  router.canGoBack() ? router.back() : router.navigate('/(tabs)/network' as never);

export default function PersonAnalyticsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, isConnected } = useLocalSync();
  const data = useQuery(
    api.social.queries.personAnalytics,
    userId && isConnected && id
      ? { userId: id as Id<'users'>, tzOffsetMinutes: new Date().getTimezoneOffset() }
      : 'skip',
  );
  const username = data?.profile.username;
  const conversationId = data?.conversationId;
  return (
    <PersonAnalyticsScreen
      data={userId && !isConnected ? null : data}
      onBack={back}
      onMessage={
        conversationId
          ? () => router.push(`/messages/${encodeURIComponent(conversationId)}` as never)
          : undefined
      }
      onOpenProfile={
        username ? () => router.push(`/@${encodeURIComponent(username)}` as never) : undefined
      }
      onOpenGroup={(groupId) => router.push(`/group/${encodeURIComponent(groupId)}` as never)}
    />
  );
}
