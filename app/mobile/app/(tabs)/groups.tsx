import React from 'react';
import { View } from 'react-native';
import { Button, Empty, Skeleton, Typography } from '@/components/ui';
import { router } from 'expo-router';

export default function GroupsScreen() {
  const loading = false;
  if (loading)
    return (
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Skeleton height={32} />
        <Skeleton height={72} />
      </View>
    );
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Groups</Typography>
      <Button onPress={() => router.push('/group/new' as never)}>Create group</Button>
      <Empty
        title="No groups yet"
        description="Share expenses with friends, family, or teammates."
      />
    </View>
  );
}
