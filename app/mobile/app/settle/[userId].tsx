import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Input, Label, Typography } from '@/components/ui';

export default function SettlementScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">Settle with {userId ?? 'member'}</Typography>
      <Label>Amount</Label>
      <Input accessibilityLabel="Settlement amount" keyboardType="decimal-pad" />
      <Button>Mark settled</Button>
    </View>
  );
}
