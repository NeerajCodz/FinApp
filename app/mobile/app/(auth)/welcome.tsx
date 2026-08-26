import React from 'react';
import { View } from 'react-native';
import { ArrowRight } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BrandMark } from '@/components/finance';
import { Button, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function WelcomeScreen() {
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

      <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingBottom: 30 }}>
        <View style={{ gap: 14 }}>
          <Typography variant="display" style={{ maxWidth: 330 }}>
            Money,{`\n`}without the mess.
          </Typography>
          <Text
            style={{ color: tokens.foregroundMuted, fontSize: 17, lineHeight: 25, maxWidth: 300 }}
          >
            Track yours. Split theirs. Know where it went.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['TRACK', 'SPLIT', 'UNDERSTAND'].map((word, index) => (
            <View key={word} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {index > 0 && (
                <View style={{ width: 12, height: 1, backgroundColor: tokens.border }} />
              )}
              <Typography variant="caption">{word}</Typography>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Button size="lg" onPress={() => router.push('/(auth)/sign-in')}>
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
        <Button size="lg" variant="outline" onPress={() => router.push('/(auth)/sign-up')}>
          Create account
        </Button>
        <Typography variant="caption" style={{ textAlign: 'center', marginTop: 6 }}>
          Private by default. Your ledger stays yours.
        </Typography>
      </View>
    </View>
  );
}
