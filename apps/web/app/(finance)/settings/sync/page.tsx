'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { readConflicts, resolveConflict, type LocalConflict } from '@/lib/offline/repository';

function summarize(record: Record<string, unknown>): string {
  const display = [record.title, record.name, record.displayName, record.type].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
  if (typeof display === 'string') return display;
  if (
    typeof record.amountMinor === 'bigint' ||
    typeof record.amountMinor === 'number' ||
    typeof record.amountMinor === 'string'
  )
    return `Amount ${String(record.amountMinor)}${typeof record.currency === 'string' ? ` ${record.currency}` : ''}`;
  return 'Saved record version';
}
function dateLabel(timestamp: number | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'Not synced yet';
}

export default function SyncSettingsPage() {
  const { userId, isConnected, isSyncing, syncError, status, retryNow } = useBrowserSync();
  const [conflicts, setConflicts] = React.useState<LocalConflict[]>([]);
  const [conflictsLoading, setConflictsLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const refreshConflicts = React.useCallback(async () => {
    if (!userId) {
      setConflicts([]);
      return;
    }
    setConflictsLoading(true);
    try {
      setConflicts(await readConflicts(userId));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not load sync conflicts.');
    } finally {
      setConflictsLoading(false);
    }
  }, [userId]);
  React.useEffect(() => {
    void refreshConflicts();
  }, [refreshConflicts, status.conflicts]);

  if (!userId)
    return (
      <FinanceSignedOut
        section="LOCAL SYNC"
        title="Keep changes moving safely."
        description="Sign in to review the local queue, retry failed changes, and choose a winner for conflicts."
      />
    );

  async function retry() {
    setBusy(true);
    setMessage('');
    try {
      await retryNow();
      await refreshConflicts();
      setMessage(
        isConnected
          ? 'Sync retry started.'
          : 'Failed changes were queued for retry when this browser reconnects.',
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not retry sync.');
    } finally {
      setBusy(false);
    }
  }

  async function choose(conflict: LocalConflict, winner: 'local' | 'cloud') {
    if (!userId) return;
    setBusy(true);
    setMessage('');
    try {
      await resolveConflict(userId, conflict.id, winner);
      await refreshConflicts();
      if (winner === 'local') await retryNow();
      setMessage(
        winner === 'local'
          ? 'Local version selected and queued for sync.'
          : 'Cloud version selected for this browser.',
      );
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not resolve this conflict.');
    } finally {
      setBusy(false);
    }
  }

  const syncLabel = isSyncing
    ? 'Syncing'
    : !isConnected
      ? 'Offline'
      : status.failed || status.conflicts
        ? 'Needs attention'
        : status.pending
          ? 'Saved locally'
          : 'All changes synced';

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">DATA CONTROLS</p>
          <h1>Local sync</h1>
          <p className="finance-muted">
            Changes are saved here first, then reconciled with your account.
          </p>
        </div>
        <Link className="finance-secondary-action" href="/settings">
          <ArrowLeft size={15} aria-hidden="true" /> Settings
        </Link>
      </header>

      <div className="finance-metric-grid">
        <Card className="finance-metric-card">
          <span className="finance-metric-label">CONNECTION</span>
          <strong>{syncLabel}</strong>
          <span className="finance-metric-foot">
            {isConnected
              ? 'Convex connection available'
              : 'Saved local changes remain in this browser'}
          </span>
        </Card>
        <Card className="finance-metric-card">
          <span className="finance-metric-label">WAITING</span>
          <strong>{status.pending + status.syncing}</strong>
          <span className="finance-metric-foot">
            {status.failed} failed · {status.conflicts} conflicts
          </span>
        </Card>
        <Card className="finance-metric-card">
          <span className="finance-metric-label">LAST SYNC</span>
          <strong style={{ fontSize: '1rem' }}>{dateLabel(status.lastSyncedAt)}</strong>
          <span className="finance-metric-foot">A browser copy is not a backup.</span>
        </Card>
      </div>

      {syncError && (
        <p className="finance-form-error" role="alert">
          {syncError}
        </p>
      )}
      <Card className="finance-record-panel" style={{ display: 'grid', gap: 12 }}>
        <SectionHeader
          title="Retry saved changes"
          action={<RefreshCw size={17} aria-hidden="true" />}
        />
        <p className="finance-form-note">
          Retry uses the existing outbox and mutation receipt protocol. It does not create a second
          record.
        </p>
        <Button
          onPress={() => void retry()}
          disabled={busy || isSyncing || (!status.failed && !status.pending)}
        >
          {busy ? 'Working…' : 'Retry failed and pending changes'}
        </Button>
      </Card>

      <section aria-labelledby="sync-conflicts-title" style={{ display: 'grid', gap: 12 }}>
        <SectionHeader title="Conflicts" action={<ShieldAlert size={17} aria-hidden="true" />} />
        {conflictsLoading ? (
          <p className="finance-muted" role="status">
            Loading conflict choices…
          </p>
        ) : conflicts.length === 0 ? (
          <Card className="finance-record-panel">
            <p className="finance-form-note">No unresolved local/cloud conflicts.</p>
          </Card>
        ) : (
          conflicts.map((conflict) => (
            <ConflictCard key={conflict.id} conflict={conflict} busy={busy} onChoose={choose} />
          ))
        )}
      </section>
      {message && (
        <p className="finance-settings-message" role="status">
          {message}
        </p>
      )}
      <p className="finance-data-footnote">
        Offline: retries remain queued until a connection returns. Choosing a cloud version only
        changes the local browser copy; it does not remove the cloud record.
      </p>
    </div>
  );
}

function ConflictCard({
  conflict,
  busy,
  onChoose,
}: {
  conflict: LocalConflict;
  busy: boolean;
  onChoose: (conflict: LocalConflict, winner: 'local' | 'cloud') => Promise<void>;
}) {
  return (
    <Card className="finance-record-panel" style={{ display: 'grid', gap: 14 }}>
      <SectionHeader
        title={`${conflict.entityType} · ${conflict.recordId}`}
        action={<Badge variant="neutral">Choose a version</Badge>}
      />
      <div className="finance-settings-grid">
        <div className="finance-record-item" style={{ alignItems: 'flex-start' }}>
          <div>
            <strong>Local version</strong>
            <small>{summarize(conflict.localRecord)}</small>
            <small>Updated {dateLabel(conflict.localUpdatedAt)}</small>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => void onChoose(conflict, 'local')}
          >
            Keep local <Check size={14} aria-hidden="true" />
          </Button>
        </div>
        <div className="finance-record-item" style={{ alignItems: 'flex-start' }}>
          <div>
            <strong>Cloud version</strong>
            <small>{summarize(conflict.cloudRecord)}</small>
            <small>Updated {dateLabel(conflict.cloudUpdatedAt)}</small>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onPress={() => void onChoose(conflict, 'cloud')}
          >
            Use cloud
          </Button>
        </div>
      </div>
      <p className="finance-form-note">
        Created {dateLabel(conflict.createdAt)}. Review both versions before choosing which one this
        browser should keep.
      </p>
    </Card>
  );
}
