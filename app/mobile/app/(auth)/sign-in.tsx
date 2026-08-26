import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ArrowLeft, ArrowRight } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from 'sonner-native';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
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
      toast.error('Sign in failed', {
        description: cause instanceof Error ? cause.message : 'Unable to sign in',
      });
    }
  }
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 24,
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <View style={{ flex: 1, justifyContent: 'center', gap: 26 }}>
          <View style={{ gap: 10 }}>
            <Typography variant="label">Your account</Typography>
            <Typography variant="display">Welcome back.</Typography>
            <Text style={{ color: tokens.mutedForeground, fontSize: 15, lineHeight: 22 }}>
              Sign in to pick up exactly where you left off.
            </Text>
          </View>
          <View style={{ gap: 16 }}>
            <View>
              <Label>Email</Label>
              <Input
                accessibilityLabel="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View>
              <Label>Password</Label>
              <Input
                accessibilityLabel="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>
            {error && (
              <Text accessibilityRole="alert" style={{ color: tokens.destructive, lineHeight: 20 }}>
                {error}
              </Text>
            )}
          </View>
        </View>
        <View style={{ gap: 11 }}>
          <Button size="lg" disabled={!email || password.length < 8} onPress={() => void submit()}>
            <Text
              style={{ color: tokens.primaryForeground, fontFamily: 'SpaceGrotesk_600SemiBold' }}
            >
              Sign in
            </Text>
            <ArrowRight
              size={18}
              color={tokens.primaryForeground}
              weight="bold"
              style={{ marginLeft: 8 }}
            />
          </Button>
          <Button variant="ghost" onPress={() => router.push('/(auth)/verify')}>
            Verify email
          </Button>
          <Typography variant="caption" style={{ textAlign: 'center', marginTop: 3 }}>
            Apple and Google sign-in can be enabled with deployment credentials.
          </Typography>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
