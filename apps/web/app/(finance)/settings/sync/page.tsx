'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, CloudOff, History, TriangleAlert } from 'lucide-react';
import { Button } from '@finapp/ui/web';
import { SettingsGroup, SettingsHero, SettingsLink, SettingsShell } from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import type { LocalSyncWindow } from '@/lib/offline/repository';

const syncWindowOptions: { value: LocalSyncWindow; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' },
  { value: 'all', label: 'Everything' },
];

export default function SyncSettingsPage() {
  const router = useRouter();
  const {
    userId,
    syncWindow,
    setSyncWindow,
    isConnected,
    isSyncing,
    syncError,
    failedEntries,
    conflicts,
    retryNow,
  } = useBrowserSync();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

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

  if (!userId)
    return (
      <FinanceSignedOut
        section="LOCAL SYNC"
        title="Choose your download window."
        description="Sign in to configure how much recent history is downloaded to this browser."
      />
    );

  const problems = failedEntries.length + conflicts.length;
  return (
    <SettingsShell
      title="Sync"
      subtitle="Offline copy and syncing"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={
          !isConnected ? (
            <CloudOff size={22} />
          ) : problems ? (
            <TriangleAlert size={22} />
          ) : (
            <Cloud size={22} />
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
            ? 'Changes save in this browser and sync when you reconnect.'
            : (syncError ??
              'Finapp keeps a copy in this browser so it opens fast and works offline.')
        }
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={!isConnected || isSyncing}
            onPress={() => void retryNow()}
          >
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
        }
      />
      {problems ? (
        <SettingsGroup title="Needs attention">
          <SettingsLink
            icon={<TriangleAlert size={19} />}
            tone="warning"
            title={`${failedEntries.length} failed, ${conflicts.length} conflicting`}
            description="Review and retry or choose which version to keep"
            onPress={() => router.push('/notifications')}
          />
        </SettingsGroup>
      ) : null}
      <SettingsGroup
        title="History in this browser"
        description="How far back to download automatically. Older items load when you open them; nothing already here is removed."
      >
        <div role="radiogroup" aria-label="History in this browser" style={{ display: 'grid' }}>
          {syncWindowOptions.map((option) => (
            <SettingsLink
              key={String(option.value)}
              icon={<History size={19} />}
              tone={syncWindow === option.value ? 'primary' : undefined}
              title={option.label}
              badge={syncWindow === option.value ? 'Selected' : undefined}
              onPress={
                saving || syncWindow === option.value
                  ? undefined
                  : () => void selectWindow(option.value)
              }
            />
          ))}
        </div>
      </SettingsGroup>
      {error ? (
        <p
          role="alert"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-destructive)' }}
        >
          {error}
        </p>
      ) : null}
    </SettingsShell>
  );
}
