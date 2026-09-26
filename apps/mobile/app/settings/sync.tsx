import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check } from '@/lib/icons';
import { Button, IconButton, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalSyncWindow } from '@/local/repository';

const options: { value: LocalSyncWindow; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' },
  { value: 'all', label: 'All history' },
];

export default function SyncSettingsScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { syncWindow, setSyncWindow } = useLocalSync();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function selectWindow(value: LocalSyncWindow) {
    if (saving || value === syncWindow) return;
    setSaving(true);
    setError('');
    try {
      await setSyncWindow(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the sync window.');
    } finally {
      setSaving(false);
    }
  }

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
        <Typography variant="title">Local sync</Typography>
      </View>
      <View style={{ gap: 8 }}>
        <Typography variant="label">Initial download window</Typography>
        <Text style={{ color: tokens.foregroundMuted, maxWidth: 340 }}>
          Choose how much recent history syncs automatically. Changing this setting backfills cloud
          data; it never removes older history already downloaded to this device.
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {options.map((option) => {
          const selected = syncWindow === option.value;
          return (
            <Button
              key={String(option.value)}
              variant={selected ? 'primary' : 'outline'}
              disabled={saving}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: saving }}
              onPress={() => void selectWindow(option.value)}
              style={{ minHeight: 54, justifyContent: 'space-between' }}
            >
              <Typography
                variant="bodyLarge"
                style={{ color: selected ? tokens.primaryForeground : tokens.foreground }}
              >
                {option.label}
              </Typography>
              {selected && <Check size={18} color={tokens.primaryForeground} />}
            </Button>
          );
        })}
      </View>
      {!!error && <Typography style={{ color: tokens.destructive }}>{error}</Typography>}
      {saving && <Typography variant="caption">Saving and scheduling backfill…</Typography>}
    </ScrollView>
  );
}
