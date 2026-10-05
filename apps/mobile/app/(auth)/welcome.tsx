import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthSubmit } from '@/components/auth/AuthFields';
import { CoinLogo } from '@/components/brand/CoinLogo';

export default function WelcomeScreen() {
  const { tokens } = useTheme();
  return (
    <AuthScaffold
      hero
      back={false}
      eyebrow="Money, on your terms"
      title={
        <>
          Less noise.{`\n`}More{' '}
          <Text
            style={{
              color: tokens.primary,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 48,
              lineHeight: 52,
              letterSpacing: -1.8,
            }}
          >
            control.
          </Text>
        </>
      }
      description="Spending, accounts, budgets and shared expenses. One clear place to make sense of it all."
      footer={
        <>
          <AuthSubmit label="Create your account" onPress={() => router.push('/(auth)/sign-up')} />
          <Button
            size="lg"
            variant="outline"
            style={{ borderRadius: 32, minHeight: 56 }}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            I already have an account
          </Button>
          <Typography variant="caption" style={{ textAlign: 'center', paddingTop: 6 }}>
            Start with your email. Make it yours.
          </Typography>
        </>
      }
    >
      <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <CoinLogo size={220} interactive />
      </View>
    </AuthScaffold>
  );
}
