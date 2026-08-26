import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Select, Typography } from '@/components/ui';
import { router } from 'expo-router';

const localeCurrency = Intl.NumberFormat().resolvedOptions().locale.startsWith('en-US')
  ? 'USD'
  : 'INR';

export default function OnboardingScreen() {
  const [currency, setCurrency] = useState(localeCurrency);
  const [accountName, setAccountName] = useState('');
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
      <Typography variant="title">Make Finapp yours</Typography>
      <Select
        label="Default currency"
        options={['INR', 'USD', 'EUR', 'GBP']}
        value={currency}
        onChange={setCurrency}
      />
      <Label>First account (optional)</Label>
      <Input
        accessibilityLabel="First account name"
        placeholder="e.g. Main bank"
        value={accountName}
        onChangeText={setAccountName}
      />
      <Button onPress={() => router.replace('/(tabs)')}>
        {accountName ? 'Create account and continue' : 'Continue'}
      </Button>
      <Button variant="ghost" onPress={() => router.replace('/(tabs)')}>
        Skip for now
      </Button>
    </View>
  );
}
