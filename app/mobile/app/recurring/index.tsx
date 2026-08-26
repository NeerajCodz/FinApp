import React from 'react';
import { View } from 'react-native';
import { Button, Empty, Typography } from '@/components/ui';

export default function RecurringScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Recurring</Typography>
      <Button>New recurring rule</Button>
      <Empty
        title="No recurring rules"
        description="Preview and schedule the recurring transactions you choose."
      />
    </View>
  );
}
