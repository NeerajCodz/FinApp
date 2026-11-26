'use client';

import * as React from 'react';
import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';
import { formatAuthError } from '@convex/shared/authErrors';
import { Fingerprint } from 'lucide-react';
import { useAuthActions } from '@convex-dev/auth/react';
import { Button } from '@finapp/ui/web';
import {
  lockLastActiveKey,
  lockTimedOut,
  lockTimeoutKey,
  LockPinInput,
  LockScreen,
  parseLockTimeout,
} from '@finapp/ui/finance';
import { useLocalRecords } from '@/lib/offline/hooks';
import type { LocalRecord } from '@/lib/offline/repository';
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

type LockProfile = LocalRecord & {
  displayName?: string;
  username?: string;
  avatarId?: string;
  avatarUrl?: string | null;
};

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
  const phaseRef = React.useRef<string>('checking');
  const [checkedUser, setCheckedUser] = React.useState<string | null>(null);
  const [passkeyEnabled, setPasskeyEnabled] = React.useState(false);
  const [passcodeStatus, setPasscodeStatus] = React.useState(emptyPasscodeStatus);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [challengeId, setChallengeId] = React.useState('');
  const [code, setCode] = React.useState('');
  const [passcode, setPasscode] = React.useState('');
  const passcodeForm = React.useRef<HTMLFormElement>(null);
  const { signOut } = useAuthActions();
  const profile = useLocalRecords<LockProfile>('profile').records[0];

  React.useEffect(() => {
    phaseRef.current = phase;
    if (phase !== 'open' || !userId) return;
    try {
      window.localStorage.setItem(lockLastActiveKey(userId), String(Date.now()));
    } catch {
      // Without storage the lock simply asks again on the next visit.
    }
  }, [phase, userId]);

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
    // Time away decides whether to lock: Settings → Security → "Lock after" (default 5 min).
    const timeout = () => {
      try {
        return parseLockTimeout(window.localStorage.getItem(lockTimeoutKey(userId)));
      } catch {
        return parseLockTimeout(null);
      }
    };
    const markActive = () => {
      // Only time spent unlocked counts; a visible lock screen is not activity.
      if (phaseRef.current !== 'open') return;
      try {
        window.localStorage.setItem(lockLastActiveKey(userId), String(Date.now()));
      } catch {
        // Without storage the lock simply asks again on the next visit.
      }
    };
    const awayTooLong = () => {
      try {
        const last = Number(window.localStorage.getItem(lockLastActiveKey(userId)));
        return !last || lockTimedOut(Date.now() - last, timeout());
      } catch {
        return true;
      }
    };
    const refreshLock = (lockIfAway: boolean) => {
      if (!active) return;
      try {
        setPasskeyEnabled(hasWebAuthnLock(userId));
        setPasscodeStatus(getPasscodeLockStatus(userId));
        if (!hasBrowserLock(userId)) setPhase('open');
        else
          setPhase((previous) =>
            previous === 'open' && !(lockIfAway && awayTooLong()) ? 'open' : 'locked',
          );
      } catch {
        setPhase('storage-error');
      }
    };
    const refreshAfterConfiguration = () => refreshLock(false);
    const refreshFromExternalChange = () => refreshLock(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markActive();
      else refreshLock(true);
    };
    // A fresh load opens only if this browser was active within the timeout.
    try {
      if (!hasBrowserLock(userId)) setPhase('open');
      else {
        setPasskeyEnabled(hasWebAuthnLock(userId));
        setPasscodeStatus(getPasscodeLockStatus(userId));
        setPhase(awayTooLong() ? 'locked' : 'open');
      }
    } catch {
      setPhase('storage-error');
    }
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') markActive();
    }, 30_000);
    window.addEventListener('beforeunload', markActive);
    window.addEventListener(webAuthnLockChangedEvent, refreshAfterConfiguration);
    window.addEventListener('storage', refreshFromExternalChange);
    window.addEventListener('focus', refreshFromExternalChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener(webAuthnLockChangedEvent, refreshAfterConfiguration);
      window.removeEventListener('storage', refreshFromExternalChange);
      window.removeEventListener('focus', refreshFromExternalChange);
      window.clearInterval(heartbeat);
      window.removeEventListener('beforeunload', markActive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);

  React.useEffect(() => {
    if (!userId || !passcodeStatus.retryAt) return;
    const timer = window.setTimeout(
      () => {
        try {
          setPasscodeStatus(getPasscodeLockStatus(userId));
        } catch {
          setPhase('storage-error');
        }
      },
      Math.max(0, passcodeStatus.retryAt - Date.now()) + 1,
    );
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
      setError(formatAuthError(cause, 'verification'));
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
      setError(formatAuthError(cause, 'verification'));
    } finally {
      setPending(false);
    }
  }

  if (!userId || (phase === 'open' && checkedUser === userId)) return children;

  const displayName = profile?.displayName?.trim() || profile?.username?.trim() || 'Your account';
  const person = {
    name: displayName,
    ...(profile?.username?.trim() ? { username: profile.username.trim() } : {}),
    initials:
      displayName
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'F',
    imageUrl: profile?.avatarUrl ?? null,
    ...(profile?.avatarId ? { avatarId: profile.avatarId } : {}),
  };
  const signOutHere = async () => {
    try {
      await signOut();
    } finally {
      window.location.assign('/sign-in');
    }
  };

  if (phase === 'checking' || checkedUser !== userId)
    return <LockScreen person={person} title="Checking this browser…" />;
  if (phase === 'storage-error')
    return (
      <LockScreen
        person={person}
        title="Can’t read this browser’s lock"
        subtitle="Browser storage is unavailable, so Finapp can’t safely check the lock. Allow site data for Finapp and reload."
        onSignOut={() => void signOutHere()}
      >
        <Button onPress={() => window.location.reload()}>Reload</Button>
      </LockScreen>
    );

  const lockedOut = passcodeStatus.retryAt > Date.now();
  return (
    <LockScreen
      person={person}
      title={challengeId ? 'Recover access' : 'Finapp is locked'}
      subtitle={
        challengeId
          ? 'Enter the six-digit code we emailed you. It removes this browser’s lock.'
          : passkeyEnabled && passcodeStatus.configured
            ? 'Use your passkey or enter your passcode'
            : passkeyEnabled
              ? 'Use your passkey to continue'
              : 'Enter your six-digit passcode'
      }
      note="The lock hides Finapp on this browser. It doesn’t encrypt the offline copy."
      onSignOut={() => void signOutHere()}
    >
      {!challengeId ? (
        <>
          {passkeyEnabled ? (
            <Button onPress={unlockWithPasskey} disabled={pending || lockedOut}>
              <Fingerprint size={18} aria-hidden />{' '}
              {pending ? 'Waiting for passkey…' : 'Unlock with passkey'}
            </Button>
          ) : null}
          {passcodeStatus.configured ? (
            <form
              ref={passcodeForm}
              onSubmit={unlockWithPasscode}
              style={{ display: 'grid', gap: 10 }}
            >
              <LockPinInput
                id="lock-passcode"
                label="Six-digit passcode"
                value={passcode}
                onChange={setPasscode}
                onComplete={() =>
                  requestAnimationFrame(() => passcodeForm.current?.requestSubmit())
                }
                disabled={pending || lockedOut}
                autoFocus={!passkeyEnabled}
              />
              <p
                role="status"
                style={{
                  margin: 0,
                  fontSize: 12,
                  textAlign: 'center',
                  color: 'var(--finapp-foreground-muted)',
                }}
              >
                {lockedOut
                  ? 'Too many attempts. Try again in 30 seconds.'
                  : passcodeStatus.attemptsRemaining < 5
                    ? `${passcodeStatus.attemptsRemaining} attempts left before a 30-second pause`
                    : ' '}
              </p>
              <Button
                type="submit"
                variant={passkeyEnabled ? 'outline' : 'primary'}
                disabled={pending || !/^\d{6}$/.test(passcode) || lockedOut}
                aria-busy={pending}
              >
                Unlock
              </Button>
            </form>
          ) : null}
          <Button variant="ghost" onPress={sendRecoveryCode} disabled={pending}>
            Forgot it? Recover with email
          </Button>
        </>
      ) : (
        <form onSubmit={recover} style={{ display: 'grid', gap: 10 }}>
          <LockPinInput
            id="lock-recovery-code"
            label="Six-digit email code"
            value={code}
            onChange={setCode}
            disabled={pending}
            autoFocus
          />
          <Button type="submit" disabled={pending || !/^\d{6}$/.test(code)} aria-busy={pending}>
            Verify and unlock
          </Button>
          <Button type="button" variant="ghost" onPress={sendRecoveryCode} disabled={pending}>
            Send a new code
          </Button>
          <Button
            type="button"
            variant="ghost"
            onPress={() => {
              setChallengeId('');
              setCode('');
            }}
          >
            Back
          </Button>
        </form>
      )}
      {error ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 13,
            textAlign: 'center',
            color: 'var(--finapp-destructive)',
          }}
        >
          {error}
        </p>
      ) : null}
    </LockScreen>
  );
}
