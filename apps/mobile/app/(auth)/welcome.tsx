import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button, Text, Typography, useTheme } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthSubmit } from '@/components/auth/AuthFields';

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
      <View style={{ gap: 18 }}>
        <Typography variant="heading">A clearer everyday.</Typography>
        {[
          ['01', 'Know where it goes', 'Keep spending and balances in view.'],
          ['02', 'Plan what comes next', 'Give your budgets a place to live.'],
          ['03', 'Share without the guesswork', 'Track groups and split expenses.'],
        ].map(([number, title, description]) => (
          <View key={number} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
            <Text
              style={{
                color: tokens.primary,
                fontSize: 12,
                lineHeight: 24,
                fontVariant: ['tabular-nums'],
              }}
            >
              {number}
            </Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: 'SpaceGrotesk_500Medium' }}>{title}</Text>
              <Typography variant="small">{description}</Typography>
            </View>
          </View>
        ))}
      </View>
    </AuthScaffold>
  );
}
