'use client';

import { useRouter } from 'next/navigation';
import { PeopleHubScreen, type HubPerson } from '@finapp/ui/finance';
import { useHubData } from '@/lib/groups/useHubData';

const personAnalyticsHref = (person: Pick<HubPerson, 'id'>) =>
  `/network/person/${encodeURIComponent(person.id)}`;

/** People hub: the people you talk to and the groups you share, in one place. */
export default function NetworkPage() {
  const router = useRouter();
  const { people, hubGroups } = useHubData();
  return (
    <PeopleHubScreen
      people={people}
      groups={hubGroups}
      onOpenAnalytics={() => router.push('/network/analytics')}
      onOpenPeople={() => router.push('/people')}
      onOpenGroups={() => router.push('/groups')}
      onOpenPerson={(person) =>
        router.push(
          person.unreadCount && person.conversationId
            ? `/messages/${encodeURIComponent(person.conversationId)}`
            : person.username
              ? `/profile/${encodeURIComponent(person.username)}`
              : personAnalyticsHref(person),
        )
      }
      onOpenPersonAnalytics={(person) => router.push(personAnalyticsHref(person))}
      onOpenGroup={(group) => router.push(`/group/${encodeURIComponent(group.id)}`)}
      onOpenGroupAnalytics={(group) =>
        router.push(`/group/${encodeURIComponent(group.id)}/analytics`)
      }
    />
  );
}
