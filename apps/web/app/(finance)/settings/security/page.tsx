'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BellRing,
  Fingerprint,
  KeyRound,
  LaptopMinimal,
  LockKeyhole,
  LogOut,
  MailCheck,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { Button } from '@finapp/ui/web';
import {
  SettingsField,
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsShell,
  SettingsSwitch,
} from '@finapp/ui/finance';
import { FinanceSignedOut } from '@/components/finance/FinanceSignedOut';
import { MfaSettings } from '@/components/security/MfaSettings';
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

function ago(timestamp: number, now = Date.now()) {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 5) return 'Active now';
  if (minutes < 60) return `Active ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30
    ? `Active ${days} day${days === 1 ? '' : 's'} ago`
    : `Active ${new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

const sixDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);
const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message.replace(/^.*Uncaught Error:\s*/, '') : fallback;

/** Sign-in protection, devices on the account, alerts, and this browser's screen lock. */
export default function SecuritySettingsPage() {
  const router = useRouter();
  const { userId, isConnected } = useBrowserSync();
  const live = Boolean(userId && isConnected);
  const preferences = useQuery(api.users.queries.securityPreferences, live ? {} : 'skip');
  const privacy = useQuery(api.security.privacy, live ? {} : 'skip');
  const sessions = useQuery(api.security.sessions, live ? {} : 'skip');
  const mfa = useQuery(api.mfa.status, live ? {} : 'skip');
  const setTwoFactor = useMutation(api.users.mutations.setTwoFactorEnabled);
  const updatePrivacy = useMutation(api.security.updatePrivacy);
  const signOutSession = useMutation(api.security.signOutSession);
  const signOutOthers = useMutation(api.security.signOutOtherSessions);

  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = React.useState(false);
  const [passkeyOn, setPasskeyOn] = React.useState(false);
  const [passcodeOn, setPasscodeOn] = React.useState(false);
  const [passcodeForm, setPasscodeForm] = React.useState<'set' | 'remove' | null>(null);
  const [passcode, setPasscode] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');

  const refreshLocks = React.useCallback(() => {
    if (!userId) return;
    try {
      setPasskeyOn(hasWebAuthnLock(userId));
      setPasscodeOn(hasPasscodeLock(userId));
    } catch {
      setMessage('Browser storage is unavailable, so the screen lock can’t be read.');
    }
  }, [userId]);
  React.useEffect(() => {
    let active = true;
    isWebAuthnLockAvailable()
      .then((value) => active && setPasskeyAvailable(value))
      .catch(() => active && setPasskeyAvailable(false));
    refreshLocks();
    return () => {
      active = false;
    };
  }, [refreshLocks]);

  const run = async (key: string, task: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setMessage('');
    try {
      await task();
      if (done) setMessage(done);
    } catch (cause) {
      setMessage(errorText(cause, 'Something went wrong. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  if (!userId)
    return (
      <FinanceSignedOut
        section="SECURITY"
        title="Keep access in your control."
        description="Sign in to manage two-factor sign-in, devices and this browser’s lock."
      />
    );

  const twoFactor = (preferences?.twoFactorEnabled ?? false) || (mfa?.totp ?? false);
  const others = (sessions ?? []).filter((session) => !session.current);
  const lockOn = passkeyOn || passcodeOn;
  const score = [twoFactor, lockOn, privacy?.signInAlerts !== false].filter(Boolean).length;

  return (
    <SettingsShell
      title="Security"
      subtitle="Sign-in, devices and screen lock"
      onBack={() => router.push('/settings')}
    >
      <SettingsHero
        icon={score === 3 ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
        title={score === 3 ? 'Your account is well protected' : `${score} of 3 protections on`}
        description={[
          twoFactor ? 'Two-factor on' : 'Two-factor off',
          lockOn ? 'screen lock on' : 'screen lock off',
          `${sessions?.length ?? 0} signed-in device${sessions?.length === 1 ? '' : 's'}`,
        ].join(' · ')}
      />

      <SettingsGroup title="Sign-in">
        <SettingsSwitch
          icon={<MailCheck size={19} />}
          tone="positive"
          title="Email codes"
          description="Ask for a six-digit email code after your password"
          checked={preferences?.twoFactorEnabled ?? false}
          disabled={!live || preferences == null || busy === '2fa'}
          onChange={(enabled) =>
            void run(
              '2fa',
              () => setTwoFactor({ enabled }),
              enabled ? 'Two-factor sign-in is on.' : 'Two-factor sign-in is off.',
            )
          }
        />
        <MfaSettings live={live} onMessage={setMessage} />
        <SettingsLink
          icon={<KeyRound size={19} />}
          tone="info"
          title="Change password"
          description="We’ll email you a link to set a new one"
          onPress={() => router.push('/forgot-password')}
        />
        <SettingsSwitch
          icon={<BellRing size={19} />}
          tone="warning"
          title="New sign-in alerts"
          description="Notify me when a new device signs in to my account"
          checked={privacy?.signInAlerts ?? true}
          disabled={!live || !privacy || busy === 'alerts'}
          onChange={(signInAlerts) => void run('alerts', () => updatePrivacy({ signInAlerts }))}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Devices"
        description="Everywhere you’re signed in. Sign out anything you don’t recognise."
      >
        {sessions === undefined ? (
          <SettingsItem icon={<LaptopMinimal size={19} />} title="Loading devices…" />
        ) : (
          sessions.map((session) => (
            <SettingsItem
              key={session.id}
              icon={
                session.platform === 'web' ? <LaptopMinimal size={19} /> : <Smartphone size={19} />
              }
              tone={session.current ? 'positive' : undefined}
              title={session.label}
              description={`${session.current ? 'This device' : ago(session.lastSeenAt)} · Signed in ${new Date(session.signedInAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`}
              trailing={
                session.current ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onPress={() =>
                      void run(
                        `session:${session.id}`,
                        () => signOutSession({ sessionId: session.id as Id<'authSessions'> }),
                        `Signed out ${session.label}.`,
                      )
                    }
                  >
                    {busy === `session:${session.id}` ? 'Signing out…' : 'Sign out'}
                  </Button>
                )
              }
            />
          ))
        )}
        {others.length > 0 ? (
          <SettingsLink
            icon={<LogOut size={19} />}
            danger
            title="Sign out of all other devices"
            description={`${others.length} other device${others.length === 1 ? '' : 's'}`}
            onPress={
              busy
                ? undefined
                : () => {
                    if (
                      !window.confirm('Sign out every other device? They’ll need to sign in again.')
                    )
                      return;
                    void run('others', async () => {
                      const count = await signOutOthers({});
                      setMessage(`Signed out ${count} device${count === 1 ? '' : 's'}.`);
                    });
                  }
            }
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup
        title="This browser’s lock"
        description="Ask for a passkey or passcode before showing Finapp here. It guards the screen; it doesn’t encrypt browser storage."
      >
        <SettingsItem
          icon={<Fingerprint size={19} />}
          tone="violet"
          title="Passkey"
          description={
            passkeyAvailable
              ? passkeyOn
                ? 'On: unlock with Windows Hello, Touch ID or your phone'
                : 'Unlock with Windows Hello, Touch ID or your phone'
              : 'Needs a secure connection and a device that supports passkeys'
          }
          trailing={
            <>
              {passkeyOn ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() =>
                    void run(
                      'passkey-off',
                      async () => {
                        await unlockWithWebAuthn(userId);
                        removeWebAuthnLock(userId);
                        refreshLocks();
                      },
                      'Passkey lock removed.',
                    )
                  }
                >
                  Turn off
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={passkeyOn ? 'outline' : 'primary'}
                disabled={!passkeyAvailable || busy !== null}
                onPress={() =>
                  void run(
                    'passkey',
                    async () => {
                      if (passkeyOn) await unlockWithWebAuthn(userId);
                      await enableWebAuthnLock(userId);
                      refreshLocks();
                    },
                    'Passkey lock is on.',
                  )
                }
              >
                {passkeyOn ? 'Change' : 'Turn on'}
              </Button>
            </>
          }
        />
        <SettingsItem
          icon={<LockKeyhole size={19} />}
          tone="primary"
          title="Six-digit passcode"
          description={passcodeOn ? 'On' : 'A backup when a passkey isn’t available'}
          trailing={
            passcodeForm ? null : (
              <>
                {passcodeOn ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onPress={() => setPasscodeForm('remove')}
                  >
                    Turn off
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant={passcodeOn ? 'outline' : 'primary'}
                  disabled={busy !== null}
                  onPress={() => setPasscodeForm('set')}
                >
                  {passcodeOn ? 'Change' : 'Set up'}
                </Button>
              </>
            )
          }
        >
          {passcodeForm ? (
            <form
              style={{ display: 'grid', gap: 10, maxWidth: 320 }}
              onSubmit={(event) => {
                event.preventDefault();
                if (passcodeForm === 'remove')
                  void run(
                    'passcode',
                    async () => {
                      if (!(await verifyPasscodeLock(userId, passcode)))
                        throw new Error('That passcode is incorrect.');
                      removePasscodeLock(userId);
                      refreshLocks();
                      setPasscodeForm(null);
                      setPasscode('');
                    },
                    'Passcode lock removed.',
                  );
                else
                  void run(
                    'passcode',
                    async () => {
                      if (!/^\d{6}$/.test(passcode) || passcode !== confirmation)
                        throw new Error('Enter the same six digits twice.');
                      await setPasscodeLock(userId, passcode);
                      refreshLocks();
                      setPasscodeForm(null);
                      setPasscode('');
                      setConfirmation('');
                    },
                    'Passcode lock is on.',
                  );
              }}
            >
              <SettingsField
                label={passcodeForm === 'remove' ? 'Current passcode' : 'New passcode'}
                type="password"
                inputMode="numeric"
                autoComplete={passcodeForm === 'remove' ? 'current-password' : 'new-password'}
                autoFocus
                maxLength={6}
                value={passcode}
                onChange={(event) => setPasscode(sixDigits(event.target.value))}
              />
              {passcodeForm === 'set' ? (
                <SettingsField
                  label="Repeat passcode"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={confirmation}
                  onChange={(event) => setConfirmation(sixDigits(event.target.value))}
                />
              ) : null}
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  type="submit"
                  variant={passcodeForm === 'remove' ? 'destructive' : 'primary'}
                  disabled={busy !== null || passcode.length !== 6}
                >
                  {passcodeForm === 'remove' ? 'Turn off passcode' : 'Save passcode'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setPasscodeForm(null);
                    setPasscode('');
                    setConfirmation('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
        </SettingsItem>
      </SettingsGroup>

      {message || !isConnected ? (
        <p
          role="status"
          style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--finapp-foreground-muted)' }}
        >
          {message || 'You’re offline. Reconnect to change sign-in settings and devices.'}
        </p>
      ) : null}
    </SettingsShell>
  );
}
