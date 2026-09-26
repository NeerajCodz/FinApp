'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card, SectionHeader } from '@finapp/ui/web';
import { currencies } from '@convex/shared/validators';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & { displayName?: string; defaultCurrency?: string };

export default function CurrencySettingsPage() {
  const { userId } = useBrowserSync();
  const { records, loading, error } = useLocalRecords<Profile>('profile');
  const profile = records[0];
  const selected = profile?.defaultCurrency ?? 'INR';
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  if (!userId)
    return (
      <FinanceSignedOut
        section="CURRENCY"
        title="Set your default unit."
        description="Sign in to choose the currency used for new accounts and financial entries."
      />
    );

  async function changeCurrency(value: string) {
    if (!userId || !currencies.includes(value as (typeof currencies)[number]) || value === selected || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const current = profile ?? { id: userId, displayName: 'Your profile' };
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        { ...current, defaultCurrency: value },
        { defaultCurrency: value },
        { recordId: String(current.id ?? current._id ?? userId) },
      );
      setMessage(`${value} is saved on this device and will sync when connected.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save the default currency.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">PREFERENCES</p>
          <h1>Currency</h1>
          <p className="finance-muted">Used for new accounts and entries. Existing records keep their original currency.</p>
        </div>
        <Link className="finance-secondary-action" href="/settings"><ArrowLeft size={15} aria-hidden="true" /> Settings</Link>
      </header>
      <Card className="finance-record-panel" style={{ display: 'grid', gap: 14 }}>
        <SectionHeader title="Default currency" action={<span>{selected}</span>} />
        {loading ? (
          <p className="finance-muted" role="status">Loading your profile…</p>
        ) : error ? (
          <p className="finance-form-error" role="alert">The saved currency could not be loaded. Reload the profile before changing it.</p>
        ) : (
          <label className="finance-form-field">
            <span>Currency for new records</span>
            <select value={selected} aria-label="Default currency" disabled={saving} onChange={(event) => void changeCurrency(event.currentTarget.value)}>
              {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
        )}
        {message && <p className="finance-settings-message" role="status">{message}</p>}
      </Card>
    </div>
  );
}
