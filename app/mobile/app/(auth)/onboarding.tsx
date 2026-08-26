import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ArrowLeft, ArrowRight, UsersThree, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BrandMark } from '@/components/finance';
import {
  Button,
  IconButton,
  Input,
  Label,
  Progress,
  Tabs,
  Text,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const localeCurrency = Intl.NumberFormat().resolvedOptions().locale.startsWith('en-US')
  ? 'USD'
  : 'INR';

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(localeCurrency);
  const [accountName, setAccountName] = useState('');
  const [mode, setMode] = useState('personal');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  const canContinue = step !== 1 || accountName.trim().length > 0;
  function goBack() {
    if (step === 0) router.back();
    else setStep((current) => current - 1);
  }
  function goForward() {
    if (step < 2) setStep((current) => current + 1);
    else router.replace('/(tabs)');
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <IconButton label="Go back" variant="ghost" onPress={goBack}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <BrandMark />
          <Typography variant="caption" style={{ marginLeft: 'auto' }}>
            {step + 1} / 3
          </Typography>
        </View>
        <Progress value={((step + 1) / 3) * 100} color={tokens.primary} height={2} />

        <View style={{ flex: 1, justifyContent: 'center', gap: 32, paddingVertical: 40 }}>
          {step === 0 && (
            <>
              <View style={{ gap: 12 }}>
                <Typography variant="title">Your money,{`\n`}your format.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
                  Choose the currency Finapp should use for balances and everyday entries.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['INR', 'USD', 'EUR', 'GBP'].map((option) => (
                  <Button
                    key={option}
                    variant={currency === option ? 'primary' : 'outline'}
                    onPress={() => setCurrency(option)}
                    style={{ flex: 1 }}
                  >
                    {option}
                  </Button>
                ))}
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: tokens.surfaceRaised,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wallet size={21} color={tokens.foreground} />
                </View>
                <Typography variant="title">Add your first{`\n`}account.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
                  A simple name is enough. You can add balances and more accounts later.
                </Text>
              </View>
              <View>
                <Label>Account name</Label>
                <Input
                  accessibilityLabel="Account name"
                  autoFocus
                  placeholder="HDFC, Cash, Savings"
                  value={accountName}
                  onChangeText={setAccountName}
                  returnKeyType="done"
                  onSubmitEditing={goForward}
                />
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: tokens.surfaceRaised,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UsersThree size={21} color={tokens.foreground} />
                </View>
                <Typography variant="title">How will you{`\n`}use Finapp?</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
                  Start personal-only or keep shared expenses ready from day one.
                </Text>
              </View>
              <Tabs
                value={mode}
                onChange={setMode}
                tabs={[
                  { label: 'Personal', value: 'personal' },
                  { label: 'Personal + groups', value: 'shared' },
                ]}
              />
              <Typography variant="caption">
                {mode === 'shared'
                  ? 'Groups and split tools will stay close at hand.'
                  : 'Shared finance remains available whenever you need it.'}
              </Typography>
            </>
          )}
        </View>

        <View style={{ gap: 10 }}>
          <Button size="lg" disabled={!canContinue} onPress={goForward}>
            <Text
              style={{
                color: tokens.primaryForeground,
                fontFamily: 'SpaceGrotesk_600SemiBold',
                fontSize: 15,
              }}
            >
              {step === 2 ? 'Enter Finapp' : 'Continue'}
            </Text>
            <ArrowRight size={18} color={tokens.primaryForeground} style={{ marginLeft: 8 }} />
          </Button>
          {step === 1 && (
            <Button variant="ghost" onPress={() => setStep(2)}>
              Skip for now
            </Button>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
