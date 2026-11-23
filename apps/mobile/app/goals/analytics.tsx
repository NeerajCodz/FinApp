import { GoalAnalyticsView } from '@/components/finance/GoalAnalyticsView';

/** Aggregate analytics across all active goals; static route wins over goals/[id]. */
export default function AllGoalsAnalyticsScreen() {
  return <GoalAnalyticsView />;
}
