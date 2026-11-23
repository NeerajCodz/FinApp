'use client';

import { useParams } from 'next/navigation';
import { GoalAnalyticsView } from '@/components/finance/GoalAnalyticsView';

export default function GoalAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  return <GoalAnalyticsView goalId={id} />;
}
