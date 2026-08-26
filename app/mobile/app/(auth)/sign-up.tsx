import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ArrowLeft, ArrowRight, ShieldCheck } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from 'sonner-native';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SignUpScreen() {
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
    form.append('flow', 'signUp');
    try {
      const result = await signIn('password', form);
      router.replace(result.signingIn ? '/(auth)/onboarding' : '/(auth)/verify');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create account');
      toast.error('Account creation failed', {
        description: cause instanceof Error ? cause.message : 'Unable to create account',
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
            <Typography variant="label">Start clean</Typography>
            <Typography variant="display">Build your money view.</Typography>
            <Text style={{ color: tokens.mutedForeground, fontSize: 15, lineHeight: 22 }}>
              Create a private ledger that gets clearer with every entry.
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
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={17} color={tokens.primary} weight="bold" />
            <Typography variant="caption">Private storage. No ads. No selling data.</Typography>
          </View>
          <Button size="lg" disabled={!email || password.length < 8} onPress={() => void submit()}>
            <Text
              style={{ color: tokens.primaryForeground, fontFamily: 'PlusJakartaSans_600SemiBold' }}
            >
              Create account
            </Text>
            <ArrowRight
              size={18}
              color={tokens.primaryForeground}
              weight="bold"
              style={{ marginLeft: 8 }}
            />
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
