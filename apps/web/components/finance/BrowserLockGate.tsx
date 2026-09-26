'use client';

import * as React from 'react';
import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button, Card, Input, Label } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  disableWebAuthnLock,
  getPasscodeLockStatus,
  hasBrowserLock,
  hasWebAuthnLock,
  type PasscodeLockStatus,
  unlockWithWebAuthn,
  verifyPasscodeLock,
  webAuthnLockChangedEvent,
} from '@/lib/security/webauthn-lock';

const emptyPasscodeStatus: PasscodeLockStatus = {
  configured: false,
  attemptsRemaining: 5,
  retryAt: 0,
};

export function BrowserLockGate({ children }: { children: React.ReactNode }) {
  const { userId } = useBrowserSync();
  const requestReset = useAction(api.auth.requestAppLockReset);
  const verifyReset = useAction(api.auth.verifyAppLockReset);
  const [phase, setPhase] = React.useState<'checking' | 'open' | 'locked' | 'storage-error'>(
    'checking',
  );
  const [checkedUser, setCheckedUser] = React.useState<string | null>(null);
  const [passkeyEnabled, setPasskeyEnabled] = React.useState(false);
  const [passcodeStatus, setPasscodeStatus] = React.useState(emptyPasscodeStatus);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [challengeId, setChallengeId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [passcode, setPasscode] = React.useState('');

  React.useEffect(() => {
    let active = true;
    setPhase('checking');
    setCheckedUser(userId);
    setError('');
    setPasscode('');
    if (!userId) {
      setPhase('open');
      setPasskeyEnabled(false);
      setPasscodeStatus(emptyPasscodeStatus);
      return () => {
        active = false;
      };
    }
    const refreshLock = () => {
      if (!active) return;
      try {
        setPasskeyEnabled(hasWebAuthnLock(userId));
        setPasscodeStatus(getPasscodeLockStatus(userId));
        setPhase(hasBrowserLock(userId) ? 'locked' : 'open');
      } catch {
        setPhase('storage-error');
      }
    };
    const relock = () => {
      if (!active) return;
      try {
        if (hasBrowserLock(userId)) setPhase('locked');
      } catch {
        setPhase('storage-error');
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') relock();
    };
    refreshLock();
    window.addEventListener(webAuthnLockChangedEvent, refreshLock);
    window.addEventListener('storage', refreshLock);
    window.addEventListener('focus', refreshLock);
    window.addEventListener('blur', relock);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener(webAuthnLockChangedEvent, refreshLock);
      window.removeEventListener('storage', refreshLock);
      window.removeEventListener('focus', refreshLock);
      window.removeEventListener('blur', relock);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);

  React.useEffect(() => {
    if (!userId || !passcodeStatus.retryAt) return;
    const timer = window.setTimeout(() => {
      try {
        setPasscodeStatus(getPasscodeLockStatus(userId));
      } catch {
        setPhase('storage-error');
      }
    }, Math.max(0, passcodeStatus.retryAt - Date.now()) + 1);
    return () => window.clearTimeout(timer);
  }, [passcodeStatus.retryAt, userId]);

  function refreshPasscodeStatus() {
    if (!userId) return;
    try {
      setPasscodeStatus(getPasscodeLockStatus(userId));
    } catch {
      setPhase('storage-error');
    }
  }

  async function unlockWithPasskey() {
    if (!userId || pending) return;
    setPending(true);
    setError('');
    try {
      await unlockWithWebAuthn(userId);
      setPhase('open');
      setChallengeId('');
      setCode('');
      refreshPasscodeStatus();
    } catch (cause) {
      refreshPasscodeStatus();
      setError(cause instanceof Error ? cause.message : 'Passkey verification failed.');
    } finally {
      setPending(false);
    }
  }

  async function unlockWithPasscode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || pending || !/^\d{6}$/.test(passcode)) return;
    setPending(true);
    setError('');
    try {
      if (await verifyPasscodeLock(userId, passcode)) {
        setPhase('open');
        setPasscode('');
        refreshPasscodeStatus();
      } else {
        refreshPasscodeStatus();
        setPasscode('');
        setError('Incorrect passcode.');
      }
    } catch (cause) {
      refreshPasscodeStatus();
      setPasscode('');
      setError(
        cause instanceof Error && cause.message === 'PASSCODE_LOCKED_OUT'
          ? 'Too many failed attempts. Wait 30 seconds, then try again.'
          : cause instanceof Error
            ? cause.message
            : 'Passcode verification failed.',
      );
    } finally {
      setPending(false);
    }
  }

  async function sendRecoveryCode() {
    if (!userId || pending) return;
    setPending(true);
    setError('');
    try {
      const challenge = await requestReset({});
      if (String(challenge.userId) !== userId) throw new Error('RECOVERY_ACCOUNT_MISMATCH');
      setChallengeId(challenge.challengeId);
      setCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a recovery code.');
    } finally {
      setPending(false);
    }
  }

  async function recover(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !challengeId || !/^\d{6}$/.test(code) || pending) return;
    setPending(true);
    setError('');
    try {
      const result = await verifyReset({ challengeId, code });
      if (!result.verified || String(result.userId) !== userId)
        throw new Error('The recovery code is invalid or expired.');
      disableWebAuthnLock(userId);
      setPhase('open');
      setChallengeId('');
      setCode('');
      setPasscode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify the recovery code.');
    } finally {
      setPending(false);
    }
  }

  if (!userId || (phase === 'open' && checkedUser === userId)) return children;
  if (phase === 'checking' || checkedUser !== userId) {
    return (
      <main className="finance-welcome" role="status" aria-live="polite">
        <p className="finance-kicker">PRIVATE WORKSPACE</p>
        <h1>Checking this browser.</h1>
      </main>
    );
  }
  if (phase === 'storage-error') {
    return (
      <main className="finance-welcome" role="alert">
        <p className="finance-kicker">PRIVATE WORKSPACE</p>
        <h1>Browser storage is unavailable.</h1>
        <p>Finapp cannot safely read this device’s local lock state.</p>
      </main>
    );
  }

  return (
    <main className="finance-welcome">
      <Card className="finance-settings-card">
        <p className="finance-kicker">PRIVATE WORKSPACE</p>
        <h1>Unlock Finapp.</h1>
        <p>Verify with this browser’s passkey or six-digit passcode.</p>
        <p>
          This screen lock does not encrypt browser data. Anyone with browser-profile or developer
          tools access may still inspect the offline copy.
        </p>
        {passkeyEnabled && (
          <Button onPress={unlockWithPasskey} disabled={pending || passcodeStatus.retryAt > Date.now()}>
            {pending ? 'Waiting for passkey…' : 'Unlock with passkey'}
          </Button>
        )}
        {passcodeStatus.configured && (
          <form onSubmit={unlockWithPasscode} className="auth-form">
            <div className="auth-field">
              <Label htmlFor="lock-passcode">Six-digit passcode</Label>
              <Input
                id="lock-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={passcode}
                onChangeText={setPasscode}
                required
              />
            </div>
            {passcodeStatus.retryAt > Date.now() ? (
              <p className="finance-muted" role="status">
                Too many attempts. Try again in 30 seconds.
              </p>
            ) : (
              <p className="finance-muted" role="status">
                {passcodeStatus.attemptsRemaining} attempts remaining before a 30-second lockout.
              </p>
            )}
            <Button
              type="submit"
              disabled={pending || !/^\d{6}$/.test(passcode) || passcodeStatus.retryAt > Date.now()}
              aria-busy={pending}
            >
              Unlock with passcode
            </Button>
          </form>
        )}
        {!challengeId ? (
          <Button variant="secondary" onPress={sendRecoveryCode} disabled={pending}>
            Recover with email
          </Button>
        ) : (
          <>
            <p role="status">A recovery code was sent to the signed-in account email.</p>
            <Button type="button" variant="secondary" onPress={sendRecoveryCode} disabled={pending}>
              Send a new recovery code
            </Button>
            <form onSubmit={recover} className="auth-form">
              <div className="auth-field">
                <Label htmlFor="lock-recovery-code">Six-digit email code</Label>
                <Input
                  id="lock-recovery-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                  required
                />
              </div>
              <Button type="submit" disabled={pending || !/^\d{6}$/.test(code)} aria-busy={pending}>
                Verify and remove browser lock
              </Button>
            </form>
          </>
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </Card>
    </main>
  );
}
