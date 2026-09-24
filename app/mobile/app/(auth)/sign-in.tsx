import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight } from '@/lib/icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { BrandMark } from '@/components/finance';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SignInScreen() {
  const { email: initialIdentifier } = useLocalSearchParams<{ email?: string }>();
  const [identifier, setIdentifier] = useState(() =>
    typeof initialIdentifier === 'string' ? initialIdentifier : '',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const requestEmailTwoFactor = useAction(api.auth.requestEmailTwoFactor);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const signInDisabled = !identifier.trim() || !password;

  async function submit() {
    setError('');
    try {
      const result = await requestEmailTwoFactor({
        identifier: identifier.trim(),
        password,
      });
      if (result.status === 'verification-required') {
        const form = new FormData();
        form.append('email', result.email);
        form.append('password', password);
        form.append('flow', 'verification-required');
        await signIn('password', form);
        router.replace({
          pathname: '/(auth)/verify',
          params: { email: result.email, next: 'tabs' },
        });
      } else {
        router.replace({
          pathname: '/(auth)/two-factor',
          params: { challengeId: result.challengeId },
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to sign in';
      setError(message);
      toast.error('Sign in failed', { description: message });
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
            <Typography variant="title">Welcome back.</Typography>
            <Typography variant="display">Your money,{`\n`}back in focus.</Typography>
          </View>

          <View style={{ gap: 18 }}>
            <View>
              <Label>Email or username</Label>
              <Input
                accessibilityLabel="Email or username"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                placeholder="you@example.com or @neeraj"
                value={identifier}
                onChangeText={setIdentifier}
                returnKeyType="next"
                error={!!error}
              />
            </View>
            <View>
              <Label>Password</Label>
              <Input
                accessibilityLabel="Password"
                autoComplete="current-password"
                textContentType="password"
                secureTextEntry
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={submit}
                error={!!error}
              />
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
        <Button
          variant="ghost"
          onPress={() =>
            router.push({
              pathname: '/(auth)/forgot-password',
              params: {
                email: identifier.includes('@') ? identifier.trim().toLowerCase() : '',
              },
            })
          }
        >
          Forgot password?
        </Button>
        <Button size="lg" disabled={signInDisabled} onPress={submit}>
          <Text
            style={{
              color: signInDisabled ? tokens.controlDisabledForeground : tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            Sign in
          </Text>
          <ArrowRight
            size={18}
            color={signInDisabled ? tokens.controlDisabledForeground : tokens.primaryForeground}
            style={{ marginLeft: 8 }}
          />
        </Button>
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-up')}>
          New to Finapp? Create account
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
