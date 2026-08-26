import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BudgetProgress } from '@/components/finance';
import { Typography } from '@/components/ui';

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">{id ?? 'Budget'}</Typography>
      <BudgetProgress spentMinor={0n} limitMinor={0n} currency="INR" />
    </View>
  );
}
