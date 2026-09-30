import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, Input, Label, Typography } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit, isIdentifier, PasswordField } from '@/components/auth/AuthFields';

export default function SignInScreen() {
  const { email: initialIdentifier } = useLocalSearchParams<{ email?: string }>();
  const [identifier, setIdentifier] = useState(() =>
    typeof initialIdentifier === 'string' ? initialIdentifier : '',
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();
  const requestEmailTwoFactor = useAction(api.auth.requestEmailTwoFactor);

  async function submit() {
    if (pending) return;
    setError('');
    const errors = {
      identifier: !isIdentifier(identifier)
        ? 'Enter a valid email or a username with 3–32 letters, numbers or underscores.'
        : undefined,
      password: !password ? 'Enter your password.' : undefined,
    };
    setFieldErrors(errors);
    if (errors.identifier || errors.password) return;
    setPending(true);
    try {
      const result = await requestEmailTwoFactor({ identifier: identifier.trim(), password });
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
      } else if (result.status === 'two-factor-disabled') {
        const form = new FormData();
        form.append('email', identifier.trim());
        form.append('password', password);
        form.append('flow', 'signIn');
        const signInResult = await signIn('password', form);
        if (!signInResult.signingIn) throw new Error('Unable to sign in');
        router.replace('/(tabs)');
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
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScaffold
      eyebrow="Welcome back"
      title={<>Back in{`\n`}your corner.</>}
      description="Your spending, your plans, your people. Pick up right where you left off."
      footer={
        <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-up')}>
          New here? Create an account
        </Button>
      }
    >
      <View style={{ gap: 6 }}>
        <Typography variant="heading">Sign in to Finapp</Typography>
        <Typography variant="small">A little clarity starts here.</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Label style={{ marginBottom: 0 }}>Email or username</Label>
        <Input
          accessibilityLabel="Email or username"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          placeholder="you@example.com or @yourname"
          value={identifier}
          onChangeText={(value) => {
            setIdentifier(value);
            setFieldErrors((current) => ({ ...current, identifier: undefined }));
            setError('');
          }}
          returnKeyType="done"
          editable={!pending}
          error={!!fieldErrors.identifier}
        />
        <AuthError message={fieldErrors.identifier} />
      </View>
      <PasswordField
        placeholder="Your password"
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
      <Button
        variant="ghost"
        disabled={pending}
        style={{ alignSelf: 'flex-end', paddingHorizontal: 0 }}
        onPress={() =>
          router.push({
            pathname: '/(auth)/forgot-password',
            params: {
              email:
                identifier.includes('@') && !identifier.startsWith('@')
                  ? identifier.trim().toLowerCase()
                  : '',
            },
          })
        }
      >
        Forgot password?
      </Button>
      <AuthError message={error} />
      <AuthSubmit label={pending ? 'Signing in…' : 'Sign in'} pending={pending} onPress={submit} />
    </AuthScaffold>
  );
}
