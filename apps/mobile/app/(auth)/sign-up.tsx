import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { formatAuthError } from '@convex/shared/authErrors';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { Button, Input, Label, PasswordField, Typography } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit, isEmail } from '@/components/auth/AuthFields';
import { isGroupInvitationToken } from '@/lib/authRoutes';

export default function SignUpScreen() {
  const { nextGroupInviteToken: rawInviteToken } = useLocalSearchParams<{
    nextGroupInviteToken?: string;
  }>();
  const inviteToken = isGroupInvitationToken(rawInviteToken) ? rawInviteToken : undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, setPending] = useState(false);
  const { signIn } = useAuthActions();

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
    form.append('flow', 'signUp');
    try {
      await signIn('password', form);
      router.replace({
        pathname: '/(auth)/verify',
        params: {
          email: email.trim().toLowerCase(),
          next: 'onboarding',
          ...(inviteToken ? { nextGroupInviteToken: inviteToken } : {}),
        },
      });
    } catch (cause) {
      const message = formatAuthError(cause, 'sign-up');
      setError(message);
      toast.error('Account creation failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthScaffold
      brand
      title={<>Make room{`\n`}for clarity.</>}
      description="Build a money habit that works for you. Start with an account, then set your own pace."
      footer={
        <Button
          variant="ghost"
          onPress={() =>
            router.replace(
              inviteToken
                ? {
                    pathname: '/(auth)/sign-in',
                    params: { nextGroupInviteToken: inviteToken },
                  }
                : '/(auth)/sign-in',
            )
          }
        >
          Already a member? Sign in
        </Button>
      }
    >
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
