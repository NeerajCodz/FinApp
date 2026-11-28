import { router } from 'expo-router';
import { PeopleAnalyticsScreen } from '@finapp/ui/finance';
import { useHubData } from '@/hooks/useHubData';

const back = () =>
  router.canGoBack() ? router.back() : router.navigate('/(tabs)/network' as never);

export default function PeopleAnalyticsRoute() {
  const { people, peopleTruncated, groups } = useHubData();
  return (
    <PeopleAnalyticsScreen
      people={people}
      peopleTruncated={peopleTruncated}
      groups={groups}
      onBack={back}
      onOpenPerson={(person) =>
        router.push(`/network/person/${encodeURIComponent(person.id)}` as never)
      }
      onOpenGroup={(group) =>
        router.push(`/group/${encodeURIComponent(group.id)}/analytics` as never)
      }
    />
  );
}
