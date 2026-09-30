import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '@convex/_generated/api';
import { useQuery } from 'convex/react';
import { currencies } from '@convex/shared/validators';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { commitLocalWrite } from '@/local/commands';
import { Avatar, Button, Input, Label, Progress, Tabs, Typography, useTheme } from '@finapp/ui/native';
import { AuthScaffold } from '@/components/auth/AuthScaffold';
import { AuthError, AuthSubmit } from '@/components/auth/AuthFields';
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
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [accountName, setAccountName] = useState('');
  const [gender, setGender] = useState<'neutral' | 'male' | 'female'>('neutral');
  const [avatarId, setAvatarId] = useState('AV0');
  const [mode, setMode] = useState('personal');
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profileState.data?.[0];
  const avatarCatalog = useQuery(api.avatars.queries.list, {});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { tokens } = useTheme();
  const { width } = useWindowDimensions();
  React.useEffect(() => {
    if (typeof profile?.displayName === 'string' && !displayName)
      setDisplayName(profile.displayName);
    if (typeof profile?.username === 'string' && !username) setUsername(profile.username);
    if (profile?.gender === 'neutral' || profile?.gender === 'male' || profile?.gender === 'female')
      setGender(profile.gender);
    if (typeof profile?.avatarId === 'string') setAvatarId(profile.avatarId);
  }, [
    displayName,
    profile?.avatarId,
    profile?.displayName,
    profile?.gender,
    profile?.username,
    username,
  ]);
  const handle = normalizeHandle(username);
  const normalizedCurrencySearch = currencySearch.trim().toLowerCase();
  const currencyOptions = currencies.filter((code) => {
    const searchable = `${currencyCountries[code]} ${code} ${currencyLabel(code)}`.toLowerCase();
    return searchable.includes(normalizedCurrencySearch);
  });
  const visibleAvatars = (avatarCatalog ?? []).filter((avatar) => avatar.gender === gender);
  const selectedAvatar = visibleAvatars.find((avatar) => avatar.avatarId === avatarId);
  const canContinue =
    step !== 1 || (!!displayName.trim() && /^[a-z0-9_]{3,32}$/.test(handle) && !!selectedAvatar);
  const continueDisabled =
    pending ||
    (step === totalSteps - 1 && (!userId || profileState.loading || !!profileState.error));

  function goBack() {
    if (pending) return;
    if (step === 0) {
      if (router.canGoBack()) router.back();
      else router.replace('/(auth)/sign-in');
    } else {
      setStep((current) => current - 1);
    }
  }

  async function goForward() {
    setError('');
    if (pending || continueDisabled) return;
    if (!canContinue) {
      setError('Enter your display name, a valid username, and choose an avatar.');
      return;
    }
    if (step < totalSteps - 1) {
      setStep((current) => current + 1);
      return;
    }
    setPending(true);
    try {
      if (!userId) throw new Error('AUTH_REQUIRED');
      const profileUpdate = {
        displayName: displayName.trim(),
        username: handle,
        phone: phone.trim() || undefined,
        defaultCurrency: currency,
        avatarId,
        gender,
      };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        { ...(profile ?? {}), ...profileUpdate, avatarUrl: selectedAvatar?.url },
        profileUpdate,
        { recordId: String(profile?.id ?? profile?._id ?? userId) },
      );
      const trimmedAccountName = accountName.trim();
      if (trimmedAccountName) {
        const now = Date.now();
        await commitLocalWrite(
          userId,
          'account',
          'account.create',
          {
            ownerId: userId,
            name: trimmedAccountName,
            type: 'cash',
            currency,
            openingBalanceMinor: 0n,
            balanceMinor: 0n,
            isIncludedInTotal: true,
            createdAt: now,
            updatedAt: now,
          },
          {
            name: trimmedAccountName,
            type: 'cash',
            currency,
            openingBalanceMinor: 0n,
            isIncludedInTotal: true,
          },
        );
      }
      router.replace(mode === 'shared' ? '/(tabs)/groups' : '/(tabs)');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile');
    } finally {
      setPending(false);
    }
  }

  const titles = [
    'Your money.\nYour format.',
    'Make it\nyours.',
    'Stay easy\nto find.',
    'Start with\none account.',
    'Your money.\nYour people.',
  ];
  const descriptions = [
    'Choose the currency you use every day. You can change it later.',
    'Your @handle helps people find you for groups and split expenses.',
    'Optional. Add a phone number so people can find you when sharing expenses.',
    'Optional for now. A simple account name is enough to get started.',
    'Start with personal finances or keep shared expenses ready from day one.',
  ];

  return (
    <>
      <AuthScaffold
        eyebrow="Make it yours"
        title={titles[step]}
        description={descriptions[step]}
        onBack={goBack}
        headerRight={
          <Typography
            variant="small"
            style={{ fontVariant: ['tabular-nums'], color: tokens.primary }}
          >
            {step + 1} / {totalSteps}
          </Typography>
        }
      >
        <Progress value={((step + 1) / totalSteps) * 100} color={tokens.primary} height={3} />
        {step === 0 && (
          <View style={{ gap: 12 }}>
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
            <Typography variant="small" style={{ color: tokens.primary }}>
              {currencyLabel(currency)}
            </Typography>
          </View>
        )}
        {step === 1 && (
          <View style={{ gap: 8 }}>
            <Label style={{ marginBottom: 0 }}>Display name</Label>
            <Input
              accessibilityLabel="Display name"
              autoComplete="name"
              placeholder="Your name"
              value={displayName}
              onChangeText={(value) => {
                setDisplayName(value);
                setError('');
              }}
              editable={!pending}
              returnKeyType="next"
            />
            <Label style={{ marginBottom: 0 }}>Username</Label>
            <Input
              accessibilityLabel="Username"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username-new"
              textContentType="username"
              placeholder="@yourname"
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setError('');
              }}
              returnKeyType="next"
              onSubmitEditing={goForward}
              error={!!error}
            />
            <Typography variant="small">
              {handle && canContinue
                ? `You’ll share as @${handle}`
                : 'Use 3–32 letters, numbers or underscores.'}
            </Typography>
            <Label style={{ marginBottom: 0 }}>Gender</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['neutral', 'male', 'female'] as const).map((option) => (
                <Button
                  key={option}
                  variant={gender === option ? 'primary' : 'outline'}
                  disabled={pending}
                  onPress={() => {
                    setGender(option);
                    const first = (avatarCatalog ?? []).find((avatar) => avatar.gender === option);
                    if (first) setAvatarId(first.avatarId);
                  }}
                  accessibilityLabel={`Choose ${option} avatar category`}
                  style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Button>
              ))}
            </View>
            <Label style={{ marginBottom: 0 }}>Choose an avatar</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
                {visibleAvatars.map((avatar) => (
                  <Button
                    key={avatar.avatarId}
                    variant={avatarId === avatar.avatarId ? 'primary' : 'outline'}
                    disabled={pending}
                    accessibilityLabel={`Select avatar ${avatar.avatarId}`}
                    accessibilityState={{ selected: avatarId === avatar.avatarId }}
                    onPress={() => setAvatarId(avatar.avatarId)}
                    style={{ width: 58, height: 58, padding: 3, borderRadius: 999 }}
                  >
                    <Avatar initials="" label={avatar.avatarId} imageUrl={avatar.url} size={48} />
                  </Button>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
        {step === 2 && (
          <View style={{ gap: 8 }}>
            <Label style={{ marginBottom: 0 }}>Phone number · optional</Label>
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
        )}
        {step === 3 && (
          <View style={{ gap: 8 }}>
            <Label style={{ marginBottom: 0 }}>Account name · optional</Label>
            <Input
              accessibilityLabel="Account name"
              autoFocus
              autoComplete="off"
              placeholder="Cash, savings, everyday"
              value={accountName}
              onChangeText={setAccountName}
              returnKeyType="next"
              onSubmitEditing={goForward}
            />
          </View>
        )}
        {step === 4 && (
          <View style={{ gap: 16 }}>
            <Tabs
              value={mode}
              onChange={(value) => {
                if (!pending) setMode(value);
              }}
              tabs={[
                { label: 'Personal', value: 'personal' },
                { label: 'Personal + groups', value: 'shared' },
              ]}
            />
            <Typography variant="small">
              {mode === 'shared'
                ? 'Groups and split tools will stay close at hand.'
                : 'Shared finance is available whenever you need it.'}
            </Typography>
            {(!userId || profileState.loading) && (
              <Typography variant="small" accessibilityLiveRegion="polite">
                Preparing your account…
              </Typography>
            )}
            {profileState.error && (
              <>
                <AuthError message={profileState.error.message} />
                <Button variant="ghost" onPress={profileState.retry}>
                  Reload profile
                </Button>
              </>
            )}
          </View>
        )}
        <AuthError message={error} />
        <AuthSubmit
          label={
            pending ? 'Saving your setup…' : step === totalSteps - 1 ? 'Enter Finapp' : 'Continue'
          }
          pending={pending}
          disabled={continueDisabled}
          onPress={goForward}
        />
        {(step === 2 || step === 3) && (
          <Button variant="ghost" onPress={goForward}>
            Skip for now
          </Button>
        )}
      </AuthScaffold>
      <Modal
        visible={currencyOpen}
        animationType="slide"
        onRequestClose={() => {
          setCurrencyOpen(false);
          setCurrencySearch('');
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: tokens.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View
              style={{
                flex: 1,
                width: '100%',
                maxWidth: 560,
                alignSelf: 'center',
                paddingHorizontal: width < 360 ? 16 : 24,
                paddingTop: 12,
                paddingBottom: 16,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Typography accessibilityRole="header" variant="heading" style={{ flex: 1 }}>
                  Country and currency
                </Typography>
                <Button
                  variant="ghost"
                  onPress={() => {
                    setCurrencyOpen(false);
                    setCurrencySearch('');
                  }}
                >
                  Done
                </Button>
              </View>
              <Input
                accessibilityLabel="Search countries and currencies"
                autoFocus
                autoCorrect={false}
                placeholder="Search India, INR, rupee…"
                value={currencySearch}
                onChangeText={setCurrencySearch}
              />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 6, paddingBottom: 16 }}
              >
                {currencyOptions.map((option) => (
                  <Button
                    key={option}
                    variant={currency === option ? 'primary' : 'ghost'}
                    accessibilityState={{ selected: currency === option }}
                    onPress={() => {
                      setCurrency(option);
                      setCurrencyOpen(false);
                      setCurrencySearch('');
                    }}
                    style={{ justifyContent: 'flex-start', minHeight: 52 }}
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
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
