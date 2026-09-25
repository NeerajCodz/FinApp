import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ArrowLeft, Landmark } from '@/lib/icons';
import { router } from 'expo-router';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import { commitLocalWrite } from '@/local/commands';
import type { LocalRecord } from '@/local/repository';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Input, Label, Tabs, Text, Typography } from '@/components/ui';
import { CurrencyInput } from '@/components/finance';
import { parseMinor } from '@/lib/money';
import { useTheme } from '@/providers/ThemeProvider';

type ProfileRecord = LocalRecord & {
  defaultCurrency?: string;
};

export default function NewAccountScreen() {
  const [name, setName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [type, setType] = useState<'cash' | 'bank' | 'card' | 'wallet' | 'loan' | 'other'>('bank');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>

        <View style={{ flex: 1, justifyContent: 'center', gap: 30 }}>
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
              <Landmark size={21} color={tokens.foreground} />
            </View>
            <Typography variant="title">Add an account.</Typography>
            <Text style={{ color: tokens.foregroundMuted, maxWidth: 300 }}>
              Give it a familiar name. Finapp never invents card details or bank branding.
            </Text>
          </View>

          <View style={{ gap: 20 }}>
            <View>
              <Label>Name</Label>
              <Input
                accessibilityLabel="Account name"
                autoFocus
                value={name}
                onChangeText={setName}
                placeholder="Everyday account"
                returnKeyType="done"
                onSubmitEditing={save}
              />
            </View>
            <View style={{ gap: 10 }}>
              <Label>Type</Label>
              <Tabs
                value={type}
                onChange={(value) => setType(value as typeof type)}
                tabs={[
                  { label: 'Cash', value: 'cash' },
                  { label: 'Bank', value: 'bank' },
                  { label: 'Card', value: 'card' },
                  { label: 'Wallet', value: 'wallet' },
                  { label: 'Loan', value: 'loan' },
                  { label: 'Other', value: 'other' },
                ]}
              />
            </View>
            {profile?.defaultCurrency && (
              <View>
                <Label>Opening balance</Label>
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
            ) : profile.defaultCurrency ? (
              <Typography variant="caption">
                New account currency: {profile.defaultCurrency}
              </Typography>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onPress={() => router.push('/settings/currency' as never)}
              >
                Set your default currency
              </Button>
            )}
          </View>
        </View>

        {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
        <Button
          size="lg"
          disabled={!name.trim() || pending || !profile?.defaultCurrency}
          onPress={save}
        >
          {pending ? 'Saving…' : 'Save account'}
        </Button>
      </View>
    </KeyboardAvoidingView>
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
