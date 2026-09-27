'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import type { LocalSyncWindow } from '@/lib/offline/repository';

const syncWindowOptions: { value: LocalSyncWindow; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' },
  { value: 'all', label: 'All history' },
];

export default function SyncSettingsPage() {
  const { userId, syncWindow, setSyncWindow } = useBrowserSync();
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

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">DATA CONTROLS</p>
          <h1>Local sync</h1>
        </div>
        <Link className="finance-secondary-action" href="/settings">
          <ArrowLeft size={15} aria-hidden="true" /> Settings
        </Link>
      </header>
      <Card className="finance-record-panel" style={{ display: 'grid', gap: 12 }}>
        <SectionHeader title="Initial download window" />
        <p className="finance-form-note">
          Choose how much recent history syncs automatically. Changing this setting backfills cloud
          data; it never removes older history already downloaded to this device.
        </p>
        <div
          className="finance-sync-window-options"
          role="radiogroup"
          aria-label="Initial download window"
        >
          {syncWindowOptions.map((option) => {
            const selected = syncWindow === option.value;
            return (
              <Button
                key={String(option.value)}
                variant={selected ? 'primary' : 'outline'}
                disabled={saving}
                role="radio"
                aria-checked={selected}
                onPress={() => void selectWindow(option.value)}
              >
                <span>{option.label}</span>
                {selected && <Check size={18} aria-hidden="true" />}
              </Button>
            );
          })}
        </div>
        {!!error && (
          <p className="finance-form-error" role="alert">
            {error}
          </p>
        )}
        {saving && (
          <p className="finance-form-note" role="status">
            Saving and scheduling backfill…
          </p>
        )}
      </Card>
    </div>
  );
}

