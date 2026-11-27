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
    retryEntry,
    resolveConflict,
  } = useBrowserSync();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [resolvingConflict, setResolvingConflict] = React.useState<string | null>(null);

  async function chooseConflict(conflictId: string, winner: 'local' | 'cloud') {
    setResolvingConflict(conflictId);
    setError('');
    try {
      await resolveConflict(conflictId, winner);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resolve this conflict.');
    } finally {
      setResolvingConflict(null);
    }
  }

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
  const needsAttention = problems > 0 || Boolean(syncError);
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
          ) : needsAttention ? (
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
              : needsAttention
                ? problems
                  ? `${problems} change${problems === 1 ? '' : 's'} need attention`
                  : 'Sync needs attention'
                : 'Everything is synced'
        }
        description={
          syncError ??
          (!isConnected
            ? 'Changes save in this browser and sync when you reconnect.'
            : 'Finapp keeps a copy in this browser so it opens fast and works offline.')
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
      {needsAttention ? (
        <SettingsGroup title="Needs attention">
          {syncError ? (
            <p role="alert" style={{ margin: 0, color: 'var(--finapp-destructive)' }}>
              {syncError}
            </p>
          ) : null}
          {failedEntries.map((entry) => (
            <div
              key={entry.localId}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
            >
              <span>{entry.lastError ?? `${entry.operation} could not sync`}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={!isConnected || isSyncing}
                onPress={() =>
                  void retryEntry(entry.localId).catch((cause: unknown) =>
                    setError(cause instanceof Error ? cause.message : 'Could not retry this change.'),
                  )
                }
              >
                Retry
              </Button>
            </div>
          ))}
          {conflicts.map((conflict) => (
            <div key={conflict.id} style={{ display: 'grid', gap: 8, paddingBlock: 8 }}>
              <p style={{ margin: 0 }}>
                {conflict.entityType} {conflict.recordId} has a local and cloud version. Choose which to keep.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolvingConflict !== null}
                  onPress={() => void chooseConflict(conflict.id, 'local')}
                >
                  Keep this device
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolvingConflict !== null}
                  onPress={() => void chooseConflict(conflict.id, 'cloud')}
                >
                  Keep cloud
                </Button>
              </div>
            </div>
          ))}
          {error ? <p role="alert">{error}</p> : null}
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
