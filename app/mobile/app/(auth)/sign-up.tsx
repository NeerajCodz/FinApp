import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { BrandMark } from '@/components/finance';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const signUpDisabled = !email.trim() || password.length < 8;

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
      const message = cause instanceof Error ? cause.message : 'Unable to create account';
      setError(message);
      toast.error('Account creation failed', { description: message });
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <BrandMark />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 40 }}>
          <View style={{ gap: 10 }}>
            <Typography variant="title">Start clearly.</Typography>
            <Typography variant="display">Build a calmer{`\n`}money habit.</Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
              One private ledger for spending, accounts, budgets, and shared expenses.
            </Text>
          </View>

          <View style={{ gap: 18 }}>
            <View>
              <Label>Email</Label>
              <Input
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                error={!!error}
              />
            </View>
            <View>
              <Label>Password</Label>
              <Input
                accessibilityLabel="Password"
                autoComplete="new-password"
                textContentType="newPassword"
                secureTextEntry
                placeholder="Create a secure password"
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={submit}
                error={!!error}
              />
              <Typography variant="caption" style={{ marginTop: 8 }}>
                Use at least eight characters.
              </Typography>
            </View>
            {!!error && (
              <Typography
                variant="small"
                accessibilityLiveRegion="polite"
                style={{ color: tokens.destructive }}
              >
                {error}
              </Typography>
            )}
          </View>
        </View>

      </ScrollView>
      <View
        style={{
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          borderTopWidth: 1,
          borderTopColor: tokens.borderSubtle,
          backgroundColor: tokens.background,
        }}
      >
        <Button size="lg" disabled={signUpDisabled} onPress={submit}>
          <Text
            style={{
              color: signUpDisabled
                ? tokens.controlDisabledForeground
                : tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Create account
          </Text>
          <ArrowRight
            size={18}
            color={signUpDisabled ? tokens.controlDisabledForeground : tokens.primaryForeground}
            style={{ marginLeft: 8 }}
          />
        </Button>
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          Already have an account? Sign in
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
