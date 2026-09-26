import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from '@/lib/icons';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { BrandMark } from '@/components/finance';
import { Button, IconButton, InputOTP, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';

export default function VerifyScreen() {
  const { email: rawEmail, next: rawNext } = useLocalSearchParams<{
    email?: string;
    next?: string;
  }>();
  const email = typeof rawEmail === 'string' ? rawEmail : '';
  const next = rawNext === 'onboarding' ? 'onboarding' : 'tabs';
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function verify() {
    if (pending || code.length !== 6 || !email) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.append('email', email);
    form.append('code', code);
    form.append('flow', 'email-verification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      toast.success('Email verified');
      router.replace(next === 'onboarding' ? '/(auth)/onboarding' : '/(tabs)');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not verify this code.';
      setError(message);
      toast.error('Verification failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        paddingHorizontal: 20,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton
          label="Go back"
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/sign-in'))}
        >
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <BrandMark />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 32 }}>
        <View style={{ gap: 12 }}>
          <Typography variant="title">Verify your email.</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
            {next === 'onboarding'
              ? `Enter the six-digit code sent to ${email || 'your email address'}. The code expires in 10 minutes.`
              : 'Enter the six-digit code sent to the email on your account. The code expires in 10 minutes.'}
          </Text>
        </View>
        <InputOTP value={code} onChangeText={setCode} />
        {!!error && (
          <Typography
            variant="small"
            accessibilityLiveRegion="polite"
            style={{ color: tokens.destructive }}
          >
            {error}
          </Typography>
        )}
        <View style={{ gap: 4 }}>
          <Typography variant="small" style={{ color: tokens.foreground }}>
            Didn&apos;t get a code?
          </Typography>
          <Typography variant="caption">
            Sign in with your password to send a fresh code.
          </Typography>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Button disabled={pending || code.length !== 6 || !email} size="lg" onPress={verify}>
          {pending ? 'Verifying…' : 'Verify email'}
        </Button>
        <Button
          variant="ghost"
          onPress={() => router.replace({ pathname: '/(auth)/sign-in', params: { email } })}
        >
          Return to sign in
        </Button>
      </View>
    </View>
  );
}
