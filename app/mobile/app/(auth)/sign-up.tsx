import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Typography } from '@/components/ui';
import { router } from 'expo-router';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Typography variant="title">Create your account</Typography>
      <Label>Email</Label>
      <Input
        accessibilityLabel="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Label>Password</Label>
      <Input
        accessibilityLabel="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        disabled={!email || password.length < 8}
        onPress={() => router.replace('/(auth)/verify')}
      >
        Create account
      </Button>
    </View>
  );
}
