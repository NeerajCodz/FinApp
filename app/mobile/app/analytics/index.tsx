import React from 'react';
import { ScrollView } from 'react-native';
import { InsightCard } from '@/components/finance';
import { Card, Empty, Typography } from '@/components/ui';
import { BarChart } from '@/components/charts/BarChart';

export default function AnalyticsScreen() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
      <Typography variant="title">Analytics</Typography>
      <Card>
        <Typography variant="heading">Spending trend</Typography>
        <BarChart values={[0, 0, 0, 0]} />
      </Card>
      <InsightCard
        title="Your patterns"
        body="Record more activity to unlock deterministic comparisons."
      />
      <Empty
        title="No analytics yet"
        description="Analytics are derived from your ledger and stay private to you."
      />
    </ScrollView>
  );
}
