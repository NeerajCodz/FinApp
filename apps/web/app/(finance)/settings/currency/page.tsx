'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Coins, Search } from 'lucide-react';
import {
  resolveDefaultCurrency,
  SettingsField,
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsShell,
} from '@finapp/ui/finance';
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

function currencySymbol(currency: string) {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
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
  const [query, setQuery] = React.useState('');

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
      setMessage(`Default currency is now ${currencyLabel(value)}.`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save the default currency.');
    } finally {
      setSaving(false);
    }
  }

  const needle = query.trim().toLowerCase();
  const shown = currencies.filter(
    (currency) =>
      !needle ||
      currency.toLowerCase().includes(needle) ||
      currencyLabel(currency).toLowerCase().includes(needle),
  );
  return (
    <SettingsShell
      title="Currency"
      subtitle="Your default currency"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={<Coins size={22} />}
        title={`${currencyLabel(selected)} (${selected})`}
        description={`${currencySymbol(selected)} is used for new accounts, budgets, groups and transactions. Past entries keep their own currency.`}
      />
      <SettingsGroup title="Choose a currency">
        <SettingsItem icon={<Search size={19} />} title="Search">
          <SettingsField
            label="Name or code"
            type="search"
            placeholder="e.g. euro or EUR"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ letterSpacing: 'normal' }}
          />
        </SettingsItem>
        {loading ? (
          <SettingsItem title="Loading your profile…" />
        ) : error ? (
          <SettingsItem
            title="Your saved currency couldn’t be loaded"
            description="Reload and try again."
          />
        ) : shown.length === 0 ? (
          <SettingsItem title="No matching currency" />
        ) : (
          <div role="radiogroup" aria-label="Default currency" style={{ display: 'grid' }}>
            {shown.map((currency) => (
              <SettingsLink
                key={currency}
                icon={
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{currencySymbol(currency)}</span>
                }
                tone={currency === selected ? 'primary' : undefined}
                title={currencyLabel(currency)}
                value={currency}
                badge={currency === selected ? 'Default' : undefined}
                onPress={
                  saving || currency === selected ? undefined : () => void changeCurrency(currency)
                }
              />
            ))}
          </div>
        )}
      </SettingsGroup>
      {message ? (
        <p
          role="status"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-foreground-muted)' }}
        >
          {message}
        </p>
      ) : null}
    </SettingsShell>
  );
}
