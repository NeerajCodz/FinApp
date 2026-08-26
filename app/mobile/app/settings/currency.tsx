import React from 'react';
import { View } from 'react-native';
import { Select, Typography } from '@/components/ui';

export default function CurrencySettingsScreen() {
  return (
    <View style={{ flex: 1, padding: 16, gap: 16 }}>
      <Typography variant="title">Currency</Typography>
      <Select
        label="Default currency"
        options={['INR', 'USD', 'EUR', 'GBP', 'JPY']}
        value="INR"
        onChange={() => undefined}
      />
    </View>
  );
}
