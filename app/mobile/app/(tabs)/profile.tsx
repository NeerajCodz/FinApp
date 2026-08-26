import React from 'react';
import { View } from 'react-native';
import { Button, Empty, Skeleton, Typography } from '@/components/ui';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const loading = false;
  if (loading)
    return (
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Skeleton height={40} />
        <Skeleton height={72} />
      </View>
    );
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Profile</Typography>
      <Empty
        title="Welcome to Finapp"
        description="Set up your profile and preferences when you are ready."
        action={<Button onPress={() => router.push('/settings' as never)}>Settings</Button>}
      />
    </View>
  );
}
