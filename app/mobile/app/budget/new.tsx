import React from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Select, Typography } from '@/components/ui';

export default function NewBudgetScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">New budget</Typography>
      <Label>Name</Label>
      <Input accessibilityLabel="Budget name" placeholder="Monthly spending" />
      <Label>Limit</Label>
      <Input accessibilityLabel="Budget limit" keyboardType="decimal-pad" />
      <Select
        label="Period"
        options={['monthly', 'category', 'account', 'custom']}
        value="monthly"
        onChange={() => undefined}
      />
      <Button>Save budget</Button>
    </View>
  );
}
