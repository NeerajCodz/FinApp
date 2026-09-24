import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { BrandMark } from '@/components/finance';
import { Button, InputOTP, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function TwoFactorScreen() {
  const { challengeId: rawChallengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = typeof rawChallengeId === 'string' ? rawChallengeId : '';
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function verify() {
    if (pending || code.length !== 6 || !challengeId) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.append('challengeId', challengeId);
    form.append('code', code);
    form.append('flow', 'twoFactorVerification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      router.replace('/(tabs)');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not verify this code.';
      setError(message);
      toast.error('Sign-in verification failed', { description: message });
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
      <BrandMark />
      <View style={{ flex: 1, justifyContent: 'center', gap: 32 }}>
        <View style={{ gap: 12 }}>
          <Typography variant="title">One last step.</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
            Enter the six-digit sign-in code sent to the email on your account. It expires in 10
            minutes.
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
          <Typography variant="caption">Return to sign in and request another code.</Typography>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Button disabled={pending || code.length !== 6 || !challengeId} size="lg" onPress={verify}>
          {pending ? 'Verifying…' : 'Verify and sign in'}
        </Button>
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          Return to sign in
        </Button>
      </View>
    </View>
  );
}
