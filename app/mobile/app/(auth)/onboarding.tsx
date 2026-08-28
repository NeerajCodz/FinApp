import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { ArrowLeft, ArrowRight, Phone, UsersThree, Wallet } from '@/lib/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import { currencies } from '@convex/shared/validators';
import { BrandMark } from '@/components/finance';
import {
  Button,
  IconButton,
  Input,
  Label,
  Progress,
  Tabs,
  Text,
  Sheet,
  Typography,
} from '@/components/ui';
import { useTheme } from '@/providers/ThemeProvider';

type CurrencyCode = (typeof currencies)[number];
const localeCurrency: CurrencyCode = Intl.NumberFormat()
  .resolvedOptions()
  .locale.startsWith('en-US')
  ? 'USD'
  : 'INR';
const totalSteps = 5;

const currencyCountries: Record<CurrencyCode, string> = {
  INR: 'India',
  USD: 'United States',
  EUR: 'Eurozone',
  GBP: 'United Kingdom',
  JPY: 'Japan',
  AUD: 'Australia',
  CAD: 'Canada',
  CHF: 'Switzerland',
  CNY: 'China',
  HKD: 'Hong Kong',
  SGD: 'Singapore',
  AED: 'United Arab Emirates',
  SAR: 'Saudi Arabia',
  NZD: 'New Zealand',
  SEK: 'Sweden',
  NOK: 'Norway',
  DKK: 'Denmark',
  ZAR: 'South Africa',
  BRL: 'Brazil',
  MXN: 'Mexico',
  KRW: 'South Korea',
  TRY: 'Türkiye',
  THB: 'Thailand',
  PLN: 'Poland',
  IDR: 'Indonesia',
  MYR: 'Malaysia',
};

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
  const [currency, setCurrency] = useState<CurrencyCode>(localeCurrency);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [mode, setMode] = useState('personal');
  const [error, setError] = useState('');
  const updateProfile = useMutation(api.users.mutations.update);
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const handle = normalizeHandle(username);
  const normalizedCurrencySearch = currencySearch.trim().toLowerCase();
  const currencyOptions = currencies.filter((code) => {
    const searchable = `${currencyCountries[code]} ${code} ${currencyLabel(code)}`.toLowerCase();
    return searchable.includes(normalizedCurrencySearch);
  });
  const canContinue = step !== 1 || /^[a-z0-9_]{3,32}$/.test(handle);
  const continueDisabled = !canContinue;

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: tokens.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: insets.top + 12,
          paddingBottom: 24,
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
                  Choose the country and currency you use every day. You can change it later.
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                <Label>Country — currency</Label>
                <Button
                  accessibilityLabel="Choose country and currency"
                  size="lg"
                  variant="outline"
                  onPress={() => setCurrencyOpen(true)}
                  style={{ justifyContent: 'flex-start' }}
                >
                  {currencyCountries[currency]} — {currency}
                </Button>
                <Typography variant="caption" style={{ color: tokens.primary }}>
                  SELECTED CURRENCY
                </Typography>
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <View style={{ gap: 12 }}>
                <Typography variant="title">Choose your{`\n`}username.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
                  Your @handle makes sharing groups and split expenses instant. Use letters,
                  numbers, or underscores.
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
                  onSubmitEditing={goForward}
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
                  <Phone size={21} color={tokens.foreground} />
                </View>
                <Typography variant="title">Add a phone{`\n`}number.</Typography>
                <Text style={{ color: tokens.foregroundMuted, maxWidth: 310 }}>
                  Optional. It helps people find you when sharing a split or inviting you to a
                  group.
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
                  onSubmitEditing={goForward}
                />
              </View>
            </>
          )}

          {step === 3 && (
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
                  onSubmitEditing={goForward}
                />
              </View>
            </>
          )}

          {step === 4 && (
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
          {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        </View>
      </ScrollView>

      <View
        style={{
          gap: 8,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 14,
          borderTopWidth: 1,
          borderTopColor: tokens.borderSubtle,
          backgroundColor: tokens.background,
        }}
      >
        <Button
          accessibilityLabel={step === totalSteps - 1 ? 'Enter Finapp' : 'Continue'}
          size="lg"
          disabled={continueDisabled}
          onPress={goForward}
        >
          <Text
            style={{
              color: continueDisabled
                ? tokens.controlDisabledForeground
                : tokens.primaryForeground,
              fontFamily: 'SpaceGrotesk_600SemiBold',
              fontSize: 15,
            }}
          >
            {step === totalSteps - 1 ? 'Enter Finapp' : 'Continue'}
          </Text>
          <ArrowRight
            size={18}
            color={
              continueDisabled ? tokens.controlDisabledForeground : tokens.primaryForeground
            }
            style={{ marginLeft: 8 }}
          />
        </Button>
        {(step === 2 || step === 3) && (
          <Button variant="ghost" onPress={goForward}>
            Skip for now
          </Button>
        )}
      </View>

      <Sheet
        visible={currencyOpen}
        onClose={() => {
          setCurrencyOpen(false);
          setCurrencySearch('');
        }}
        title="Choose country and currency"
      >
        <Input
          accessibilityLabel="Search countries and currencies"
          autoFocus
          placeholder="Search India, INR, rupee…"
          value={currencySearch}
          onChangeText={setCurrencySearch}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: 460 }}
          contentContainerStyle={{ gap: 4, paddingBottom: 8 }}
        >
          {currencyOptions.map((option) => (
            <Button
              key={option}
              variant={currency === option ? 'primary' : 'ghost'}
              onPress={() => {
                setCurrency(option);
                setCurrencyOpen(false);
                setCurrencySearch('');
              }}
              style={{ justifyContent: 'flex-start' }}
            >
              {currencyCountries[option]} — {option}
            </Button>
          ))}
          {currencyOptions.length === 0 && (
            <Typography variant="small" style={{ paddingVertical: 24, textAlign: 'center' }}>
              No matching country or currency.
            </Typography>
          )}
        </ScrollView>
      </Sheet>
    </KeyboardAvoidingView>
  );
}
