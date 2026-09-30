import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, Checkbox, Input, Label, Typography, useTheme } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit, isEmail, PasswordField } from '@/components/auth/AuthFields';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();

  async function submit() {
    if (pending) return;
    setError('');
    const errors = {
      email: !isEmail(email) ? 'Enter a valid email address.' : undefined,
      password: password.length < 8 ? 'Use at least 8 characters for your password.' : undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    setPending(true);
    const form = new FormData();
    form.append('email', email.trim().toLowerCase());
    form.append('password', password);
    form.append('twoFactorEnabled', String(twoFactorEnabled));
    form.append('flow', 'signUp');
    try {
      const result = await signIn('password', form);
      if (result.signingIn) {
        router.replace('/(auth)/onboarding');
      } else {
        router.replace({
          pathname: '/(auth)/verify',
          params: { email: email.trim().toLowerCase(), next: 'onboarding' },
        });
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to create account';
      setError(message);
      toast.error('Account creation failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="A fresh start"
      title={<>Make room{`\n`}for clarity.</>}
      description="Build a money habit that works for you. Start with an account, then set your own pace."
      footer={
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-in')}>
          Already a member? Sign in
        </Button>
      }
    >
      <View style={{ gap: 6 }}>
        <Typography variant="heading">Create your account</Typography>
        <Typography variant="small">Your everyday money, brought together.</Typography>
      </View>
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
            setFieldErrors((current) => ({ ...current, email: undefined }));
            setError('');
          }}
          returnKeyType="done"
          editable={!pending}
          error={!!fieldErrors.email}
        />
        <AuthError message={fieldErrors.email} />
      </View>
      <PasswordField
        newPassword
        placeholder="Create a password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setFieldErrors((current) => ({ ...current, password: undefined }));
          setError('');
        }}
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!pending}
        error={fieldErrors.password}
      />
      <View
        style={{ gap: 6, padding: 14, borderRadius: 18, backgroundColor: tokens.surfaceRaised }}
      >
        <Checkbox
          checked={twoFactorEnabled}
          onChange={(value) => {
            if (!pending) setTwoFactorEnabled(value);
          }}
          label="Add email two-factor sign-in"
        />
        <Typography variant="small">
          Optional. Get an email code after entering your password each time you sign in.
        </Typography>
      </View>
      <AuthError message={error} />
      <AuthSubmit
        label={pending ? 'Creating account…' : 'Create account'}
        pending={pending}
        onPress={submit}
      />
      <Typography variant="caption" style={{ textAlign: 'center' }}>
        We’ll send a code to verify your email.
      </Typography>
    </AuthScaffold>
  );
}
