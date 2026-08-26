import React from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Typography } from '@/components/ui';

export default function NewSettlementScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">Settle up</Typography>
      <Typography>With a group member</Typography>
      <Label>Amount</Label>
      <Input accessibilityLabel="Settlement amount" keyboardType="decimal-pad" />
      <Label>Payment account</Label>
      <Input accessibilityLabel="Payment account" placeholder="Main bank" />
      <Button>Mark settled</Button>
    </View>
  );
}
