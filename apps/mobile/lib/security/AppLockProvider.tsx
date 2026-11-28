import React from 'react';
import { useRouter } from 'expo-router';
import { AppState, Platform, View } from 'react-native';
import { useAction, useConvex, useConvexAuth } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import {
  LockScreen,
  lockTimedOut,
  lockTimeoutKey,
  parseLockTimeout,
  type LockTimeoutMinutes,
} from '@finapp/ui/finance';
import Storage from 'expo-sqlite/kv-store';
import { useLocalRecords } from '@/hooks/useLocalRecords';
import type { LocalRecord } from '@/local/repository';
import { clearValidatedLocalUserId } from '@/local/identity';
import { unregisterPush } from '@/lib/push';
import { api } from '@convex/_generated/api';
import { Button, InputOTP, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { PasscodeInput } from './PasscodeInput';
import {
  authenticateDevice,
  clearPasscodeThrottle,
  createPasscodeLock,
  readAppLock,
  readPasscodeThrottle,
  recordFailedPasscode,
  saveAppLock,
  verifyPasscode,
  type AppLock,
} from './app-lock';

type LockState = {
  userId: string | null;
  lock: AppLock | null;
  phase: 'checking' | 'locked' | 'unlocked' | 'error';
  error?: string;
};
type LockContextValue = {
  lock: AppLock | null;
  ready: boolean;
  changeLock: (next: 'device' | 'passcode' | null, code?: string) => Promise<void>;
  /** Minutes in the background before the lock asks again (Settings → Security). */
  timeoutMinutes: LockTimeoutMinutes;
  setTimeoutMinutes: (minutes: LockTimeoutMinutes) => void;
};
const LockContext = React.createContext<LockContextValue | null>(null);

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong. Please try again.';
}

export function useAppLock(): LockContextValue {
  const value = React.useContext(LockContext);
  if (!value) throw new Error('App lock is unavailable outside the app provider.');
  return value;
}

export function AppLockProvider({
  userId,
  authRoute,
  children,
}: {
  userId: string | null;
  authRoute: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = React.useState<LockState>({
    userId: null,
    lock: null,
    phase: 'checking',
  });
  const convex = useConvex();
  const { signOut } = useAuthActions();
  const profile = useLocalRecords<LocalRecord>(userId, 'profile').data?.[0];
  const [code, setCode] = React.useState('');
  const [newCode, setNewCode] = React.useState('');
  const [confirmCode, setConfirmCode] = React.useState('');
  const [resetChallenge, setResetChallenge] = React.useState('');
  const [resetStep, setResetStep] = React.useState<'none' | 'email' | 'new-code'>('none');
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();
  const [retryAt, setRetryAt] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const generation = React.useRef(0);
  const activeState = React.useRef(AppState.currentState);
  const backgroundAt = React.useRef<number | null>(null);
  const [timeoutMinutes, setTimeoutState] = React.useState<LockTimeoutMinutes>(
    parseLockTimeout(null),
  );
  React.useEffect(() => {
    if (!userId) return;
    try {
      setTimeoutState(parseLockTimeout(Storage.getItemSync(lockTimeoutKey(userId))));
    } catch {
      setTimeoutState(parseLockTimeout(null));
    }
  }, [userId]);
  const timeoutRef = React.useRef(timeoutMinutes);
  timeoutRef.current = timeoutMinutes;
  const setTimeoutMinutes = React.useCallback(
    (minutes: LockTimeoutMinutes) => {
      setTimeoutState(minutes);
      if (userId) {
        try {
          Storage.setItemSync(lockTimeoutKey(userId), String(minutes));
        } catch {
          // Kept for this session only.
        }
      }
    },
    [userId],
  );
  const lastPrompt = React.useRef(-1);
  const devicePromptInFlight = React.useRef(false);
  const suppressNextPrompt = React.useRef(false);
  const { isAuthenticated } = useConvexAuth();
  const requestReset = useAction(api.auth.requestAppLockReset);
  const verifyReset = useAction(api.auth.verifyAppLockReset);
  const { tokens } = useTheme();
  const scoped =
    state.userId === userId ? state : { userId, lock: null, phase: 'checking' as const };
  const locked = !!userId && !authRoute && scoped.phase !== 'unlocked';

  const reload = React.useCallback(async (target: string) => {
    const token = ++generation.current;
    setState({ userId: target, lock: null, phase: 'checking' });
    try {
      const lock = await readAppLock(target);
      const throttle = lock?.method === 'passcode' ? await readPasscodeThrottle(target) : null;
      if (token !== generation.current) return;
      setRetryAt(throttle?.retryAt ?? 0);
      setNow(Date.now());
      setState({ userId: target, lock, phase: lock ? 'locked' : 'unlocked' });
    } catch (cause) {
      if (token === generation.current)
        setState({ userId: target, lock: null, phase: 'error', error: errorMessage(cause) });
    }
  }, []);

  React.useEffect(() => {
    if (userId) void reload(userId);
    else {
      backgroundAt.current = null;
      ++generation.current;
      setState({ userId: null, lock: null, phase: 'unlocked' });
    }
    setCode('');
    setNewCode('');
    setConfirmCode('');
    setResetStep('none');
    setResetChallenge('');
    setRetryAt(0);
  }, [userId, reload]);

  React.useEffect(() => {
    if (!authRoute) return;
    setCode('');
    setNewCode('');
    setConfirmCode('');
    setResetStep('none');
  }, [authRoute]);
  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const previous = activeState.current;
      activeState.current = next;
      if (next === 'background' && previous !== 'background') {
        // Preserve the start time through iOS's inactive state; evaluate it when active returns.
        backgroundAt.current = userId ? Date.now() : null;
        if (devicePromptInFlight.current) suppressNextPrompt.current = true;
      } else if (next === 'active' && backgroundAt.current !== null) {
        const away = Date.now() - backgroundAt.current;
        backgroundAt.current = null;
        if (!userId || !lockTimedOut(away, timeoutRef.current)) return;
        ++generation.current;
        lastPrompt.current = -1;
        setState((old) => (old.lock ? { ...old, phase: 'locked', error: undefined } : old));
        setCode('');
        setResetStep('none');
        setNewCode('');
        setConfirmCode('');
        void reload(userId);
      }
    });
    return () => subscription.remove();
  }, [reload, userId]);

  const unlockDevice = React.useCallback(async () => {
    if (!userId || busy || scoped.phase !== 'locked' || scoped.lock?.method !== 'device') return;
    const token = generation.current;
    setBusy(true);
    devicePromptInFlight.current = true;
    try {
      if ((await authenticateDevice()) && token === generation.current)
        setState((old) =>
          old.userId === userId ? { ...old, phase: 'unlocked', error: undefined } : old,
        );
    } catch (cause) {
      if (token === generation.current) setState((old) => ({ ...old, error: errorMessage(cause) }));
    } finally {
      devicePromptInFlight.current = false;
      setBusy(false);
    }
  }, [busy, scoped.lock, scoped.phase, userId]);

  React.useEffect(() => {
    if (authRoute || scoped.phase !== 'locked' || scoped.lock?.method !== 'device') return;
    if (lastPrompt.current === generation.current) return;
    lastPrompt.current = generation.current;
    if (suppressNextPrompt.current) {
      suppressNextPrompt.current = false;
      return;
    }
    void unlockDevice();
  }, [authRoute, scoped.phase, scoped.lock, unlockDevice]);

  React.useEffect(() => {
    if (!retryAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [retryAt]);

  async function unlockPasscode() {
    if (!userId || scoped.lock?.method !== 'passcode' || busy || code.length !== 6 || retryAt > now)
      return;
    const token = generation.current;
    setBusy(true);
    try {
      const throttle = await readPasscodeThrottle(userId);
      if (token !== generation.current) return;
      if (throttle.retryAt > Date.now()) {
        setRetryAt(throttle.retryAt);
        return;
      }
      const verified = await verifyPasscode(scoped.lock, code);
      if (token !== generation.current) return;
      if (verified) {
        await clearPasscodeThrottle(userId);
        if (token !== generation.current) return;
        setState((old) =>
          old.userId === userId ? { ...old, phase: 'unlocked', error: undefined } : old,
        );
        setRetryAt(0);
      } else {
        const next = await recordFailedPasscode(userId);
        if (token !== generation.current) return;
        setRetryAt(next.retryAt);
        setState((old) => ({ ...old, error: 'Incorrect passcode. Try again.' }));
      }
    } catch (cause) {
      if (token === generation.current) setState((old) => ({ ...old, error: errorMessage(cause) }));
    } finally {
      setCode('');
      setBusy(false);
    }
  }

  async function sendReset() {
    if (!userId || busy || !isAuthenticated) return;
    const token = generation.current;
    setBusy(true);
    setState((old) => ({ ...old, error: undefined }));
    try {
      const result = await requestReset({});
      if (token !== generation.current) return;
      if (result.userId !== userId)
        throw new Error('Sign in to this account before resetting its passcode.');
      setResetChallenge(result.challengeId);
      setResetStep('email');
      setCode('');
    } catch (cause) {
      if (token === generation.current) setState((old) => ({ ...old, error: errorMessage(cause) }));
    } finally {
      setBusy(false);
    }
  }

  async function checkReset() {
    if (!userId || busy || code.length !== 6 || !resetChallenge) return;
    const token = generation.current;
    setBusy(true);
    setState((old) => ({ ...old, error: undefined }));
    try {
      const result = await verifyReset({ challengeId: resetChallenge, code });
      if (token !== generation.current) return;
      if (result.userId !== userId || !result.verified)
        throw new Error('Invalid or expired reset code. You can request a new one.');
      setResetStep('new-code');
      setCode('');
    } catch (cause) {
      if (token === generation.current) setState((old) => ({ ...old, error: errorMessage(cause) }));
    } finally {
      setBusy(false);
    }
  }

  async function finishReset() {
    if (!userId || busy) return;
    if (newCode.length !== 6 || newCode !== confirmCode) {
      setState((old) => ({ ...old, error: 'Enter matching six-digit passcodes.' }));
      return;
    }
    const token = generation.current;
    setBusy(true);
    try {
      const lock = await createPasscodeLock(newCode);
      if (token !== generation.current) return;
      await saveAppLock(userId, lock);
      await clearPasscodeThrottle(userId);
      if (token !== generation.current) return;
      setState({ userId, lock, phase: 'unlocked' });
      setResetStep('none');
      setResetChallenge('');
      setNewCode('');
      setConfirmCode('');
      setRetryAt(0);
    } catch (cause) {
      if (token === generation.current) setState((old) => ({ ...old, error: errorMessage(cause) }));
    } finally {
      setBusy(false);
    }
  }

  const changeLock = React.useCallback(
    async (next: 'device' | 'passcode' | null, passcode?: string) => {
      if (!userId || scoped.phase !== 'unlocked') throw new Error('Unlock the app first.');
      if (Platform.OS === 'web') throw new Error('App lock is only available on mobile devices.');
      const token = generation.current;
      let lock: AppLock | null = null;
      if (next === 'device') {
        if (!(await authenticateDevice())) throw new Error('Device authentication was cancelled.');
        lock = { method: 'device' };
      } else if (next === 'passcode') {
        lock = await createPasscodeLock(passcode ?? '');
      }
      if (token !== generation.current) throw new Error('App lock change was interrupted.');
      await saveAppLock(userId, lock);
      await clearPasscodeThrottle(userId);
      if (token !== generation.current) throw new Error('App lock change was interrupted.');
      ++generation.current;
      setState({ userId, lock, phase: 'unlocked' });
    },
    [scoped.phase, userId],
  );

  const value = React.useMemo(
    () => ({
      lock: scoped.lock,
      ready: scoped.phase === 'unlocked',
      changeLock,
      timeoutMinutes,
      setTimeoutMinutes,
    }),
    [scoped.lock, scoped.phase, changeLock, timeoutMinutes, setTimeoutMinutes],
  );

  const displayName =
    (typeof profile?.displayName === 'string' && profile.displayName.trim()) ||
    (typeof profile?.username === 'string' && profile.username.trim()) ||
    'Your account';
  const person = {
    name: displayName,
    ...(typeof profile?.username === 'string' && profile.username.trim()
      ? { username: profile.username.trim() }
      : {}),
    initials:
      displayName
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'F',
    imageUrl: typeof profile?.avatarUrl === 'string' ? profile.avatarUrl : null,
    ...(typeof profile?.avatarId === 'string' ? { avatarId: profile.avatarId } : {}),
  };
  async function signOutHere() {
    await unregisterPush(convex).catch(() => undefined);
    await clearValidatedLocalUserId().catch(() => undefined);
    await signOut().catch(() => undefined);
    router.replace('/(auth)/sign-in');
  }

  return (
    <LockContext.Provider value={value}>
      <View
        style={{ flex: 1 }}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
        pointerEvents={locked ? 'none' : 'auto'}
      >
        {children}
      </View>
      {locked && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 2000,
            elevation: 20,
            backgroundColor: tokens.background,
          }}
        >
          <LockScreen
            person={person}
            title={
              scoped.phase === 'checking'
                ? 'Checking your app lock…'
                : scoped.phase === 'error'
                  ? 'Can’t read the app lock'
                  : resetStep === 'email'
                    ? 'Check your email'
                    : resetStep === 'new-code'
                      ? 'Choose a new passcode'
                      : 'Finapp is locked'
            }
            subtitle={
              scoped.phase === 'error'
                ? 'Secure storage didn’t respond. Try again.'
                : scoped.phase !== 'locked'
                  ? undefined
                  : scoped.lock?.method === 'device'
                    ? 'Unlock with your fingerprint, face or device PIN'
                    : resetStep === 'email'
                      ? 'Enter the code we sent to your email. It expires in 10 minutes.'
                      : resetStep === 'new-code'
                        ? 'Pick six digits you’ll remember'
                        : 'Enter your six-digit passcode'
            }
            {...(isAuthenticated ? { onSignOut: () => void signOutHere() } : {})}
          >
            {scoped.phase === 'error' && (
              <Button onPress={() => void reload(userId!)}>Try again</Button>
            )}
            {scoped.phase === 'locked' && scoped.lock?.method === 'device' && (
              <Button disabled={busy} onPress={() => void unlockDevice()}>
                {busy ? 'Checking…' : 'Unlock'}
              </Button>
            )}
            {scoped.phase === 'locked' && scoped.lock?.method === 'passcode' && (
              <>
                {resetStep === 'none' && (
                  <>
                    <PasscodeInput value={code} onChangeText={setCode} label="App passcode" />
                    <Button
                      disabled={busy || code.length !== 6 || retryAt > now}
                      onPress={() => void unlockPasscode()}
                    >
                      {retryAt > now
                        ? `Try again in ${Math.ceil((retryAt - now) / 1000)}s`
                        : busy
                          ? 'Checking…'
                          : 'Unlock'}
                    </Button>
                    {isAuthenticated ? (
                      <Button variant="ghost" disabled={busy} onPress={() => void sendReset()}>
                        Forgot passcode?
                      </Button>
                    ) : null}
                  </>
                )}
                {resetStep === 'email' && (
                  <>
                    <InputOTP value={code} onChangeText={setCode} />
                    <Button disabled={busy || code.length !== 6} onPress={() => void checkReset()}>
                      {busy ? 'Verifying…' : 'Verify code'}
                    </Button>
                    <Button variant="ghost" disabled={busy} onPress={() => void sendReset()}>
                      Send a new code
                    </Button>
                    <Button
                      variant="ghost"
                      onPress={() => {
                        setResetStep('none');
                        setCode('');
                      }}
                    >
                      Back
                    </Button>
                  </>
                )}
                {resetStep === 'new-code' && (
                  <>
                    <PasscodeInput
                      value={newCode}
                      onChangeText={setNewCode}
                      label="New app passcode"
                    />
                    <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>Repeat it</Text>
                    <PasscodeInput
                      value={confirmCode}
                      onChangeText={setConfirmCode}
                      label="Repeat app passcode"
                    />
                    <Button
                      disabled={busy || newCode.length !== 6 || confirmCode.length !== 6}
                      onPress={() => void finishReset()}
                    >
                      {busy ? 'Saving…' : 'Save and unlock'}
                    </Button>
                  </>
                )}
                {!isAuthenticated && resetStep !== 'new-code' && (
                  <Button variant="outline" onPress={() => router.push('/(auth)/sign-in')}>
                    Sign in to reset your passcode
                  </Button>
                )}
              </>
            )}
            {!!scoped.error && (
              <Typography
                variant="small"
                accessibilityLiveRegion="polite"
                style={{ color: tokens.destructive, textAlign: 'center' }}
              >
                {scoped.error}
              </Typography>
            )}
          </LockScreen>
        </View>
      )}
    </LockContext.Provider>
  );
}
