import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, CaretRight, Check, Landmark } from '@/lib/icons';
import { router } from 'expo-router';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Label, Sheet, Text, Typography } from '@finapp/ui/native';
import { CurrencyInput } from '@/components/finance';
import { parseMinor } from '@/lib/money';
import { useTheme } from '@finapp/ui/native';

type ProfileRecord = LocalRecord & {
  defaultCurrency?: string;
};
const ACCOUNT_TYPES = [
  { label: 'Cash', value: 'cash' },
  { label: 'Bank', value: 'bank' },
  { label: 'Card', value: 'card' },
  { label: 'Wallet', value: 'wallet' },
  { label: 'Loan', value: 'loan' },
  { label: 'Custom', value: 'other' },
] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number]['value'];

export default function NewAccountScreen() {
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [customType, setCustomType] = useState('');
  const [typeOpen, setTypeOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<ProfileRecord>(userId, 'profile');
  if (profileState.error) throw profileState.error;
  const profile = profileState.data?.[0] ?? (profileState.loading ? undefined : null);

  async function save() {
    const trimmedName = name.trim();
    if (!userId || !trimmedName || pending || !profile?.defaultCurrency) return;
    const customTypeLabel = customType.trim();
    if (type === 'other' && !customTypeLabel) {
      setError('Name your custom account type.');
      return;
    }
    let openingBalanceMinor = 0n;
    if (openingBalance.trim()) {
      try {
        openingBalanceMinor = parseMinor(openingBalance, profile.defaultCurrency);
        if (openingBalanceMinor < 0n) throw new Error('INVALID_AMOUNT');
      } catch {
        setError('Enter a valid opening balance.');
        return;
      }
    }
    setPending(true);
    setError('');
    try {
      const now = Date.now();
      await commitLocalWrite(
        userId,
        'account',
        'account.create',
        {
          ownerId: userId,
          name: trimmedName,
          type,
          customType: type === 'other' ? customTypeLabel : undefined,
          currency: profile.defaultCurrency,
          openingBalanceMinor,
          balanceMinor: openingBalanceMinor,
          isIncludedInTotal: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          name: trimmedName,
          type,
          customType: type === 'other' ? customTypeLabel : undefined,
          currency: profile.defaultCurrency,
          openingBalanceMinor,
          isIncludedInTotal: true,
        },
      );
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create account.');
    } finally {
      setPending(false);
    }
  }
  return (
    <>
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
            gap: 24,
          }}
        >
          <IconButton
            label="Go back"
            variant="ghost"
            style={{ alignSelf: 'flex-start' }}
            onPress={() => router.back()}
          >
            <ArrowLeft size={21} color={tokens.foreground} />
          </IconButton>
          <View style={{ gap: 10 }}>
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
              <Landmark size={21} color={tokens.foreground} />
            </View>
            <Typography variant="title">Add an account</Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
              Name where you keep money, then choose how it appears in your accounts.
            </Text>
          </View>
          <View style={{ gap: 18 }}>
            <View>
              <Label>Name</Label>
              <Input
                accessibilityLabel="Account name"
                value={name}
                onChangeText={setName}
                placeholder="Everyday account"
                returnKeyType="next"
              />
            </View>
            <View style={{ gap: 6 }}>
              <Label>Type</Label>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Account type"
                accessibilityValue={{
                  text: ACCOUNT_TYPES.find((option) => option.value === type)?.label,
                }}
                accessibilityHint="Opens account type choices"
                onPress={() => setTypeOpen(true)}
                style={{
                  minHeight: 50,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.surfaceSubtle,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text>{ACCOUNT_TYPES.find((option) => option.value === type)?.label}</Text>
                <CaretRight
                  size={18}
                  color={tokens.foregroundMuted}
                  style={{ transform: [{ rotate: '90deg' }] }}
                />
              </Pressable>
            </View>
            {type === 'other' && (
              <View>
                <Label>Custom type</Label>
                <Input
                  accessibilityLabel="Custom account type"
                  value={customType}
                  onChangeText={setCustomType}
                  placeholder="e.g. Investment"
                  maxLength={40}
                />
              </View>
            )}
            {profile?.defaultCurrency && (
              <View>
                <Label>Opening balance · {profile.defaultCurrency}</Label>
                <CurrencyInput
                  currency={profile.defaultCurrency}
                  value={openingBalance}
                  onChangeText={setOpeningBalance}
                />
              </View>
            )}
            {profile === undefined ? (
              <Typography variant="small">Loading your default currency…</Typography>
            ) : profile === null ? (
              <Typography style={{ color: tokens.destructive }}>
                Sign in to create an account.
              </Typography>
            ) : !profile.defaultCurrency ? (
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.push('/settings/currency' as never)}
              >
                Set your default currency
              </Button>
            ) : null}
          </View>
          <View style={{ flex: 1 }} />
          {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
          <Button
            size="lg"
            disabled={
              !name.trim() ||
              pending ||
              !profile?.defaultCurrency ||
              (type === 'other' && !customType.trim())
            }
            onPress={save}
          >
            {pending ? 'Saving…' : 'Save account'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
      <Sheet visible={typeOpen} title="Account type" onClose={() => setTypeOpen(false)}>
        {ACCOUNT_TYPES.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: type === option.value }}
            accessibilityLabel={option.label}
            onPress={() => {
              setType(option.value);
              setTypeOpen(false);
              setError('');
            }}
            style={{
              minHeight: 48,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: type === option.value ? tokens.surfaceRaised : 'transparent',
            }}
          >
            <Text>{option.label}</Text>
            {type === option.value && <Check size={19} color={tokens.primary} />}
          </Pressable>
        ))}
      </Sheet>
    </>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        gap: 12,
        backgroundColor: tokens.background,
      }}
    >
      <Typography variant="heading">Could not load account setup.</Typography>
      <Typography variant="small">{error.message}</Typography>
      <Button onPress={retry}>Try again</Button>
    </View>
  );
}
