import { useLocalSearchParams } from 'expo-router';
import { GoalAnalyticsView } from '@/components/finance/GoalAnalyticsView';

export default function GoalAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GoalAnalyticsView goalId={id} />;
}
