import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { PeopleHubScreen, type HubPerson } from '@finapp/ui/finance';
import { Avatar } from '@finapp/ui/native';
import { useHubData } from '@/hooks/useHubData';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';

const openPersonAnalytics = (person: HubPerson) =>
  router.push(`/network/person/${encodeURIComponent(person.id)}` as never);

/** People tab: the people you talk to and the groups you share. */
export default function NetworkTab() {
  const { userId, people, peopleTruncated, groups } = useHubData();
  const profile = useLocalRecords<LocalRecord>(userId, 'profile').data?.[0];
  const profileName =
    (typeof profile?.displayName === 'string' && profile.displayName.trim()) ||
    (typeof profile?.username === 'string' && profile.username.trim()) ||
    'Your profile';
  return (
    <PeopleHubScreen
      people={people}
      peopleTruncated={peopleTruncated}
      groups={groups}
      headerAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Profile, ${profileName}`}
          onPress={() => router.push('/(tabs)/profile' as never)}
          hitSlop={4}
        >
          <Avatar
            label={profileName}
            initials={profileName.slice(0, 1).toUpperCase()}
            size={42}
            avatarId={typeof profile?.avatarId === 'string' ? profile.avatarId : undefined}
            imageUrl={typeof profile?.avatarUrl === 'string' ? profile.avatarUrl : undefined}
          />
        </Pressable>
      }
      onOpenAnalytics={() => router.push('/network/analytics' as never)}
      onOpenPeople={() => router.push('/(tabs)/people' as never)}
      onOpenGroups={() => router.push('/(tabs)/groups' as never)}
      onOpenPerson={(person) => {
        if (person.unreadCount && person.conversationId)
          router.push(`/messages/${encodeURIComponent(person.conversationId)}` as never);
        else if (person.username) router.push(`/@${encodeURIComponent(person.username)}` as never);
        else openPersonAnalytics(person);
      }}
      onOpenPersonAnalytics={openPersonAnalytics}
      onOpenGroup={(group) => router.push(`/group/${encodeURIComponent(group.id)}` as never)}
      onOpenGroupAnalytics={(group) =>
        router.push(`/group/${encodeURIComponent(group.id)}/analytics` as never)
      }
    />
  );
}
