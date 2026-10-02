import { useLocalSearchParams } from 'expo-router';
import { SplitExpenseForm } from '@/components/finance/SplitExpenseForm';

export default function SplitExpenseScreen() {
  const { groupId: routeGroupId } = useLocalSearchParams<{ groupId?: string }>();
  const fixedGroupId = Array.isArray(routeGroupId) ? routeGroupId[0] : routeGroupId;
  return <SplitExpenseForm fixedGroupId={fixedGroupId} />;
}
