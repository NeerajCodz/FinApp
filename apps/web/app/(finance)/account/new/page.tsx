'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, Landmark } from 'lucide-react';
import { Button, IconButton, Input, Label, Sheet, Typography } from '@finapp/ui/web';
import { CurrencyInput, EntityIconPicker } from '@finapp/ui/finance';
import { currencies } from '@convex/shared/validators';
import { parseMinor } from '@convex/shared/money';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { SignInGate } from '../../_personal';

type Profile = LocalRecord & { defaultCurrency?: string };
const accountTypes = [
  ['Cash', 'cash'],
  ['Bank', 'bank'],
  ['Card', 'card'],
  ['Wallet', 'wallet'],
  ['Loan', 'loan'],
  ['Custom', 'other'],
] as const;
const maxInt64 = 9_223_372_036_854_775_807n;

export default function NewPersonalAccountPage() {
  const router = useRouter();
  const { userId } = useBrowserSync();
  const {
    records: profiles,
    loading: profileLoading,
    error: profileError,
  } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const [name, setName] = React.useState('');
  const [icon, setIcon] = React.useState<string>();
  const [type, setType] = React.useState<(typeof accountTypes)[number][1]>('bank');
  const [customType, setCustomType] = React.useState('');
  const currency = profile?.defaultCurrency ?? '';
  const [openingBalance, setOpeningBalance] = React.useState('');
  const [typeOpen, setTypeOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter an account name.');
      return;
    }
    const custom = customType.trim();
    if (!profile?.defaultCurrency) {
      setError('Set your default currency before creating an account.');
      return;
    }
    if (type === 'other' && !custom) {
      setError('Name your custom account type.');
      return;
    }
    if (!(currencies as readonly string[]).includes(currency)) {
      setError('Choose a supported currency.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const openingBalanceMinor = parseMinor(openingBalance || '0', currency);
      if (openingBalanceMinor < 0n || openingBalanceMinor > maxInt64)
        throw new Error('Enter a valid non-negative opening balance.');
      const now = Date.now();
      const record: LocalRecord = {
        ownerId: userId,
        name: trimmedName,
        type,
        ...(icon ? { icon } : {}),
        ...(type === 'other' ? { customType: custom } : {}),
        currency,
        openingBalanceMinor,
        balanceMinor: openingBalanceMinor,
        isIncludedInTotal: true,
        createdAt: now,
        updatedAt: now,
      };
      const id = await commitLocalWrite(userId, 'account', 'account.create', record, {
        name: trimmedName,
        ...(icon ? { icon } : {}),
        type,
        ...(type === 'other' ? { customType: custom } : {}),
        currency,
        openingBalanceMinor,
        isIncludedInTotal: true,
      });
      router.push(`/account/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this account.');
    } finally {
      setSaving(false);
    }
  }

  if (!userId)
    return (
      <SignInGate eyebrow="NEW ACCOUNT" title="Start with an account.">
        Sign in to create a private account record saved to this browser first.
      </SignInGate>
    );

  return (
    <div className="finance-page" style={{ gap: 24, minHeight: '70vh' }}>
      <IconButton
        label="Go back"
        variant="ghost"
        style={{ alignSelf: 'flex-start' }}
        onPress={() => router.back()}
      >
        <ArrowLeft size={21} aria-hidden="true" />
      </IconButton>

      <header style={{ display: 'grid', gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 14,
            background: 'var(--finapp-surface-raised)',
          }}
        >
          <Landmark size={21} color="var(--finapp-foreground)" />
        </span>
        <Typography variant="title">Add an account</Typography>
        <Typography variant="small" style={{ maxWidth: 320 }}>
          Name where you keep money, then choose how it appears in your accounts.
        </Typography>
      </header>

      <form onSubmit={create} style={{ display: 'grid', flex: 1, gap: 18 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            accessibilityLabel="Account name"
            value={name}
            onChangeText={setName}
            placeholder="Everyday account"
            maxLength={80}
            required
          />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Label>Icon</Label>
          <EntityIconPicker mode="lucide" value={icon} onChange={setIcon} />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Label htmlFor="account-type">Type</Label>
          <Button
            id="account-type"
            type="button"
            variant="outline"
            aria-label="Account type"
            aria-haspopup="dialog"
            aria-expanded={typeOpen}
            onPress={() => setTypeOpen(true)}
            style={{
              minHeight: 50,
              justifyContent: 'space-between',
              borderRadius: 14,
              paddingInline: 16,
            }}
          >
            <span>{accountTypes.find((option) => option[1] === type)?.[0]}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </Button>
        </div>
        {type === 'other' && (
          <div style={{ display: 'grid', gap: 6 }}>
            <Label htmlFor="account-custom-type">Custom type</Label>
            <Input
              id="account-custom-type"
              accessibilityLabel="Custom account type"
              value={customType}
              onChangeText={setCustomType}
              placeholder="e.g. Investment"
              maxLength={40}
              required
            />
          </div>
        )}
        {profileLoading ? (
          <Typography variant="small" role="status">
            Loading your default currency…
          </Typography>
        ) : profileError ? (
          <p className="finance-form-error" role="alert">
            Profile data could not be opened: {profileError}
          </p>
        ) : currency ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <Label>Opening balance · {currency}</Label>
            <CurrencyInput
              currency={currency}
              value={openingBalance}
              onChangeText={setOpeningBalance}
            />
          </div>
        ) : (
          <Button type="button" variant="outline" onPress={() => router.push('/settings/currency')}>
            Set your default currency
          </Button>
        )}
        <div style={{ flex: 1 }} />
        {error && (
          <p className="finance-form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          style={{ width: '100%' }}
          disabled={
            saving ||
            !name.trim() ||
            !currency ||
            !profile?.defaultCurrency ||
            (type === 'other' && !customType.trim())
          }
        >
          {saving ? 'Saving…' : 'Save account'}
        </Button>
      </form>

      <Sheet visible={typeOpen} title="Account type" onClose={() => setTypeOpen(false)}>
        <div style={{ display: 'grid', gap: 4 }}>
          {accountTypes.map(([label, value]) => (
            <Button
              key={value}
              type="button"
              variant={type === value ? 'secondary' : 'ghost'}
              role="radio"
              aria-checked={type === value}
              aria-label={label}
              onPress={() => {
                setType(value);
                setTypeOpen(false);
                setError(null);
              }}
              style={{ minHeight: 48, justifyContent: 'space-between', paddingInline: 12 }}
            >
              <span>{label}</span>
              {type === value && <Check size={19} color="var(--finapp-primary)" />}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
