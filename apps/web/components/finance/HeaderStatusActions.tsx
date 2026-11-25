'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react';
import { LocalSyncSheet } from '@/components/finance/dashboard/LocalSyncSheet';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';

/**
 * Sync status and notifications, shown at the top right of the phone header and in the desktop
 * sidebar header. The sync icon reflects the state (synced, syncing, offline, needs attention)
 * and opens the sync sheet; the bell carries the unread count.
 */
export function HeaderStatusActions({ unread }: { unread: number }) {
  const router = useRouter();
  const {
    userId,
    isConnected,
    isSyncing,
    syncError,
    status,
    failedEntries,
    conflicts,
    retryNow,
    retryEntry,
    resolveConflict,
  } = useBrowserSync();
  const [open, setOpen] = React.useState(false);
  const attention = Boolean(syncError) || failedEntries.length > 0 || conflicts.length > 0;
  const SyncIcon = !isConnected ? CloudOff : attention ? CloudAlert : isSyncing ? RefreshCw : Cloud;
  const syncLabel = !isConnected
    ? 'Offline — sync status'
    : attention
      ? 'Sync needs attention'
      : isSyncing
        ? 'Syncing'
        : 'Synced';
  return (
    <span className="finance-status-actions">
      <button
        type="button"
        className="finance-status-button"
        data-state={
          !isConnected ? 'offline' : attention ? 'attention' : isSyncing ? 'syncing' : 'ok'
        }
        aria-label={syncLabel}
        title={syncLabel}
        onClick={() => setOpen(true)}
      >
        <SyncIcon
          size={19}
          aria-hidden="true"
          className={isSyncing && isConnected ? 'finance-spin' : undefined}
        />
      </button>
      <Link
        href="/notifications"
        className="finance-status-button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        title="Notifications"
      >
        <Bell size={19} aria-hidden="true" />
        {unread > 0 ? (
          <span className="finance-nav-badge" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Link>
      <LocalSyncSheet
        visible={open}
        isSignedIn={Boolean(userId)}
        isConnected={isConnected}
        isSyncing={isSyncing}
        status={status}
        failedEntries={failedEntries}
        conflicts={conflicts}
        syncError={syncError}
        onClose={() => setOpen(false)}
        onRetry={() => void retryNow()}
        onRetryEntry={(localId) => void retryEntry(localId)}
        onResolveConflict={(conflictId, winner) => void resolveConflict(conflictId, winner)}
        onOpenSettings={() => {
          setOpen(false);
          router.push('/settings/sync');
        }}
      />
    </span>
  );
}
