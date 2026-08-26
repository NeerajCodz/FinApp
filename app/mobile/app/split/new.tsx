import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Select, Typography } from '@/components/ui';

export default function SplitExpenseScreen() {
  const [method, setMethod] = useState('equal');
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">Split expense</Typography>
      <Label>Total</Label>
      <Input accessibilityLabel="Split total" keyboardType="decimal-pad" />
      <Select
        label="Split method"
        options={['equal', 'exact', 'percentage', 'shares', 'adjustment']}
        value={method}
        onChange={setMethod}
      />
      <Typography>Who paid?</Typography>
      <Typography>Who owes?</Typography>
      <Button>Save split</Button>
    </View>
  );
}
