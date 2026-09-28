import React from 'react';
import { Check, History, TriangleAlert } from 'lucide-react';
import { Button, Sheet, Text, Typography } from '@finapp/ui/web';
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
  const hasIssue = status.failed > 0 || status.conflicts > 0 || Boolean(syncError);
  const state = !isSignedIn
    ? 'sign-in'
    : hasIssue
      ? 'attention'
      : !isConnected
        ? 'offline'
        : isSyncing
          ? 'syncing'
          : status.pending > 0
            ? 'pending'
            : 'synced';
  const copy = {
    'sign-in': {
      title: 'Sign in to sync',
      description:
        'Sign in to connect this device to your cloud account. Changes stay on this device.',
    },
    attention: {
      title: 'Needs attention',
      description: 'Some changes need a retry or conflict decision.',
    },
    offline: {
      title: 'Offline',
      description: 'Changes stay on this device and sync after you reconnect.',
    },
    syncing: {
      title: 'Syncing now',
      description: 'Your latest changes are moving to your cloud account.',
    },
    pending: {
      title: 'Changes waiting',
      description: 'Changes are saved on this device and waiting to sync.',
    },
    synced: {
      title: 'Up to date',
      description: 'Your changes are synced across your devices.',
    },
  }[state];
  const StatusIcon =
    state === 'synced'
      ? Check
      : state === 'attention' || state === 'offline'
        ? TriangleAlert
        : History;
  const connection = !isSignedIn ? 'Not signed in' : isConnected ? 'Online' : 'Offline';
  const connectionState = !isSignedIn ? 'neutral' : isConnected ? 'online' : 'offline';
  const lastSynced = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Never';
  const metrics = [
    {
      label: 'Pending',
      value: String(status.pending),
      tone: status.pending ? 'progress' : 'neutral',
    },
    { label: 'Failed', value: String(status.failed), tone: status.failed ? 'danger' : 'neutral' },
    {
      label: 'Conflicts',
      value: String(status.conflicts),
      tone: status.conflicts ? 'danger' : 'neutral',
    },
    { label: 'Active sync', value: isSyncing ? 'Running' : 'Idle', tone: 'neutral' },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Local sync"
      className="finance-local-sync-sheet"
    >
      <div className="finance-local-sync">
        <div className="finance-sync-scroll">
          <section className="finance-sync-overview" data-state={state}>
            <span className="finance-sync-overview-icon" aria-hidden="true">
              <StatusIcon size={20} strokeWidth={2} />
            </span>
            <div className="finance-sync-overview-copy">
              <span className="finance-sync-eyebrow">SYNC STATUS</span>
              <Typography as="h3" variant="heading" className="finance-sync-title">
                {copy.title}
              </Typography>
              <Text className="finance-sync-description">{copy.description}</Text>
            </div>
          </section>

          <div className="finance-sync-metrics" role="group" aria-label="Sync summary">
            {metrics.map((metric) => (
              <div className="finance-sync-metric" data-tone={metric.tone} key={metric.label}>
                <span className="finance-sync-metric-label">{metric.label}</span>
                <strong className="finance-sync-metric-value">{metric.value}</strong>
              </div>
            ))}
          </div>

          <div className="finance-sync-details">
            <div className="finance-sync-detail-row">
              <Text>Connection</Text>
              <span className="finance-sync-connection" data-state={connectionState}>
                <span aria-hidden="true" />
                {connection}
              </span>
            </div>
            <div className="finance-sync-detail-row">
              <Text>Last successful sync</Text>
              <Text className="finance-sync-last-synced">{lastSynced}</Text>
            </div>
          </div>

          {failedEntries.length > 0 && (
            <section className="finance-sync-issues" aria-label="Failed changes">
              <Typography as="h4" variant="small" className="finance-sync-section-title">
                Failed changes
              </Typography>
              {failedEntries.map((entry) => (
                <div className="finance-sync-issue" key={entry.localId}>
                  <Typography as="h5" variant="small" className="finance-sync-issue-title">
                    {entry.operation}
                  </Typography>
                  <Text className="finance-sync-issue-copy">
                    {entry.lastError ?? 'Cloud rejected this change.'}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSyncing}
                    onPress={() => onRetryEntry(entry.localId)}
                  >
                    Retry this change
                  </Button>
                </div>
              ))}
            </section>
          )}

          {conflicts.length > 0 && (
            <section className="finance-sync-issues" aria-label="Sync conflicts">
              <Typography as="h4" variant="small" className="finance-sync-section-title">
                Conflicts
              </Typography>
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
                  <div className="finance-sync-issue" key={conflict.id}>
                    <Typography as="h5" variant="small" className="finance-sync-issue-title">
                      {conflict.entityType} · {conflict.recordId}
                    </Typography>
                    <Text className="finance-sync-issue-copy">On this device: {localValue}</Text>
                    <Text className="finance-sync-issue-copy">In cloud: {cloudValue}</Text>
                    <div className="finance-sync-conflict-actions">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSyncing}
                        onPress={() => onResolveConflict(conflict.id, 'local')}
                      >
                        Keep this device
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
            </section>
          )}

          {!!syncError && (
            <div className="finance-sync-error-banner" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <Text>{syncError}</Text>
            </div>
          )}
        </div>

        <div className="finance-sync-actions">
          <Button size="lg" disabled={!isSignedIn || isSyncing} onPress={onRetry}>
            <History size={17} aria-hidden="true" />
            <Text>Retry now</Text>
          </Button>
          <Button variant="outline" onPress={onOpenSettings}>
            Local sync settings
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
