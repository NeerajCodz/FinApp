import React, { useState } from 'react';
import { View } from 'react-native';
import { ArrowLeft, ArrowRight, Coins, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Label, Select, Text, Typography } from '@/components/ui';
import { router } from 'expo-router';
import { useTheme } from '@/providers/ThemeProvider';

const localeCurrency = Intl.NumberFormat().resolvedOptions().locale.startsWith('en-US')
  ? 'USD'
  : 'INR';

export default function OnboardingScreen() {
  const [currency, setCurrency] = useState(localeCurrency);
  const [accountName, setAccountName] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.background,
        paddingHorizontal: 24,
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 20,
      }}
    >
      <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
        <ArrowLeft size={21} color={tokens.foreground} />
      </IconButton>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <View style={{ gap: 12 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: tokens.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Coins size={24} color={tokens.primaryForeground} weight="bold" />
          </View>
          <Typography variant="display">Make it yours.</Typography>
          <Text style={{ color: tokens.mutedForeground, fontSize: 15, lineHeight: 22 }}>
            A couple of choices now keep your ledger effortless later.
          </Text>
        </View>
        <View style={{ gap: 18 }}>
          <Select
            label="Default currency"
            options={['INR', 'USD', 'EUR', 'GBP']}
            value={currency}
            onChange={setCurrency}
          />
          <View>
            <Label>
              First account{' '}
              <Text
                style={{
                  color: tokens.mutedForeground,
                  fontFamily: 'PlusJakartaSans_400Regular',
                  textTransform: 'none',
                  letterSpacing: 0,
                }}
              >
                (optional)
              </Text>
            </Label>
            <Input
              accessibilityLabel="First account name"
              placeholder="e.g. Main bank"
              value={accountName}
              onChangeText={setAccountName}
            />
          </View>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Button size="lg" onPress={() => router.replace('/(tabs)')}>
          <Wallet size={18} color={tokens.primaryForeground} weight="bold" />
          <Text
            style={{
              color: tokens.primaryForeground,
              marginLeft: 8,
              fontFamily: 'PlusJakartaSans_600SemiBold',
            }}
          >
            {accountName ? 'Create account and continue' : 'Continue'}
          </Text>
          <ArrowRight
            size={18}
            color={tokens.primaryForeground}
            weight="bold"
            style={{ marginLeft: 8 }}
          />
        </Button>
        <Button variant="ghost" onPress={() => router.replace('/(tabs)')}>
          Skip for now
        </Button>
      </View>
    </View>
  );
}
