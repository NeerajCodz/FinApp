import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { formatAuthError } from '@convex/shared/auth-errors';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, InputOTP, Label, Typography } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit } from '@/components/auth/AuthFields';

export default function TwoFactorScreen() {
  const { challengeId: rawChallengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const challengeId = typeof rawChallengeId === 'string' ? rawChallengeId : '';
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();

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
      const message = formatAuthError(cause, 'verification');
      setError(message);
      toast.error('Sign-in verification failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="One last step"
      title={<>Keep it{`\n`}in your hands.</>}
      description="Enter the six-digit sign-in code sent to the email on your account. It expires in 10 minutes."
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/sign-in'))}
      footer={
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          Return to sign in
        </Button>
      }
    >
      <Typography variant="heading">Confirm it’s you</Typography>
      <Label>Six-digit sign-in code</Label>
      <InputOTP
        value={code}
        onChangeText={(value) => {
          if (!pending) {
            setCode(value);
            setError('');
          }
        }}
      />
      <AuthError
        message={
          error || (!challengeId ? 'Return to sign in to request a new sign-in code.' : undefined)
        }
      />
      <AuthSubmit
        label={pending ? 'Verifying…' : 'Verify and sign in'}
        pending={pending}
        disabled={code.length !== 6 || !challengeId}
        onPress={verify}
      />
      <Typography variant="small">
        Didn’t get a code? Return to sign in and request another.
      </Typography>
    </AuthScaffold>
  );
}
