import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Empty, Typography } from '@/components/ui';

export default function CategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">{id ?? 'Category'}</Typography>
      <Empty title="No transactions" description="Historical transactions will appear here." />
    </View>
  );
}
