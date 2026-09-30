'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button, IconButton, Text, Typography } from '@finapp/ui/web';
import { resolveDefaultCurrency } from '@finapp/ui/finance';
import { currencies } from '@convex/shared/validators';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';

type Profile = LocalRecord & { displayName?: string; defaultCurrency?: string };
type Settings = LocalRecord & { currency?: string; defaultCurrency?: string };

function currencyLabel(currency: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export default function CurrencySettingsPage() {
  const { userId } = useBrowserSync();
  const router = useRouter();
  const profileState = useLocalRecords<Profile>('profile');
  const settingsState = useLocalRecords<Settings>('settings');
  const selected = resolveDefaultCurrency(profileState.records, settingsState.records) ?? 'INR';
  const profile =
    profileState.records.find(
      (record) =>
        typeof record.defaultCurrency === 'string' &&
        record.defaultCurrency.trim().toUpperCase() === selected,
    ) ?? profileState.records[0];
  const loading = profileState.loading || settingsState.loading;
  const error = profileState.error ?? settingsState.error;
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
    if (
      !userId ||
      !currencies.includes(value as (typeof currencies)[number]) ||
      value === selected ||
      saving
    )
      return;
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
      <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.push('/settings')}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <Typography variant="title">Currency</Typography>
      </header>
      <section style={{ display: 'grid', gap: 12 }}>
        <Typography variant="label">Default currency</Typography>
        <Text style={{ maxWidth: 320 }}>
          Used for new accounts, budgets, groups, and transactions. Changing this does not rewrite
          historical entries.
        </Text>
        {loading ? (
          <Text role="status">Loading your profile…</Text>
        ) : error ? (
          <Text role="alert">
            The saved currency could not be loaded. Reload the profile before changing it.
          </Text>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {currencies.map((currency) => (
                <Button
                  key={currency}
                  size="sm"
                  variant={selected === currency ? 'primary' : 'outline'}
                  disabled={saving}
                  aria-pressed={selected === currency}
                  onPress={() => void changeCurrency(currency)}
                  style={{ width: '31%', minHeight: 44 }}
                >
                  {currency}
                </Button>
              ))}
            </div>
            <Typography variant="caption">
              Selected: {currencyLabel(selected)} · {selected}
            </Typography>
          </>
        )}
        {message && <Text role="status">{message}</Text>}
      </section>
    </div>
  );
}
