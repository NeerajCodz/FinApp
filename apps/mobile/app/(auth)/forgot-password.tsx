import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatAuthError } from '@convex/shared/authErrors';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, Input, InputOTP, Label, PasswordField, Typography } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit, isEmail } from '@/components/auth/AuthFields';

export default function ForgotPasswordScreen() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(() => (typeof initialEmail === 'string' ? initialEmail : ''));
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
  }>({});

  async function requestCode() {
    if (pending) return;
    if (!isEmail(email)) {
      setFieldErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setFieldErrors({});
    setPending(true);
    setError('');
    const form = new FormData();
    form.append('email', email.trim().toLowerCase());
    form.append('flow', 'reset');
    try {
      await signIn('password', form);
      setRequested(true);
      setCode('');
      toast.success('Reset code sent');
    } catch (cause) {
      const message = formatAuthError(cause, 'password-reset-request');
      setError(message);
      toast.error('Reset code could not be sent', { description: message });
    } finally {
      setPending(false);
    }
  }

  async function resetPassword() {
    if (pending) return;
    const errors = {
      code: code.length !== 6 ? 'Enter the six-digit code from your email.' : undefined,
      password:
        password.length < 8 ? 'Use at least 8 characters for your new password.' : undefined,
    };
    setFieldErrors(errors);
    if (errors.code || errors.password) return;
    setPending(true);
    setError('');
    const form = new FormData();
    form.append('email', email.trim().toLowerCase());
    form.append('code', code);
    form.append('newPassword', password);
    form.append('flow', 'reset-verification');
    try {
      const result = await signIn('password', form);
      if (!result.signingIn) throw new Error('That code could not be verified.');
      toast.success('Password updated');
      router.replace('/(tabs)');
    } catch (cause) {
      const message = formatAuthError(cause, 'password-reset');
      setError(message);
      toast.error('Password reset failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow={requested ? 'Make a fresh start' : 'Let’s get you back'}
      title={requested ? <>New password.{`\n`}Same clarity.</> : <>A reset,{`\n`}not a restart.</>}
      description={
        requested
          ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
          : 'We’ll email you a short-lived code so you can choose a new password.'
      }
      footer={
        <Button
          variant="ghost"
          onPress={() => router.replace({ pathname: '/(auth)/sign-in', params: { email } })}
        >
          Return to sign in
        </Button>
      }
    >
      <Typography variant="heading">
        {requested ? 'Choose a new password' : 'Reset your password'}
      </Typography>
      {!requested ? (
        <View style={{ gap: 8 }}>
          <Label style={{ marginBottom: 0 }}>Email address</Label>
          <Input
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors({});
              setError('');
            }}
            returnKeyType="go"
            editable={!pending}
            onSubmitEditing={requestCode}
            error={!!fieldErrors.email}
          />
          <AuthError message={fieldErrors.email} />
        </View>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <Label style={{ marginBottom: 0 }}>Six-digit reset code</Label>
            <InputOTP
              value={code}
              onChangeText={(value) => {
                if (!pending) {
                  setCode(value);
                  setFieldErrors((current) => ({ ...current, code: undefined }));
                  setError('');
                }
              }}
            />
            <AuthError message={fieldErrors.code} />
          </View>
          <PasswordField
            label="New password"
            newPassword
            placeholder="Create a new password"
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
              setError('');
            }}
            returnKeyType="go"
            editable={!pending}
            onSubmitEditing={resetPassword}
            error={fieldErrors.password}
          />
          <Button variant="ghost" disabled={pending} onPress={requestCode}>
            Send a new code
          </Button>
        </>
      )}
      <AuthError message={error} />
      <AuthSubmit
        label={pending ? 'Please wait…' : requested ? 'Update password' : 'Send reset code'}
        pending={pending}
        onPress={requested ? resetPassword : requestCode}
      />
    </AuthScaffold>
  );
}
