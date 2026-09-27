'use client';

import * as React from 'react';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button, Card, SectionHeader } from '@finapp/ui/web';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  enableWebAuthnLock,
  hasPasscodeLock,
  hasWebAuthnLock,
  isWebAuthnLockAvailable,
  removePasscodeLock,
  removeWebAuthnLock,
  setPasscodeLock,
  unlockWithWebAuthn,
  verifyPasscodeLock,
} from '@/lib/security/webauthn-lock';

export default function SecuritySettingsPage() {
  const { userId } = useBrowserSync();
  const securityPreferences = useQuery(api.users.queries.securityPreferences, userId ? {} : 'skip');
  const setTwoFactorEnabled = useMutation(api.users.mutations.setTwoFactorEnabled);
  const [available, setAvailable] = React.useState(false);
  const [webAuthnEnabled, setWebAuthnEnabled] = React.useState(false);
  const [passcodeEnabled, setPasscodeEnabled] = React.useState(false);
  const [lockBusy, setLockBusy] = React.useState(false);
  const [passcode, setPasscode] = React.useState('');
  const [passcodeConfirmation, setPasscodeConfirmation] = React.useState('');
  const [passcodeForRemoval, setPasscodeForRemoval] = React.useState('');
  const [error, setError] = React.useState('');
  const [twoFactorPending, setTwoFactorPending] = React.useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = React.useState('');

  async function toggleTwoFactor() {
    if (!securityPreferences || twoFactorPending) return;
    const next = !securityPreferences.twoFactorEnabled;
    setTwoFactorPending(true);
    setTwoFactorMessage('');
    try {
      await setTwoFactorEnabled({ enabled: next });
      setTwoFactorMessage(
        next
          ? 'Email verification is required after password sign-in.'
          : 'Password sign-in no longer sends a verification email.',
      );
    } catch (cause) {
      setTwoFactorMessage(
        cause instanceof Error ? cause.message : 'Could not update two-factor sign-in.',
      );
    } finally {
      setTwoFactorPending(false);
    }
  }

  React.useEffect(() => {
    let active = true;
    void isWebAuthnLockAvailable()
      .then((result) => {
        if (active) setAvailable(result);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    if (userId) {
      try {
        setWebAuthnEnabled(hasWebAuthnLock(userId));
        setPasscodeEnabled(hasPasscodeLock(userId));
        setError('');
      } catch {
        setError('Browser storage is unavailable; the screen-lock state cannot be read.');
      }
    } else {
      setWebAuthnEnabled(false);
      setPasscodeEnabled(false);
    }
    return () => {
      active = false;
    };
  }, [userId]);

  function refreshLockState() {
    setWebAuthnEnabled(hasWebAuthnLock(userId!));
    setPasscodeEnabled(hasPasscodeLock(userId!));
  }

  async function createPasscode() {
    if (!/^\d{6}$/.test(passcode) || passcode !== passcodeConfirmation) {
      setError('Enter the same six-digit passcode in both fields.');
      return;
    }
    setLockBusy(true);
    setError('');
    try {
      await setPasscodeLock(userId!, passcode);
      setPasscode('');
      setPasscodeConfirmation('');
      refreshLockState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the passcode lock.');
    } finally {
      setLockBusy(false);
    }
  }

  async function removePasscode() {
    setLockBusy(true);
    setError('');
    try {
      if (!(await verifyPasscodeLock(userId!, passcodeForRemoval))) {
        setError('The passcode is incorrect.');
        return;
      }
      removePasscodeLock(userId!);
      setPasscodeForRemoval('');
      refreshLockState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the passcode lock.');
    } finally {
      setLockBusy(false);
    }
  }

  async function configurePasskey() {
    setLockBusy(true);
    setError('');
    try {
      if (webAuthnEnabled) await unlockWithWebAuthn(userId!);
      await enableWebAuthnLock(userId!);
      refreshLockState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not configure the passkey lock.');
    } finally {
      setLockBusy(false);
    }
  }

  async function removePasskey() {
    setLockBusy(true);
    setError('');
    try {
      await unlockWithWebAuthn(userId!);
      removeWebAuthnLock(userId!);
      refreshLockState();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove the passkey lock.');
    } finally {
      setLockBusy(false);
    }
  }

  if (!userId)
    return (
      <FinanceSignedOut
        section="SECURITY"
        title="Keep access in your control."
        description="Sign in to review the browser screen-lock status for this account."
      />
    );

  return (
    <div className="finance-page">
      <header className="finance-page-heading">
        <div>
          <p className="finance-kicker">ACCOUNT ACCESS</p>
          <h1>Security</h1>
          <p className="finance-muted">Review this browser’s passkey and passcode screen lock.</p>
        </div>
      </header>
      <Card className="finance-settings-card">
        <SectionHeader
          title="Browser screen lock"
          action={<Fingerprint size={18} aria-hidden="true" />}
        />
        <p>
          {webAuthnEnabled || passcodeEnabled
            ? `Enabled: ${[webAuthnEnabled && 'passkey', passcodeEnabled && 'six-digit passcode']
                .filter(Boolean)
                .join(' and ')}.`
            : 'No passkey or passcode lock is enabled for this browser.'}
        </p>
        <p>
          {available
            ? 'A platform authenticator is available. Use a passkey as this browser’s biometric-equivalent lock.'
            : 'Passkeys require a secure browser context and supported platform authenticator. A six-digit passcode is also available.'}
        </p>
        <p>
          This is a screen-level gate, not encryption. Browser IndexedDB and WebAuthn are scoped to
          this origin and browser profile; they do not provide the native SQLCipher or SecureStore
          guarantee.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Button disabled={!available || lockBusy} onPress={() => void configurePasskey()}>
              {lockBusy ? 'Working…' : webAuthnEnabled ? 'Change passkey' : 'Enable passkey'}
            </Button>
            {webAuthnEnabled && (
              <Button variant="outline" disabled={lockBusy} onPress={() => void removePasskey()}>
                Disable passkey
              </Button>
            )}
          </div>
          <p className="finance-form-note">
            {webAuthnEnabled
              ? 'Changing the passkey first verifies the existing passkey.'
              : 'Your browser prompts to create and verify a platform passkey.'}
          </p>
          <div style={{ display: 'grid', gap: 10, maxWidth: 380 }}>
            <label>
              {passcodeEnabled ? 'New six-digit passcode' : 'Six-digit passcode'}
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={passcode}
                onChange={(event) => setPasscode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={lockBusy}
              />
            </label>
            <label>
              Confirm six-digit passcode
              <input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={passcodeConfirmation}
                onChange={(event) =>
                  setPasscodeConfirmation(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                disabled={lockBusy}
              />
            </label>
            <Button disabled={lockBusy} onPress={() => void createPasscode()}>
              {lockBusy ? 'Saving…' : passcodeEnabled ? 'Change passcode' : 'Enable passcode'}
            </Button>
          </div>
          {passcodeEnabled && (
            <div style={{ display: 'grid', gap: 10, maxWidth: 380 }}>
              <label>
                Current passcode to disable
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  maxLength={6}
                  value={passcodeForRemoval}
                  onChange={(event) =>
                    setPasscodeForRemoval(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  disabled={lockBusy}
                />
              </label>
              <Button
                variant="outline"
                disabled={lockBusy || !/^\d{6}$/.test(passcodeForRemoval)}
                onPress={() => void removePasscode()}
              >
                Disable passcode
              </Button>
            </div>
          )}
        </div>
        {error && (
          <p className="finance-form-error" role="alert">
            {error}
          </p>
        )}
      </Card>
      <Card className="finance-settings-card">
        <SectionHeader
          title="Two-factor sign-in"
          action={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <p>
          {securityPreferences?.twoFactorEnabled
            ? 'A six-digit email code is required after your password.'
            : 'Password sign-in is used by default. No extra email code is sent.'}
        </p>
        <Button
          variant={securityPreferences?.twoFactorEnabled ? 'outline' : 'primary'}
          disabled={
            securityPreferences === undefined || securityPreferences === null || twoFactorPending
          }
          onPress={() => void toggleTwoFactor()}
        >
          {twoFactorPending
            ? 'Saving…'
            : securityPreferences?.twoFactorEnabled
              ? 'Turn off two-factor sign-in'
              : 'Enable two-factor sign-in'}
        </Button>
        {twoFactorMessage && (
          <p className="finance-muted" role="status">
            {twoFactorMessage}
          </p>
        )}
      </Card>
      <Card className="finance-settings-card">
        <SectionHeader
          title="Browser privacy"
          action={<ShieldCheck size={18} aria-hidden="true" />}
        />
        <p>
          Remove the local copy or read the complete browser-storage disclosure from the privacy
          controls.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Button variant="outline" onPress={() => window.location.assign('/settings/privacy')}>
            Privacy and export
          </Button>
        </div>
      </Card>
    </div>
  );
}
