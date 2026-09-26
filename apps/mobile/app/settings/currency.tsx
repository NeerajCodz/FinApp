import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { currencies } from '@convex/shared/validators';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { commitLocalWrite } from '@/local/commands';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Button, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';

function currencyLabel(currency: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export default function CurrencySettingsScreen() {
  const { userId } = useLocalSync();
  const profileState = useLocalRecords<LocalRecord>(userId, 'profile');
  const profile = profileState.data?.[0];
  const [currency, setCurrency] = useState('INR');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const options = useMemo(() => [...currencies], []);
  const selected =
    typeof profile?.defaultCurrency === 'string' ? profile.defaultCurrency : currency;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 24,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Currency</Typography>
      </View>
      <View style={{ gap: 12 }}>
        <Typography variant="label">Default currency</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 320 }}>
          Used for new accounts, budgets, groups, and transactions. Changing this does not rewrite
          historical entries.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={selected === option ? 'primary' : 'outline'}
              onPress={async () => {
                if (!userId) return;
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
                  {
                    recordId: String(currentProfile.id ?? currentProfile._id ?? userId),
                  },
                );
                setCurrency(option);
              }}
              style={{ width: '31%', minHeight: 44 }}
            >
              {option}
            </Button>
          ))}
        </View>
        <Typography variant="caption">
          Selected: {currencyLabel(selected)} · {selected}
        </Typography>
      </View>
    </ScrollView>
  );
}
