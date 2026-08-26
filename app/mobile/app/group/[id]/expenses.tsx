import React from 'react';
import { View } from 'react-native';
import { Empty, Typography } from '@/components/ui';

export default function GroupExpensesScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Expenses</Typography>
      <Empty title="No expenses" description="Add an expense to split it with the group." />
    </View>
  );
}
