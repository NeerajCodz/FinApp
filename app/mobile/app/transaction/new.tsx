import React, { useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AmountKeypad, CurrencyInput } from '@/components/finance';
import { Button, Collapsible, Select, Typography } from '@/components/ui';

export default function NewTransactionScreen() {
  const { type: queryType } = useLocalSearchParams<{ type?: string }>();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(queryType ?? 'expense');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Typography variant="title">New {type}</Typography>
      <CurrencyInput currency="INR" value={amount} onChangeText={setAmount} />
      <AmountKeypad onDigit={(digit) => setAmount((current) => `${current}${digit}`)} />
      <Select
        label="Type"
        options={['expense', 'income', 'transfer']}
        value={type}
        onChange={setType}
      />
      <Collapsible title="More options">
        <Typography>Split, recurring, receipt, location, and tags</Typography>
      </Collapsible>
      <Button disabled={!amount} onPress={() => router.back()}>
        Save
      </Button>
    </ScrollView>
  );
}
