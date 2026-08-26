import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Typography, Text } from '@/components/ui';
import { router } from 'expo-router';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Typography variant="title">Welcome back</Typography>
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
      <Button disabled={!email || password.length < 8} onPress={() => router.replace('/(tabs)')}>
        Sign in
      </Button>
      <Button variant="secondary" onPress={() => router.push('/(auth)/verify')}>
        Verify email
      </Button>
      <Text style={{ textAlign: 'center', color: '#667085' }}>
        Apple and Google sign-in can be enabled with deployment credentials.
      </Text>
    </View>
  );
}
