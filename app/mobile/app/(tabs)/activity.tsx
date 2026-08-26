import React from 'react';
import { View } from 'react-native';
import { Empty, Input, Skeleton, Typography } from '@/components/ui';

export default function ActivityScreen() {
  const loading = false;
  if (loading)
    return (
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Skeleton height={48} />
        <Skeleton height={64} />
        <Skeleton height={64} />
      </View>
    );
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Activity</Typography>
      <Input accessibilityLabel="Search activity" placeholder="Search merchant, note, or amount" />
      <Empty
        title="No activity yet"
        description="Transactions, group expenses, and settlements will appear here."
      />
    </View>
  );
}
