import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Empty, Typography } from '@/components/ui';

export default function AccountsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Accounts</Typography>
      <Button onPress={() => router.push('/account/new' as never)}>New account</Button>
      <Empty title="No accounts yet" description="Add a cash, bank, card, or wallet account." />
    </View>
  );
}
