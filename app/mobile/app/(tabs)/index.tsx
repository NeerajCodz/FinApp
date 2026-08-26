import React from 'react';
import { ScrollView, View } from 'react-native';
import { Card, Empty, Progress, Skeleton, Text, Typography } from '@/components/ui';

export default function HomeScreen() {
  const loading = false;
  if (loading)
    return (
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Skeleton height={32} />
        <Skeleton height={120} />
        <Skeleton height={80} />
      </View>
    );
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
      <Typography variant="title">Good morning</Typography>
      <Card>
        <Text style={{ color: '#667085' }}>Available balance</Text>
        <Typography variant="title">₹0.00</Typography>
      </Card>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text>Income</Text>
          <Typography variant="heading">₹0</Typography>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text>Spending</Text>
          <Typography variant="heading">₹0</Typography>
        </Card>
      </View>
      <Card>
        <Typography variant="heading">Budget progress</Typography>
        <Progress value={0} />
        <Text style={{ color: '#667085' }}>No budgets yet</Text>
      </Card>
      <Empty
        title="Your activity will appear here"
        description="Add your first income or expense to start building your picture."
      />
    </ScrollView>
  );
}
