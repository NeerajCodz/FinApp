import React from 'react';
import { View } from 'react-native';
import { Empty, Typography } from '@/components/ui';

export default function NotificationsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Notifications</Typography>
      <Empty
        title="You are all caught up"
        description="Shared expense updates, settlements, and planning reminders appear here."
      />
    </View>
  );
}
