import React, { useState } from 'react';
import { View } from 'react-native';
import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { router, useLocalSearchParams } from 'expo-router';
import { formatAuthError } from '@convex/shared/authErrors';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, Input, InputOTP, Label, Typography } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit } from '@/components/auth/AuthFields';
import { isGroupInvitationToken } from '@/lib/authRoutes';

type Method = 'totp' | 'email' | 'recovery';

const COPY: Record<Method, { label: string; title: string; description: string }> = {
  totp: {
    label: 'App',
    title: 'Enter your\napp code.',
    description: 'Open your authenticator app and enter the six-digit code for Finapp.',
  },
  email: {
    label: 'Email',
    title: 'Check your\nemail.',
    description: 'Enter the six-digit code we sent to your email. It expires in 10 minutes.',
  },
  recovery: {
    label: 'Recovery code',
    title: 'Use a\nrecovery code.',
    description: 'Enter one of the recovery codes you saved. Each works once.',
  },
};

export default function TwoFactorScreen() {
  const {
    challengeId: rawChallengeId,
    nextGroupInviteToken: rawInviteToken,
    methods: rawMethods,
    preferred,
  } = useLocalSearchParams<{
    challengeId?: string;
    nextGroupInviteToken?: string;
    methods?: string;
    preferred?: string;
  }>();
  const methods = (typeof rawMethods === 'string' ? rawMethods : 'email')
    .split(',')
    .filter(
      (value): value is Method => value === 'totp' || value === 'email' || value === 'recovery',
    );
  const available: Method[] = methods.length ? methods : ['email'];
  const [method, setMethod] = useState<Method>(
    preferred === 'totp' && available.includes('totp') ? 'totp' : 'email',
  );
  // Without an authenticator app, the email code went out with the password check.
  const [emailSent, setEmailSent] = useState(method === 'email');
  const sendEmailCode = useAction(api.auth.sendTwoFactorEmailCode);
  const inviteToken = isGroupInvitationToken(rawInviteToken) ? rawInviteToken : undefined;
  const challengeId = typeof rawChallengeId === 'string' ? rawChallengeId : '';
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();

  async function verify() {
    if (pending || !ready || !challengeId) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.append('challengeId', challengeId);
    form.append('code', code.trim());
    form.append('method', method);
    form.append('flow', 'twoFactorVerification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      router.replace(
        inviteToken ? { pathname: '/group/invite', params: { token: inviteToken } } : '/(tabs)',
      );
    } catch (cause) {
      const message = formatAuthError(cause, 'verification');
      setError(message);
      toast.error('Sign-in verification failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  const ready =
    method === 'recovery' ? code.replace(/[^a-z0-9]/gi, '').length === 12 : code.length === 6;

  async function requestEmail() {
    if (!challengeId || pending) return;
    setPending(true);
    setError('');
    try {
      await sendEmailCode({ challengeId });
      setEmailSent(true);
      toast.success('Code sent to your email');
    } catch (cause) {
      setError(formatAuthError(cause, 'verification'));
    } finally {
      setPending(false);
    }
  }

  const copy = COPY[method];
  return (
    <AuthScaffold
      eyebrow="Two-factor sign-in"
      title={copy.title}
      description={copy.description}
      onBack={() =>
        router.canGoBack()
          ? router.back()
          : router.replace({
              pathname: '/(auth)/sign-in',
              ...(inviteToken ? { params: { nextGroupInviteToken: inviteToken } } : {}),
            })
      }
      footer={
        <Button
          variant="ghost"
          onPress={() =>
            router.replace({
              pathname: '/(auth)/sign-in',
              ...(inviteToken ? { params: { nextGroupInviteToken: inviteToken } } : {}),
            })
          }
        >
          Return to sign in
        </Button>
      }
    >
      {available.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {available.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={method === value ? 'primary' : 'outline'}
              onPress={() => {
                setMethod(value);
                setCode('');
                setError('');
              }}
            >
              {COPY[value].label}
            </Button>
          ))}
        </View>
      ) : null}
      {method === 'email' && !emailSent ? (
        <>
          <Typography variant="small">
            We’ll email a six-digit code to your account address.
          </Typography>
          <AuthSubmit
            label={pending ? 'Sending…' : 'Email me a code'}
            pending={pending}
            disabled={!challengeId}
            onPress={requestEmail}
          />
        </>
      ) : (
        <>
          <Label>{method === 'recovery' ? 'Recovery code' : 'Six-digit code'}</Label>
          {method === 'recovery' ? (
            <Input
              value={code}
              onChangeText={(value) => {
                if (!pending) {
                  setCode(value);
                  setError('');
                }
              }}
              placeholder="xxxx-xxxx-xxxx"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={16}
            />
          ) : (
            <InputOTP
              value={code}
              onChangeText={(value) => {
                if (!pending) {
                  setCode(value);
                  setError('');
                }
              }}
            />
          )}
          <AuthSubmit
            label={pending ? 'Verifying…' : 'Verify and sign in'}
            pending={pending}
            disabled={!ready || !challengeId}
            onPress={verify}
          />
          {method === 'email' ? (
            <Button variant="ghost" disabled={pending} onPress={() => void requestEmail()}>
              Send a new code
            </Button>
          ) : null}
        </>
      )}
      <AuthError
        message={
          error || (!challengeId ? 'Return to sign in to request a new sign-in code.' : undefined)
        }
      />
    </AuthScaffold>
  );
}
