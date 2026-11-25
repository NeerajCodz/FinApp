'use client';

import { useRouter } from 'next/navigation';
import { PeopleAnalyticsScreen } from '@finapp/ui/finance';
import { useHubData } from '@/lib/groups/useHubData';

export default function PeopleAnalyticsPage() {
  const router = useRouter();
  const { people, hubGroups, summaries, balancesLoading } = useHubData();
  const total = (key: 'owed' | 'owing') =>
    summaries.length ? summaries.map((row) => row[key]).join(' · ') : balancesLoading ? '…' : '—';
  return (
    <PeopleAnalyticsScreen
      people={people}
      groups={hubGroups}
      owed={total('owed')}
      owing={total('owing')}
      onBack={() => router.push('/network')}
      onOpenPerson={(person) => router.push(`/network/person/${encodeURIComponent(person.id)}`)}
      onOpenGroup={(group) => router.push(`/group/${encodeURIComponent(group.id)}/analytics`)}
    />
  );
}
