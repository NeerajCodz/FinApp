import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, Label, Typography } from '@/components/ui';

export default function NewGroupScreen() {
  const [name, setName] = useState('');
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Typography variant="title">New group</Typography>
      <Label>Group name</Label>
      <Input
        accessibilityLabel="Group name"
        value={name}
        onChangeText={setName}
        placeholder="Trip to Goa"
      />
      <Button disabled={!name.trim()} onPress={() => router.back()}>
        Create group
      </Button>
    </View>
  );
}
