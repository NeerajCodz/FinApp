import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Progress, Typography } from '@/components/ui';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">{id ?? 'Goal'}</Typography>
      <Progress value={0} />
      <Typography>Contribution history will appear here.</Typography>
    </View>
  );
}
