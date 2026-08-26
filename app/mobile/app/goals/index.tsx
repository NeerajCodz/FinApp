import React from 'react';
import { View } from 'react-native';
import { Button, Empty, Typography } from '@/components/ui';

export default function GoalsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Goals</Typography>
      <Button>New goal</Button>
      <Empty
        title="No goals yet"
        description="Create a goal and build progress through immutable contributions."
      />
    </View>
  );
}
