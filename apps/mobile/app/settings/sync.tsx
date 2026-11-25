import React, { useState } from 'react';
import { router } from 'expo-router';
import { Cloud, CloudOff, History, TriangleAlert } from 'lucide-react-native';
import { Button } from '@finapp/ui/native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsScreen,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import type { LocalSyncWindow } from '@/local/repository';

const options: { value: LocalSyncWindow; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' },
  { value: 'all', label: 'Everything' },
];

export default function SyncSettingsScreen() {
  const tone = useSettingsToneColor();
  const {
    syncWindow,
    setSyncWindow,
    isConnected,
    isSyncing,
    syncError,
    failedEntries,
    conflicts,
    retryNow,
  } = useLocalSync();
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

  const problems = failedEntries.length + conflicts.length;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));
  return (
    <SettingsScreen title="Sync" subtitle="Offline copy and syncing" onBack={back}>
      <SettingsHero
        icon={
          !isConnected ? (
            <CloudOff size={22} color={tone()} />
          ) : problems ? (
            <TriangleAlert size={22} color={tone('warning')} />
          ) : (
            <Cloud size={22} color={tone('positive')} />
          )
        }
        title={
          !isConnected
            ? 'Offline'
            : isSyncing
              ? 'Syncing…'
              : problems
                ? `${problems} change${problems === 1 ? '' : 's'} need attention`
                : 'Everything is synced'
        }
        description={
          !isConnected
            ? 'Changes save on this phone and sync when you reconnect.'
            : (syncError ?? 'Finapp keeps an encrypted copy on this phone so it works offline.')
        }
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || isSyncing}
            onPress={() => void retryNow()}
          >
            Sync now
          </Button>
        }
      />
      <SettingsGroup title="History on this phone">
        {options.map((option) => (
          <SettingsLink
            key={String(option.value)}
            icon={
              <History
                size={19}
                color={tone(syncWindow === option.value ? 'primary' : undefined)}
              />
            }
            tone={syncWindow === option.value ? 'primary' : undefined}
            title={option.label}
            value={syncWindow === option.value ? 'Selected' : undefined}
            onPress={
              saving || syncWindow === option.value
                ? undefined
                : () => void selectWindow(option.value)
            }
          />
        ))}
        <SettingsItem
          title="How this works"
          description="Items older than this load when you open them. Nothing already on this phone is removed."
        />
      </SettingsGroup>
      {error ? (
        <SettingsGroup>
          <SettingsItem title="Couldn’t change it" description={error} />
        </SettingsGroup>
      ) : null}
    </SettingsScreen>
  );
}
