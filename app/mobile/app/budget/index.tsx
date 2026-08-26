import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Empty, Typography } from '@/components/ui';

export default function BudgetScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Budgets</Typography>
      <Button onPress={() => router.push('/budget/new' as never)}>New budget</Button>
      <Empty
        title="No budgets yet"
        description="Set a monthly, category, account, or custom budget."
      />
    </View>
  );
}
