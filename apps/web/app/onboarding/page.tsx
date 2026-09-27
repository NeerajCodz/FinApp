'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth } from 'convex/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Input, Label } from '@finapp/ui/web';
import { currencies } from '@convex/shared/validators';
import { AuthFrame } from '@/components/auth/AuthFrame';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { normalizePhone, validateProfileUpdate } from '@convex/users/domain';

type Profile = LocalRecord & {
  displayName?: string;
  username?: string;
  defaultCurrency?: string;
  timezone?: string;
  phone?: string;
};
type Currency = (typeof currencies)[number];
const totalSteps = 5;
const currencyCountries: Record<Currency, string> = {
  INR: 'India',
  USD: 'United States',
  EUR: 'Eurozone',
  GBP: 'United Kingdom',
  JPY: 'Japan',
  AUD: 'Australia',
  CAD: 'Canada',
  CHF: 'Switzerland',
  CNY: 'China',
  HKD: 'Hong Kong',
  SGD: 'Singapore',
  AED: 'United Arab Emirates',
  SAR: 'Saudi Arabia',
  NZD: 'New Zealand',
  SEK: 'Sweden',
  NOK: 'Norway',
  DKK: 'Denmark',
  ZAR: 'South Africa',
  BRL: 'Brazil',
  MXN: 'Mexico',
  KRW: 'South Korea',
  TRY: 'Türkiye',
  THB: 'Thailand',
  PLN: 'Poland',
  IDR: 'Indonesia',
  MYR: 'Malaysia',
};

function currencyLabel(currency: string) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export default function OnboardingPage() {
  const auth = useConvexAuth();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [currency, setCurrency] = React.useState<Currency>(() =>
    currencies.some((item) => item === (profile?.defaultCurrency ?? ''))
      ? (profile!.defaultCurrency as Currency)
      : Intl.NumberFormat().resolvedOptions().locale.startsWith('en-US')
        ? 'USD'
        : 'INR',
  );
  const [currencySearch, setCurrencySearch] = React.useState('');
  const [username, setUsername] = React.useState(profile?.username ?? '');
  const [phone, setPhone] = React.useState(profile?.phone ?? '');
  const [accountName, setAccountName] = React.useState('');
  const [mode, setMode] = React.useState<'personal' | 'shared'>('personal');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const handle = username.replace(/^@+/, '').toLowerCase();
  const query = currencySearch.trim().toLowerCase();
  const currencyOptions = currencies.filter((code) =>
    `${currencyCountries[code]} ${code} ${currencyLabel(code)}`.toLowerCase().includes(query),
  );
  React.useEffect(() => {
    if (profile?.defaultCurrency && currencies.some((item) => item === profile.defaultCurrency)) {
      setCurrency(profile.defaultCurrency as Currency);
    }
  }, [profile?.defaultCurrency]);
  React.useEffect(() => {
    if (!username && profile?.username) setUsername(profile.username);
  }, [profile?.username, username]);
  React.useEffect(() => {
    if (!phone && profile?.phone) setPhone(profile.phone);
  }, [phone, profile?.phone]);
  const canContinue = step !== 1 || /^[a-z0-9_]{3,32}$/.test(handle);

  function advance() {
    setError('');
    if (!canContinue) {
      setError('Usernames must be 3–32 letters, numbers, or underscores.');
      return;
    }
    if (step < totalSteps - 1) setStep((current) => current + 1);
    else void finish();
  }

  async function finish() {
    if (!userId || !auth.isAuthenticated || saving) return;
    setSaving(true);
    setError('');
    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone) {
      try {
        validateProfileUpdate({ phone: normalizedPhone });
      } catch {
        setError('Enter a valid international phone number or leave it blank.');
        setSaving(false);
        return;
      }
    }
    try {
      const displayName = String(profile?.displayName ?? 'Your profile');
      const timezone =
        profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const update = {
        displayName,
        username: handle,
        defaultCurrency: currency,
        timezone,
        phone: normalizedPhone || undefined,
      };
      const profileId = String(profile?.id ?? profile?._id ?? userId);
      await commitLocalWrite(
        userId,
        'profile',
        'user.update',
        {
          ...(profile ?? {}),
          id: profileId,
          ownerId: userId,
          ...update,
        },
        update,
        { recordId: profileId },
      );
      const trimmedAccountName = accountName.trim();
      if (trimmedAccountName) {
        const now = Date.now();
        await commitLocalWrite(
          userId,
          'account',
          'account.create',
          {
            ownerId: userId,
            name: trimmedAccountName,
            type: 'cash',
            currency,
            openingBalanceMinor: 0n,
            balanceMinor: 0n,
            isIncludedInTotal: true,
            createdAt: now,
            updatedAt: now,
          },
          {
            name: trimmedAccountName,
            type: 'cash',
            currency,
            openingBalanceMinor: 0n,
            isIncludedInTotal: true,
          },
        );
      }
      router.replace(mode === 'shared' ? '/groups' : '/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (auth.isLoading || (auth.isAuthenticated && !userId)) {
    return (
      <AuthFrame
        eyebrow="SETTING UP YOUR SPACE"
        title="Almost there."
        description="Connecting your private workspace."
        footer={<span>Your profile stays yours.</span>}
      >
        <p role="status" aria-live="polite">
          Preparing your account…
        </p>
      </AuthFrame>
    );
  }
  if (!auth.isAuthenticated || !userId) {
    return (
      <AuthFrame
        eyebrow="ACCOUNT SETUP"
        title="Sign in to continue."
        description="Your account session is needed to finish setup."
        footer={<Link href="/sign-in">Return to sign in</Link>}
      >
        <p role="alert">This setup link is only available after verifying your account.</p>
      </AuthFrame>
    );
  }

  const copy = [
    [
      'Your money, your format.',
      'Choose the country and currency you use every day. You can change it later.',
    ],
    [
      'Choose your username.',
      'Your @handle makes sharing groups and split expenses instant. Use letters, numbers, or underscores.',
    ],
    [
      'Add a phone number.',
      'Optional. It helps people find you when sharing a split or inviting you to a group.',
    ],
    [
      'Add your first account.',
      'Optional for now. A simple name is enough to make your balance useful.',
    ],
    ['How will you use Finapp?', 'Start personal-only or keep shared expenses ready from day one.'],
  ];
  return (
    <AuthFrame
      eyebrow={`YOUR FINAPP · ${step + 1} / ${totalSteps}`}
      title={copy[step][0]}
      description={copy[step][1]}
      footer={
        <span>
          Already know your way around? <Link href="/dashboard">Go to your overview</Link>
        </span>
      }
    >
      <div
        className="auth-progress"
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuenow={step + 1}
      >
        <span style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          advance();
        }}
        noValidate
        className="auth-form"
      >
        {step === 0 && (
          <div className="auth-field">
            <Label htmlFor="currency-search">Country — currency</Label>
            <Input
              id="currency-search"
              autoComplete="off"
              placeholder="Search India, INR, rupee…"
              value={currencySearch}
              onChangeText={setCurrencySearch}
            />
            <div
              className="auth-currency-list"
              role="listbox"
              aria-label="Choose country and currency"
            >
              {currencyOptions.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={currency === item}
                  className={currency === item ? 'is-selected' : ''}
                  onClick={() => setCurrency(item)}
                >
                  {currencyCountries[item]} — {item}
                </button>
              ))}
              {!currencyOptions.length && <p>No matching country or currency.</p>}
            </div>
            <span className="auth-helper">
              Selected currency: {currencyCountries[currency]} — {currency}
            </span>
          </div>
        )}
        {step === 1 && (
          <div className="auth-field">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="@neeraj"
              value={username}
              onChangeText={setUsername}
              error={!!error}
            />
            {handle && <span className="auth-helper auth-handle">You will share as @{handle}</span>}
          </div>
        )}
        {step === 2 && (
          <div className="auth-field">
            <Label htmlFor="phone">Phone number · optional</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              error={!!error}
            />
          </div>
        )}
        {step === 3 && (
          <div className="auth-field">
            <Label htmlFor="account-name">Account name · optional</Label>
            <Input
              id="account-name"
              autoComplete="off"
              placeholder="HDFC, Cash, Savings"
              value={accountName}
              onChangeText={setAccountName}
            />
          </div>
        )}
        {step === 4 && (
          <div className="auth-choice" role="radiogroup" aria-label="How will you use Finapp?">
            {(['personal', 'shared'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                className={mode === value ? 'is-selected' : ''}
                onClick={() => setMode(value)}
              >
                {value === 'personal' ? 'Personal' : 'Personal + groups'}
              </button>
            ))}
            <p>
              {mode === 'shared'
                ? 'Groups and split tools will stay close at hand.'
                : 'Shared finance remains available whenever you need it.'}
            </p>
          </div>
        )}
        {error && (
          <p className="auth-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
        <div className="auth-step-actions">
          {step > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onPress={() => {
                setError('');
                setStep((current) => current - 1);
              }}
            >
              <ArrowLeft size={16} /> Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onPress={() => router.back()}>
              <ArrowLeft size={16} /> Back
            </Button>
          )}
          {(step === 2 || step === 3) && (
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onPress={() => {
                setError('');
                setStep((current) => current + 1);
              }}
            >
              Skip for now
            </Button>
          )}
          <Button type="submit" size="lg" disabled={saving || !canContinue} aria-busy={saving}>
            {saving ? 'Saving…' : step === totalSteps - 1 ? 'Enter Finapp' : 'Continue'}{' '}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
    </AuthFrame>
  );
}
