import React, { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BrandMark } from '@/components/finance';
import { Button, InputOTP, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function VerifyScreen() {
  const [code, setCode] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
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
          <Typography variant="title">Verify your email.</Typography>
          <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
            We sent a six-digit code to the email attached to your account.
          </Text>
        </View>

        <InputOTP value={code} onChangeText={setCode} />

        <View style={{ gap: 4 }}>
          <Typography variant="small" style={{ color: tokens.foreground }}>
            Didn't get it?
          </Typography>
          <Typography variant="caption">
            Check spam or return to confirm your email address.
          </Typography>
        </View>
      </View>

      <Button
        disabled={code.length !== 6}
        size="lg"
        onPress={() => router.replace('/(auth)/onboarding')}
      >
        Continue
      </Button>
    </View>
  );
}
