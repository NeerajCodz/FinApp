import React, { useState } from 'react';
import { Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Coins, Search } from 'lucide-react-native';
import { currencies } from '@convex/shared/validators';
import { useTheme } from '@finapp/ui/native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { commitLocalWrite } from '@/local/commands';
import { toast } from '@/lib/toast';

function currencyLabel(currency: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/** The default currency for new accounts, budgets, groups and transactions. */
export default function CurrencySettingsScreen() {
  const { tokens } = useTheme();
  const tone = useSettingsToneColor();
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profileState.data?.[0];
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState('');
  const selected =
    chosen ?? (typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : 'INR');

  const choose = async (option: string) => {
    if (!userId || pending || option === selected) return;
    setPending(true);
    try {
      const currentProfile = profile ?? { id: userId, displayName: 'Your profile' };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        { ...currentProfile, defaultCurrency: option },
        {
          displayName: String(currentProfile.displayName ?? 'Your profile'),
          defaultCurrency: option,
        },
        { recordId: String(currentProfile.id ?? currentProfile._id ?? userId) },
      );
      setChosen(option);
      toast.success(`Default currency is now ${currencyLabel(option)}`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Couldn’t save the currency');
    } finally {
      setPending(false);
    }
  };

  const needle = query.trim().toLowerCase();
  const shown = currencies.filter(
    (currency) =>
      !needle ||
      currency.toLowerCase().includes(needle) ||
      currencyLabel(currency).toLowerCase().includes(needle),
  );
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <SettingsScreen title="Currency" subtitle="Your default currency" onBack={back}>
      <SettingsHero
        icon={<Coins size={22} color={tone('primary')} />}
        title={`${currencyLabel(selected)} (${selected})`}
        description="Used for new accounts, budgets, groups and transactions. Past entries keep their own currency."
      />
      <SettingsGroup title="Choose a currency">
        <SettingsItem icon={<Search size={19} color={tone()} />} title="Search">
          <TextInput
            accessibilityLabel="Search currencies"
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. euro or EUR"
            placeholderTextColor={tokens.foregroundSubtle}
            autoCorrect={false}
            autoCapitalize="none"
            style={{
              height: 40,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.surfaceSubtle,
              color: tokens.foreground,
              fontSize: 15,
            }}
          />
        </SettingsItem>
        {shown.length === 0 ? <SettingsItem title="No matching currency" /> : null}
        {shown.map((currency) => (
          <SettingsLink
            key={currency}
            icon={
              <Text
                style={{
                  color: tone(currency === selected ? 'primary' : undefined),
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {currencySymbol(currency)}
              </Text>
            }
            tone={currency === selected ? 'primary' : undefined}
            title={currencyLabel(currency)}
            value={currency === selected ? `${currency} · Default` : currency}
            onPress={pending || currency === selected ? undefined : () => void choose(currency)}
          />
        ))}
      </SettingsGroup>
    </SettingsScreen>
  );
}
