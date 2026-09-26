'use client';

import * as React from 'react';
import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Button, Card, Input, Label } from '@finapp/ui/web';
import { useBrowserSync } from '@/lib/offline/BrowserSyncProvider';
import {
  disableWebAuthnLock,
  hasWebAuthnLock,
  unlockWithWebAuthn,
  webAuthnLockChangedEvent,
} from '@/lib/security/webauthn-lock';

export function BrowserLockGate({ children }: { children: React.ReactNode }) {
  const { userId } = useBrowserSync();
  const requestReset = useAction(api.auth.requestAppLockReset);
  const verifyReset = useAction(api.auth.verifyAppLockReset);
  const [phase, setPhase] = React.useState<'checking' | 'open' | 'locked' | 'storage-error'>(
    'checking',
  );
  const [checkedUser, setCheckedUser] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [challengeId, setChallengeId] = React.useState('');
  const [code, setCode] = React.useState('');

  React.useEffect(() => {
    let active = true;
    setPhase('checking');
    setCheckedUser(userId);
    setError('');
    if (!userId) {
      setPhase('open');
      return () => {
        active = false;
      };
    }
    const refreshLock = () => {
      if (!active) return;
      try {
        setPhase(hasWebAuthnLock(userId) ? 'locked' : 'open');
      } catch {
        setPhase('storage-error');
      }
    };
    refreshLock();
    window.addEventListener(webAuthnLockChangedEvent, refreshLock);
    window.addEventListener('storage', refreshLock);
    return () => {
      active = false;
      window.removeEventListener(webAuthnLockChangedEvent, refreshLock);
      window.removeEventListener('storage', refreshLock);
    };
  }, [userId]);

  async function unlock() {
    if (!userId || pending) return;
    setPending(true);
    setError('');
    try {
      await unlockWithWebAuthn(userId);
      setPhase('open');
      setChallengeId('');
      setCode('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Passkey verification failed.');
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
        <p>Finapp cannot safely read this device’s passkey lock state.</p>
      </main>
    );
  }

  return (
    <main className="finance-welcome">
      <Card className="finance-settings-card">
        <p className="finance-kicker">PRIVATE WORKSPACE</p>
        <h1>Unlock Finapp.</h1>
        <p>Verify with the passkey registered for this browser and account.</p>
        <p>
          This screen lock does not encrypt browser data. Anyone with browser-profile or developer
          tools access may still inspect the offline copy.
        </p>
        <Button onPress={unlock} disabled={pending} aria-busy={pending}>
          {pending ? 'Waiting for passkey…' : 'Unlock with passkey'}
        </Button>
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
