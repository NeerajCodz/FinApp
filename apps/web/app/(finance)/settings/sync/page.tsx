'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, IconButton, Text, Typography } from '@finapp/ui/web';
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
  const router = useRouter();
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
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.push('/settings')}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Local sync</Typography>
      </header>
      <section style={{ display: 'grid', gap: 8 }}>
        <Typography variant="label">Initial download window</Typography>
        <Text style={{ maxWidth: 340 }}>
          Choose how much recent history syncs automatically. Changing this setting backfills cloud
          data; it never removes older history already downloaded to this device.
        </Text>
      </section>
      <div style={{ display: 'grid', gap: 8 }} role="radiogroup" aria-label="Initial download window">
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
              style={{ minHeight: 54, justifyContent: 'space-between' }}
            >
              <span>{option.label}</span>
              {selected && <Check size={18} aria-hidden="true" />}
            </Button>
          );
        })}
      </div>
      {!!error && <Text role="alert">{error}</Text>}
      {saving && <Text role="status">Saving and scheduling backfill…</Text>}
    </div>
  );
}
