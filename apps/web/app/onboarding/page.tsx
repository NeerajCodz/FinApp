'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  OnboardingAvatarPicker,
  ProfilePreview,
  Sheet,
  Tabs,
} from '@finapp/ui/web';
import { currencies } from '@convex/shared/validators';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import { useLocalRecords } from '@/lib/offline/hooks';
import { commitLocalWrite, type LocalRecord } from '@/lib/offline/repository';
import { pendingGroupInvitationPath } from '@/lib/authRoutes';

type Profile = LocalRecord & {
  displayName?: string;
  username?: string;
  defaultCurrency?: string;
  timezone?: string;
  phone?: string;
  avatarId?: string;
  gender?: 'neutral' | 'male' | 'female';
};
type Currency = (typeof currencies)[number];
type AvatarGender = NonNullable<Profile['gender']>;
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
  const [step, setStep] = React.useState(0);
  const auth = useConvexAuth();
  const { userId } = useBrowserSync();
  const { records: profiles } = useLocalRecords<Profile>('profile');
  const profile = profiles[0];
  const router = useRouter();
  const verification = useQuery(api.users.queries.current, {});
  React.useEffect(() => {
    if (auth.isLoading || verification === undefined) return;
    if (!auth.isAuthenticated) router.replace('/sign-in');
    else if (verification?.emailVerificationTime === undefined) {
      router.replace(
        `/verify?email=${encodeURIComponent(verification?.email ?? '')}&next=onboarding`,
      );
    }
  }, [auth.isAuthenticated, auth.isLoading, router, verification]);
  const avatarCatalog = useQuery(api.avatars.queries.list, {});
  const [currencyOpen, setCurrencyOpen] = React.useState(false);
  const [currency, setCurrency] = React.useState<Currency>(
    Intl.NumberFormat().resolvedOptions().locale.startsWith('en-US') ? 'USD' : 'INR',
  );
  const [currencySearch, setCurrencySearch] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [accountName, setAccountName] = React.useState('');
  const [gender, setGender] = React.useState<AvatarGender>('neutral');
  const [avatarId, setAvatarId] = React.useState('AV0');
  const [mode, setMode] = React.useState<'personal' | 'shared'>('personal');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (profile?.displayName && !displayName) setDisplayName(profile.displayName);
    if (profile?.username && !username) setUsername(profile.username);
    if (profile?.gender) setGender(profile.gender);
    if (profile?.avatarId) setAvatarId(profile.avatarId);
  }, [
    displayName,
    profile?.avatarId,
    profile?.displayName,
    profile?.gender,
    profile?.username,
    username,
  ]);
  const handle = username.replace(/^@+/, '').toLowerCase();
  const query = currencySearch.trim().toLowerCase();
  const currencyOptions = currencies.filter((code) =>
    `${currencyCountries[code]} ${code} ${currencyLabel(code)}`.toLowerCase().includes(query),
  );
  const visibleAvatars = (avatarCatalog ?? []).filter((avatar) => avatar.gender === gender);
  const selectedAvatar = visibleAvatars.find((avatar) => avatar.avatarId === avatarId);
  const canContinue =
    step !== 1 || (!!displayName.trim() && /^[a-z0-9_]{3,32}$/.test(handle) && !!selectedAvatar);

  function advance() {
    setError('');
    if (!canContinue) {
      setError(
        !displayName.trim()
          ? 'Enter the name people will see.'
          : !/^[a-z0-9_]{3,32}$/.test(handle)
            ? 'Usernames must be 3–32 letters, numbers, or underscores.'
            : 'Choose an avatar before continuing.',
      );
      return;
    }
    if (step < totalSteps - 1) setStep((current) => current + 1);
    else void finish();
  }

  async function finish() {
    if (!userId || !auth.isAuthenticated || saving) return;
    setSaving(true);
    setError('');
    try {
      const timezone =
        profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const update = {
        displayName: displayName.trim(),
        username: handle,
        defaultCurrency: currency,
        timezone,
        phone: phone.trim() || undefined,
        avatarId,
        gender,
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
      router.replace(
        pendingGroupInvitationPath() ?? (mode === 'shared' ? '/groups' : '/dashboard'),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (auth.isLoading || (auth.isAuthenticated && !userId)) {
    return (
      <main className="auth-layout">
        <section className="auth-content" aria-labelledby="auth-title">
          <div className="auth-topline">
            <Link href="/" className="brand auth-brand" aria-label="Finapp home">
              <span className="brand-mark" aria-hidden="true">
                F
              </span>
              <span>finapp</span>
            </Link>
          </div>
          <div className="auth-card">
            <span className="auth-eyebrow">SETTING UP YOUR SPACE</span>
            <h1 id="auth-title">Almost there.</h1>
            <p className="auth-description">Connecting your private workspace.</p>
            <p role="status" aria-live="polite">
              Preparing your account…
            </p>
          </div>
          <span className="auth-legal">Your profile stays yours.</span>
        </section>
      </main>
    );
  }
  if (!auth.isAuthenticated || !userId) {
    return (
      <main className="auth-layout">
        <section className="auth-content" aria-labelledby="auth-title">
          <div className="auth-topline">
            <Link href="/" className="brand auth-brand" aria-label="Finapp home">
              <span className="brand-mark" aria-hidden="true">
                F
              </span>
              <span>finapp</span>
            </Link>
          </div>
          <div className="auth-card">
            <span className="auth-eyebrow">ACCOUNT SETUP</span>
            <h1 id="auth-title">Sign in to continue.</h1>
            <p className="auth-description">Your account session is needed to finish setup.</p>
            <p role="alert">This setup link is only available after verifying your account.</p>
            <Link className="auth-back-link" href="/sign-in">
              Return to sign in
            </Link>
          </div>
          <span className="auth-legal">
            Your account stays yours. <Link href="/privacy">Read our privacy notes</Link>
          </span>
        </section>
      </main>
    );
  }
  if (auth.isAuthenticated && verification?.emailVerificationTime === undefined) return null;

  const copy = [
    [
      'Your money, your format.',
      'Choose the country and currency you use every day. You can change it later.',
    ],
    [
      'Make it yours.',
      'Set your display name, username, gender, and the avatar people will see across Finapp.',
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
    <main className="auth-layout">
      <section className="auth-content" aria-labelledby="auth-title">
        <div className="auth-topline">
          <Button
            type="button"
            variant="ghost"
            aria-label="Go back"
            onPress={() => {
              if (step > 0) {
                setError('');
                setStep((current) => current - 1);
              } else {
                router.back();
              }
            }}
          >
            <ArrowLeft size={16} />
          </Button>
          <Link href="/" className="brand auth-brand" aria-label="Finapp home">
            <span className="brand-mark" aria-hidden="true">
              F
            </span>
            <span>finapp</span>
          </Link>
          <span className="auth-eyebrow">
            YOUR FINAPP · {step + 1} / {totalSteps}
          </span>
        </div>
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
        <div className="auth-card">
          <h1 id="auth-title">{copy[step][0]}</h1>
          <p className="auth-description">{copy[step][1]}</p>
          <div className="auth-form">
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
                  <Label>Country — currency</Label>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    aria-label="Choose country and currency"
                    onPress={() => setCurrencyOpen(true)}
                  >
                    {currencyCountries[currency]} — {currency}
                  </Button>
                  <span className="auth-helper">SELECTED CURRENCY</span>
                </div>
              )}
              {step === 1 && (
                <div style={{ display: 'grid', gap: 18 }}>
                  <div className="auth-field">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      autoComplete="name"
                      placeholder="Your name"
                      value={displayName}
                      onChangeText={setDisplayName}
                    />
                    <ProfilePreview
                      displayName={displayName}
                      username={handle}
                      avatarId={avatarId}
                    />
                  </div>
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
                    {handle && (
                      <span className="auth-helper auth-handle">You will share as @{handle}</span>
                    )}
                  </div>
                  <div className="auth-field">
                    <Label>Gender</Label>
                    <div
                      role="group"
                      aria-label="Choose gender"
                      style={{ display: 'flex', gap: 8 }}
                    >
                      {(['neutral', 'male', 'female'] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={gender === option}
                          onClick={() => {
                            setGender(option);
                            const first = (avatarCatalog ?? []).find(
                              (avatar) => avatar.gender === option,
                            );
                            if (first) setAvatarId(first.avatarId);
                          }}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 999,
                            border: `1px solid ${gender === option ? 'var(--primary)' : 'var(--border-subtle)'}`,
                            background: gender === option ? 'var(--surface-raised)' : 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                          }}
                        >
                          {option[0].toUpperCase() + option.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="auth-field">
                    <Label>Choose an avatar</Label>
                    {visibleAvatars.length ? (
                      <OnboardingAvatarPicker
                        choices={visibleAvatars}
                        selectedId={avatarId}
                        label={`${gender} avatars`}
                        onSelect={setAvatarId}
                      />
                    ) : (
                      <span className="auth-helper">Avatar choices are loading.</span>
                    )}
                  </div>
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
                <div className="auth-choice">
                  <Tabs
                    label="How will you use Finapp?"
                    value={mode}
                    onChange={(value) => setMode(value as 'personal' | 'shared')}
                    tabs={[
                      { label: 'Personal', value: 'personal' },
                      { label: 'Personal + groups', value: 'shared' },
                    ]}
                  />
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
                <Button
                  type="submit"
                  size="lg"
                  disabled={saving || !canContinue}
                  aria-busy={saving}
                >
                  {saving ? 'Saving…' : step === totalSteps - 1 ? 'Enter Finapp' : 'Continue'}{' '}
                  <ArrowRight size={16} />
                </Button>
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
              </div>
            </form>
            <Sheet
              visible={currencyOpen}
              title="Choose country and currency"
              onClose={() => {
                setCurrencyOpen(false);
                setCurrencySearch('');
              }}
            >
              <Input
                autoComplete="off"
                aria-label="Search countries and currencies"
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
                    onClick={() => {
                      setCurrency(item);
                      setCurrencyOpen(false);
                      setCurrencySearch('');
                    }}
                  >
                    {currencyCountries[item]} — {item}
                  </button>
                ))}
                {!currencyOptions.length && <p>No matching country or currency.</p>}
              </div>
            </Sheet>
          </div>
        </div>
      </section>
    </main>
  );
}
