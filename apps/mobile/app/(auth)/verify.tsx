import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { formatAuthError } from '@convex/shared/authErrors';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, InputOTP, Label, Typography } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit } from '@/components/auth/AuthFields';
import { isGroupInvitationToken } from '@/lib/authRoutes';

export default function VerifyScreen() {
  const {
    email: rawEmail,
    next: rawNext,
    nextGroupInviteToken: rawInviteToken,
  } = useLocalSearchParams<{
    email?: string;
    next?: string;
    nextGroupInviteToken?: string;
  }>();
  const inviteToken = isGroupInvitationToken(rawInviteToken) ? rawInviteToken : undefined;
  const email = typeof rawEmail === 'string' ? rawEmail : '';
  const next = rawNext === 'onboarding' ? 'onboarding' : 'tabs';
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();

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
      if (next === 'onboarding') {
        router.replace(
          inviteToken
            ? { pathname: '/(auth)/onboarding', params: { nextGroupInviteToken: inviteToken } }
            : '/(auth)/onboarding',
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch (cause) {
      const message = formatAuthError(cause, 'verification');
      setError(message);
      toast.error('Verification failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="Check your inbox"
      title={<>A small step.{`\n`}A clear start.</>}
      description={
        next === 'onboarding'
          ? `Enter the six-digit code sent to ${email || 'your email address'}. It expires in 10 minutes.`
          : 'Enter the six-digit code sent to the email on your account. It expires in 10 minutes.'
      }
      footer={
        <Button
          variant="ghost"
          onPress={() =>
            router.replace({
              pathname: '/(auth)/sign-in',
              params: { email, ...(inviteToken ? { nextGroupInviteToken: inviteToken } : {}) },
            })
          }
        >
          Return to sign in
        </Button>
      }
    >
      <Typography variant="heading">Verify your email</Typography>
      <Label>Six-digit email code</Label>
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
          error ||
          (!email
            ? 'Open verification from sign in or account creation to request a code.'
            : undefined)
        }
      />
      <AuthSubmit
        label={pending ? 'Verifying…' : 'Verify email'}
        pending={pending}
        disabled={code.length !== 6 || !email}
        onPress={verify}
      />
      <Typography variant="small">
        Didn’t get a code? Return to sign in with your password to send a fresh one.
      </Typography>
    </AuthScaffold>
  );
}
