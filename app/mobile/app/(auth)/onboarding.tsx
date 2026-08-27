import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight, Phone, UsersThree, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { currencies } from '@convex/shared/validators';
import { BrandMark } from '@/components/finance';
import { Button, IconButton, Input, Label, Progress, Tabs, Text, Typography } from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

const localeCurrency = Intl.NumberFormat().resolvedOptions().locale.startsWith('en-US') ? 'USD' : 'INR';
const totalSteps = 5;

function normalizeHandle(value: string) {
  return value.replace(/^@+/, '').toLowerCase();
}

function currencyLabel(currency: string) {
  try {
    const parts = new Intl.DisplayNames(['en'], { type: 'currency' });
    return parts.of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState(localeCurrency);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [mode, setMode] = useState('personal');
  const [error, setError] = useState('');
  const updateProfile = useMutation(api.users.mutations.update);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const handle = normalizeHandle(username);
  const currencyOptions = useMemo(() => [...currencies], []);
  const canContinue = step !== 1 || /^[a-z0-9_]{3,32}$/.test(handle);

  function goBack() {
    if (step === 0) router.back();
    else setStep((current) => current - 1);
  }

  async function goForward() {
    setError('');
    if (!canContinue) return;
    if (step < totalSteps - 1) {
      setStep((current) => current + 1);
      return;
    }
    try {
      await updateProfile({
        username: handle,
        phone: phone.trim() || undefined,
        defaultCurrency: currency,
      });
      router.replace('/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile');
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
          <IconButton label="Go back" variant="ghost" onPress={goBack}>
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <BrandMark />
          <Typography variant="caption" style={{ marginLeft: 'auto' }}>
            {step + 1} / {totalSteps}
          </Typography>
        </View>
        <Progress value={((step + 1) / totalSteps) * 100} color={tokens.primary} height={2} />

        <View style={{ flex: 1, justifyContent: 'center', gap: 28, paddingVertical: 32 }}>
          {step === 0 && (
            <>
              <View style={{ gap: 12 }}>
                <Typography variant="title">Your money,{`\n`}your format.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
                  Choose from every currency Finapp supports. You can change it later in Profile.
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {currencyOptions.map((option) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={currency === option ? 'primary' : 'outline'}
                    onPress={() => setCurrency(option)}
                    style={{ width: '31%', minHeight: 44 }}
                  >
                    {option}
                  </Button>
                ))}
              </View>
              <Typography variant="caption">Selected: {currencyLabel(currency)} · {currency}</Typography>
            </>
          )}

          {step === 1 && (
            <>
              <View style={{ gap: 12 }}>
                <Typography variant="title">Choose your{`\n`}username.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
                  Your @handle makes sharing groups and split expenses instant. Use letters, numbers, or underscores.
                </Text>
              </View>
              <View>
                <Label>Username</Label>
                <Input
                  accessibilityLabel="Username"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="@neeraj"
                  value={username}
                  onChangeText={setUsername}
                  returnKeyType="next"
                />
                {handle && (
                  <Typography variant="small" style={{ color: tokens.primary, marginTop: 8 }}>
                    You will share as @{handle}
                  </Typography>
                )}
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={{ gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tokens.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={21} color={tokens.foreground} />
                </View>
                <Typography variant="title">Add a phone{`\n`}number.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
                  Optional. It helps people find you when sharing a split or inviting you to a group.
                </Text>
              </View>
              <View>
                <Label>Phone number · optional</Label>
                <Input
                  accessibilityLabel="Phone number"
                  autoFocus
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChangeText={setPhone}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <View style={{ gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tokens.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
                  <Wallet size={21} color={tokens.foreground} />
                </View>
                <Typography variant="title">Add your first{`\n`}account.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
                  Optional for now. A simple name is enough to make your balance useful.
                </Text>
              </View>
              <View>
                <Label>Account name · optional</Label>
                <Input
                  accessibilityLabel="Account name"
                  autoFocus
                  placeholder="HDFC, Cash, Savings"
                  value={accountName}
                  onChangeText={setAccountName}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <View style={{ gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tokens.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
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
          {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        </View>

        <View style={{ gap: 10 }}>
          <Button size="lg" disabled={!canContinue} onPress={goForward}>
            <Text style={{ color: tokens.primaryForeground, fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 15 }}>
              {step === totalSteps - 1 ? 'Enter Finapp' : 'Continue'}
            </Text>
            <ArrowRight size={18} color={tokens.primaryForeground} style={{ marginLeft: 8 }} />
          </Button>
          {(step === 2 || step === 3) && (
            <Button variant="ghost" onPress={goForward}>Skip for now</Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
