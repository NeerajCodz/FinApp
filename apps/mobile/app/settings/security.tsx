import React from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
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
} from 'lucide-react-native';
import { Button, useTheme } from '@finapp/ui/native';
import {
  SettingsGroup,
  SettingsHero,
  SettingsItem,
  SettingsLink,
  SettingsScreen,
  SettingsSwitch,
  useSettingsToneColor,
} from '@finapp/ui/finance';
import { useLocalSync } from '@/providers/LocalSyncProvider';
import { useAppLock } from '@/lib/security/AppLockProvider';
import { canUseDeviceLock } from '@/lib/security/app-lock';
import { PasscodeInput } from '@/lib/security/PasscodeInput';
import { toast } from '@/lib/toast';

function ago(timestamp: number, now = Date.now()) {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 5) return 'Active now';
  if (minutes < 60) return `Active ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Active ${hours} h ago`;
  const days = Math.round(hours / 24);
  return `Active ${days} day${days === 1 ? '' : 's'} ago`;
}

const errorText = (cause: unknown, fallback: string) =>
  cause instanceof Error ? cause.message.replace(/^.*Uncaught Error:\s*/, '') : fallback;

/** Sign-in protection, devices on the account, alerts, and this phone's app lock. */
export default function SecuritySettingsScreen() {
  const { tokens } = useTheme();
  const tone = useSettingsToneColor();
  const { isConnected } = useLocalSync();
  const { lock, ready, changeLock } = useAppLock();
  const preferences = useQuery(api.users.queries.securityPreferences, isConnected ? {} : 'skip');
  const privacy = useQuery(api.security.privacy, isConnected ? {} : 'skip');
  const sessions = useQuery(api.security.sessions, isConnected ? {} : 'skip');
  const setTwoFactor = useMutation(api.users.mutations.setTwoFactorEnabled);
  const updatePrivacy = useMutation(api.security.updatePrivacy);
  const signOutSession = useMutation(api.security.signOutSession);
  const signOutOthers = useMutation(api.security.signOutOtherSessions);
  const [deviceLockAvailable, setDeviceLockAvailable] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');

  React.useEffect(() => {
    let active = true;
    canUseDeviceLock()
      .then((supported) => active && setDeviceLockAvailable(supported))
      .catch(() => active && setDeviceLockAvailable(false));
    return () => {
      active = false;
    };
  }, []);

  const run = async (key: string, task: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await task();
      void Haptics.selectionAsync();
      if (done) toast.success(done);
    } catch (cause) {
      toast.error(errorText(cause, 'Something went wrong. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const twoFactor = preferences?.twoFactorEnabled ?? false;
  const others = (sessions ?? []).filter((session) => !session.current);
  const score = [twoFactor, !!lock, privacy?.signInAlerts !== false].filter(Boolean).length;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/settings'));

  return (
    <SettingsScreen title="Security" subtitle="Sign-in, devices and app lock" onBack={back}>
      <SettingsHero
        icon={
          score === 3 ? (
            <ShieldCheck size={22} color={tone('positive')} />
          ) : (
            <ShieldAlert size={22} color={tone('warning')} />
          )
        }
        title={score === 3 ? 'Your account is well protected' : `${score} of 3 protections on`}
        description={[
          twoFactor ? 'Two-factor on' : 'Two-factor off',
          lock ? 'app lock on' : 'app lock off',
          `${sessions?.length ?? 0} signed-in device${sessions?.length === 1 ? '' : 's'}`,
        ].join(' · ')}
      />

      <SettingsGroup title="Sign-in">
        <SettingsSwitch
          icon={<MailCheck size={19} color={tone('positive')} />}
          tone="positive"
          title="Two-factor sign-in"
          description="Ask for an email code after your password"
          checked={twoFactor}
          disabled={!isConnected || preferences == null || busy === '2fa'}
          onChange={(enabled) =>
            void run(
              '2fa',
              () => setTwoFactor({ enabled }),
              enabled ? 'Two-factor sign-in is on' : 'Two-factor sign-in is off',
            )
          }
        />
        <SettingsLink
          icon={<KeyRound size={19} color={tone('info')} />}
          tone="info"
          title="Change password"
          description="We’ll email you a link to set a new one"
          onPress={() => router.push('/forgot-password' as never)}
        />
        <SettingsSwitch
          icon={<BellRing size={19} color={tone('warning')} />}
          tone="warning"
          title="New sign-in alerts"
          description="Notify me when a new device signs in"
          checked={privacy?.signInAlerts ?? true}
          disabled={!isConnected || !privacy || busy === 'alerts'}
          onChange={(signInAlerts) => void run('alerts', () => updatePrivacy({ signInAlerts }))}
        />
      </SettingsGroup>

      <SettingsGroup title="Devices">
        {(sessions ?? []).map((session) => (
          <SettingsItem
            key={session.id}
            icon={
              session.platform === 'web' ? (
                <LaptopMinimal size={19} color={tone(session.current ? 'positive' : undefined)} />
              ) : (
                <Smartphone size={19} color={tone(session.current ? 'positive' : undefined)} />
              )
            }
            tone={session.current ? 'positive' : undefined}
            title={session.label}
            description={session.current ? 'This device' : ago(session.lastSeenAt)}
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
                      `Signed out ${session.label}`,
                    )
                  }
                >
                  Sign out
                </Button>
              )
            }
          />
        ))}
        {others.length > 0 ? (
          <SettingsLink
            icon={<LogOut size={19} color={tone('danger')} />}
            danger
            title="Sign out of all other devices"
            description={`${others.length} other device${others.length === 1 ? '' : 's'}`}
            onPress={
              busy
                ? undefined
                : () =>
                    Alert.alert('Sign out other devices?', 'They’ll need to sign in again.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Sign out',
                        style: 'destructive',
                        onPress: () =>
                          void run('others', async () => {
                            const count = await signOutOthers({});
                            toast.success(`Signed out ${count} device${count === 1 ? '' : 's'}`);
                          }),
                      },
                    ])
            }
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="App lock">
        <SettingsSwitch
          icon={<Fingerprint size={19} color={tone('violet')} />}
          tone="violet"
          title={Platform.OS === 'ios' ? 'Face ID or Touch ID' : 'Fingerprint or face unlock'}
          description={
            deviceLockAvailable
              ? 'Unlock Finapp with your device biometrics'
              : 'Set up biometrics in your phone’s settings first'
          }
          checked={lock?.method === 'device'}
          disabled={!ready || busy !== null || (!deviceLockAvailable && lock?.method !== 'device')}
          onChange={(on) =>
            void run(
              'lock',
              () => changeLock(on ? 'device' : null),
              on ? 'App lock is on' : 'App lock is off',
            )
          }
        />
        <SettingsItem
          icon={<LockKeyhole size={19} color={tone('primary')} />}
          tone="primary"
          title="Six-digit passcode"
          description={
            lock?.method === 'passcode'
              ? 'On. Forgot it? Reset with an email code while online.'
              : 'A code just for this phone'
          }
          trailing={
            creating ? null : (
              <Button
                size="sm"
                variant={lock?.method === 'passcode' ? 'outline' : 'primary'}
                disabled={!ready || busy !== null}
                onPress={() => setCreating(true)}
              >
                {lock?.method === 'passcode' ? 'Change' : 'Set up'}
              </Button>
            )
          }
        >
          {creating ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>New passcode</Text>
              <PasscodeInput value={code} onChangeText={setCode} label="New app passcode" />
              <Text style={{ color: tokens.foregroundMuted, fontSize: 12 }}>Repeat passcode</Text>
              <PasscodeInput
                value={confirmation}
                onChangeText={setConfirmation}
                label="Repeat app passcode"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button
                  size="sm"
                  disabled={busy !== null || code.length !== 6 || confirmation.length !== 6}
                  onPress={() =>
                    void run(
                      'passcode',
                      async () => {
                        if (code !== confirmation) throw new Error('The passcodes don’t match.');
                        await changeLock('passcode', code);
                        setCreating(false);
                        setCode('');
                        setConfirmation('');
                      },
                      'Passcode saved',
                    )
                  }
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    setCreating(false);
                    setCode('');
                    setConfirmation('');
                  }}
                >
                  Cancel
                </Button>
              </View>
            </View>
          ) : null}
        </SettingsItem>
        {lock ? (
          <SettingsLink
            icon={<LockKeyhole size={19} color={tone('danger')} />}
            danger
            title="Turn off app lock"
            onPress={
              busy ? undefined : () => void run('off', () => changeLock(null), 'App lock is off')
            }
          />
        ) : null}
      </SettingsGroup>
    </SettingsScreen>
  );
}
