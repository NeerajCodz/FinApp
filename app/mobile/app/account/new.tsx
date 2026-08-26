import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, Label, Select, Typography } from '@/components/ui';

export default function NewAccountScreen() {
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">New account</Typography>
      <Label>Name</Label>
      <Input
        accessibilityLabel="Account name"
        value={name}
        onChangeText={setName}
        placeholder="Main bank"
      />
      <Select
        label="Type"
        options={['cash', 'bank', 'card', 'wallet']}
        value={type}
        onChange={setType}
      />
      <Button disabled={!name.trim()} onPress={() => router.back()}>
        Save account
      </Button>
    </View>
  );
}
