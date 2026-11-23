'use client';

import { GoalAnalyticsView } from '@/components/finance/GoalAnalyticsView';

/** Aggregate analytics across all active goals; static segment wins over goals/[id]. */
export default function AllGoalsAnalyticsPage() {
  return <GoalAnalyticsView />;
}
