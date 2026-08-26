import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, Input, Label, Typography, Text } from '@/components/ui';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useTheme } from '@/providers/ThemeProvider';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  async function submit() {
    setError('');
    const form = new FormData();
    form.append('email', email.trim().toLowerCase());
    form.append('password', password);
    form.append('flow', 'signIn');
    try {
      const result = await signIn('password', form);
      router.replace(result.signingIn ? '/(tabs)' : '/(auth)/verify');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in');
    }
  }
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
      {error && (
        <Text accessibilityRole="alert" style={{ color: tokens.destructive }}>
          {error}
        </Text>
      )}
      <Button disabled={!email || password.length < 8} onPress={() => void submit()}>
        Sign in
      </Button>
      <Button variant="secondary" onPress={() => router.push('/(auth)/verify')}>
        Verify email
      </Button>
      <Text style={{ textAlign: 'center', color: tokens.mutedForeground }}>
        Apple and Google sign-in can be enabled with deployment credentials.
      </Text>
    </View>
  );
}
