import React from 'react';
import { View } from 'react-native';
import { ArrowRight, ChartLineUp, ShieldCheck, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

export default function WelcomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.background, paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 22, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: tokens.foreground, alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={22} color={tokens.background} weight="bold" />
        </View>
        <Typography variant="heading">Finapp</Typography>
      </View>

      <View style={{ gap: 26 }}>
        <View style={{ gap: 14 }}>
          <Typography variant="label">Private by default</Typography>
          <Typography variant="display" style={{ maxWidth: 340 }}>Money clarity, without the noise.</Typography>
          <Text style={{ color: tokens.mutedForeground, fontSize: 16, lineHeight: 24, maxWidth: 320 }}>A calm place to see what came in, what went out, and what matters next.</Text>
        </View>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <ChartLineUp size={20} color={tokens.primary} weight="bold" />
            <Text style={{ color: tokens.mutedForeground }}>One clear view of your money</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <ShieldCheck size={20} color={tokens.primary} weight="bold" />
            <Text style={{ color: tokens.mutedForeground }}>Your ledger stays yours</Text>
          </View>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Button size="lg" onPress={() => router.push('/(auth)/sign-in')}>
          <Text style={{ color: tokens.primaryForeground, fontFamily: 'PlusJakartaSans_600SemiBold' }}>Sign in</Text>
          <ArrowRight size={18} color={tokens.primaryForeground} weight="bold" style={{ marginLeft: 8 }} />
        </Button>
        <Button size="lg" variant="outline" onPress={() => router.push('/(auth)/sign-up')}>Create account</Button>
        <Typography variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>No ads. No noise. Just your numbers.</Typography>
      </View>
    </View>
  );
}
