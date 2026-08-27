import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthActions } from '@convex-dev/auth/react';
import { toast } from '@/lib/toast';
import { BrandMark } from '@/components/finance';
import { Button, IconButton, Input, Label, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { signIn } = useAuthActions();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  async function submit() {
    setError('');
    const form = new FormData();
    form.append('email', email.trim().toLowerCase());
    form.append('password', password);
    form.append('flow', 'signIn');
    try {
      const result = await signIn('password', form);
      router.replace(result.signingIn ? '/(tabs)' : '/(auth)/verify');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to sign in';
      setError(message);
      toast.error('Sign in failed', { description: message });
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <BrandMark />
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 40 }}>
          <View style={{ gap: 10 }}>
            <Typography variant="title">Welcome back.</Typography>
            <Typography variant="display">Your money,{`\n`}back in focus.</Typography>
          </View>

          <View style={{ gap: 18 }}>
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
                returnKeyType="next"
                error={!!error}
              />
            </View>
            <View>
              <Label>Password</Label>
              <Input
                accessibilityLabel="Password"
                autoComplete="current-password"
                textContentType="password"
                secureTextEntry
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={submit}
                error={!!error}
              />
            </View>
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
        </View>

        <View style={{ gap: 12 }}>
          <Button size="lg" disabled={!email.trim() || !password} onPress={submit}>
            <Text
              style={{
                color: tokens.primaryForeground,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                fontSize: 15,
              }}
            >
              Sign in
            </Text>
            <ArrowRight size={18} color={tokens.primaryForeground} style={{ marginLeft: 8 }} />
          </Button>
          <Button variant="ghost" onPress={() => router.replace('/(auth)/sign-up')}>
            New to Finapp? Create account
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
