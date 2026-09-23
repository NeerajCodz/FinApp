import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from '@/lib/icons';
import { toast } from '@/lib/toast';
import { BrandMark } from '@/components/finance';
import { Button, IconButton, Input, InputOTP, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function ForgotPasswordScreen() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(() => (typeof initialEmail === 'string' ? initialEmail : ''));
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [requested, setRequested] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function requestCode() {
    if (!email.trim() || pending) return;
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
      const message = cause instanceof Error ? cause.message : 'Could not send a reset code.';
      setError(message);
      toast.error('Reset code could not be sent', { description: message });
    } finally {
      setPending(false);
    }
  }

  async function resetPassword() {
    if (code.length !== 6 || password.length < 8 || pending) return;
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
      const message = cause instanceof Error ? cause.message : 'Could not reset the password.';
      setError(message);
      toast.error('Password reset failed', { description: message });
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          gap: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <BrandMark />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
          <View style={{ gap: 10 }}>
            <Typography variant="title">
              {requested ? 'Choose a new password.' : 'Reset your password.'}
            </Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
              {requested
                ? `Enter the six-digit code sent to ${email}. It expires in 10 minutes.`
                : 'We will email you a short-lived code to reset your password.'}
            </Text>
          </View>
          {!requested ? (
            <View>
              <Label>Email</Label>
              <Input
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                returnKeyType="go"
                onSubmitEditing={requestCode}
                error={!!error}
              />
            </View>
          ) : (
            <View style={{ gap: 22 }}>
              <InputOTP value={code} onChangeText={setCode} />
              <View>
                <Label>New password</Label>
                <Input
                  accessibilityLabel="New password"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  secureTextEntry
                  placeholder="At least eight characters"
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="go"
                  onSubmitEditing={resetPassword}
                  error={!!error}
                />
              </View>
              <Button variant="ghost" disabled={pending} onPress={requestCode}>
                {pending ? 'Sending…' : 'Send a new code'}
              </Button>
            </View>
          )}
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
        <Button
          size="lg"
          disabled={
            pending || (requested ? code.length !== 6 || password.length < 8 : !email.trim())
          }
          onPress={requested ? resetPassword : requestCode}
        >
          {pending ? 'Please wait…' : requested ? 'Update password' : 'Send reset code'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
