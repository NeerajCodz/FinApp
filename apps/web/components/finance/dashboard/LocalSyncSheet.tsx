import React from 'react';
import { Button, Sheet, Text, Typography, useTheme } from '@finapp/ui/web';
import type { LocalConflict, LocalSyncStatus, OutboxEntry } from '@/lib/offline/repository';

export function LocalSyncSheet({
  visible,
  isSignedIn = true,
  isConnected,
  isSyncing,
  status,
  failedEntries,
  conflicts,
  syncError,
  onClose,
  onRetry,
  onRetryEntry,
  onResolveConflict,
  onOpenSettings,
}: {
  visible: boolean;
  isSignedIn?: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  status: LocalSyncStatus;
  failedEntries: readonly OutboxEntry[];
  conflicts: readonly LocalConflict[];
  syncError: string | null;
  onClose: () => void;
  onRetry: () => void;
  onRetryEntry: (localId: string) => void;
  onResolveConflict: (conflictId: string, winner: 'local' | 'cloud') => void;
  onOpenSettings: () => void;
}) {
  const { tokens } = useTheme();
  const hasIssue = status.failed > 0 || status.conflicts > 0;
  return (
    <Sheet visible={visible} onClose={onClose} title="Local sync">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <Typography variant="heading">
            {!isSignedIn
              ? 'Sign in to sync'
              : !isConnected
                ? 'Offline'
                : isSyncing
                  ? 'Syncing changes'
                  : hasIssue
                    ? 'Action needed'
                    : status.pending > 0
                      ? 'Changes pending'
                      : 'Up to date'}
          </Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            {!isSignedIn
              ? 'Sign in to connect this device to your cloud account. Local changes stay on this device.'
              : !isConnected
                ? 'Your cached records stay available. New edits are queued on this device.'
                : 'Local changes sync to your cloud account when connected.'}
          </Text>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Text>
            Connection: {!isSignedIn ? 'Not signed in' : isConnected ? 'Online' : 'Offline'}
          </Text>
          <Text>Pending: {status.pending}</Text>
          <Text>Active sync: {isSyncing ? 'Yes' : 'No'}</Text>
          <Text>Failed: {status.failed}</Text>
          <Text>Conflicts: {status.conflicts}</Text>
          <Text>
            Last successful cloud sync:{' '}
            {status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}
          </Text>
        </div>
        {failedEntries.length > 0 && (
          <div style={{ display: 'grid', maxHeight: 220, gap: 10, overflowY: 'auto' }}>
            {failedEntries.map((entry) => (
              <div key={entry.localId} style={{ display: 'grid', gap: 5 }}>
                <Typography variant="small">{entry.operation}</Typography>
                <Text style={{ color: tokens.destructive }}>
                  {entry.lastError ?? 'Cloud rejected this change.'}
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSyncing}
                  onPress={() => onRetryEntry(entry.localId)}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Retry this change
                </Button>
              </div>
            ))}
          </div>
        )}
        {conflicts.length > 0 && (
          <div style={{ display: 'grid', maxHeight: 260, gap: 12, overflowY: 'auto' }}>
            {conflicts.map((conflict) => {
              const localValue = String(
                conflict.localRecord.title ??
                  conflict.localRecord.name ??
                  conflict.localRecord.amountMinor ??
                  'Local version',
              );
              const cloudValue = String(
                conflict.cloudRecord.title ??
                  conflict.cloudRecord.name ??
                  conflict.cloudRecord.amountMinor ??
                  'Cloud version',
              );
              return (
                <div key={conflict.id} style={{ display: 'grid', gap: 6 }}>
                  <Typography variant="small">
                    {conflict.entityType} · {conflict.recordId}
                  </Typography>
                  <Text style={{ color: tokens.foregroundMuted }}>Local: {localValue}</Text>
                  <Text style={{ color: tokens.foregroundMuted }}>Cloud: {cloudValue}</Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSyncing}
                      onPress={() => onResolveConflict(conflict.id, 'local')}
                    >
                      Keep local
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSyncing}
                      onPress={() => onResolveConflict(conflict.id, 'cloud')}
                    >
                      Use cloud
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!!syncError && <Typography style={{ color: tokens.destructive }}>{syncError}</Typography>}
        <Button size="lg" disabled={!isSignedIn || isSyncing} onPress={onRetry}>
          Retry now
        </Button>
        <Button variant="outline" onPress={onOpenSettings}>
          Local sync settings
        </Button>
      </div>
    </Sheet>
  );
}
