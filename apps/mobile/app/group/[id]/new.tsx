import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SplitExpenseForm } from '@/components/finance/SplitExpenseForm';

export default function NewGroupExpenseScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <SplitExpenseForm fixedGroupId={id} />;
}
