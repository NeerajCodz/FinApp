import React from 'react';
import { Platform, ScrollView, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowLeft } from '@/lib/icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, Separator, Text, Typography } from '@finapp/ui/native';
import { useTheme } from '@finapp/ui/native';
import { useAppLock } from '@/lib/security/AppLockProvider';
import { canUseDeviceLock } from '@/lib/security/app-lock';
import { PasscodeInput } from '@/lib/security/PasscodeInput';

export default function SecuritySettingsScreen() {
  const { lock, ready, changeLock } = useAppLock();
  const [available, setAvailable] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [code, setCode] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [error, setError] = React.useState('');
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    let active = true;
    void canUseDeviceLock()
      .then((supported) => {
        if (active) setAvailable(supported);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function change(next: 'device' | 'passcode' | null) {
    if (pending) return;
    if (next === 'passcode' && (code.length !== 6 || code !== confirmation)) {
      setError('Enter matching six-digit passcodes.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await changeLock(next, next === 'passcode' ? code : undefined);
      void Haptics.selectionAsync();
      setCreating(false);
      setCode('');
      setConfirmation('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change app lock.');
    } finally {
      setPending(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.background }}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        gap: 32,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton label="Go back" variant="ghost" onPress={() => router.back()}>
          <ArrowLeft size={21} color={tokens.foreground} />
        </IconButton>
        <Typography variant="title">Security</Typography>
      </View>
      <View style={{ gap: 16 }}>
        <Typography variant="label">App access</Typography>
        <Text style={{ color: tokens.foregroundMuted }}>
          {lock?.method === 'device'
            ? 'Device unlock is on.'
            : lock?.method === 'passcode'
              ? 'App passcode is on.'
              : 'App lock is off.'}
        </Text>
        <Separator />
        <View style={{ gap: 10 }}>
          <Typography variant="label">Device biometrics</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            Uses your enrolled biometrics, with the device passcode or credential offered by the
            operating system. This cannot be reset by email.
          </Text>
          <Button
            variant={lock?.method === 'device' ? 'outline' : 'primary'}
            disabled={!ready || pending || !available || lock?.method === 'device'}
            onPress={() => void change('device')}
          >
            {lock?.method === 'device' ? 'Device unlock enabled' : 'Use device unlock'}
          </Button>
          {!available && (
            <Text style={{ color: tokens.foregroundMuted }}>
              {Platform.OS === 'web'
                ? 'Available only on a mobile device.'
                : 'Enroll biometrics in your device settings to enable this option.'}
            </Text>
          )}
        </View>
        <Separator />
        <View style={{ gap: 10 }}>
          <Typography variant="label">In-app passcode</Typography>
          <Text style={{ color: tokens.foregroundMuted }}>
            A separate six-digit code for this device. If you forget it, reset it using a code sent
            to your verified account email while signed in online.
          </Text>
          {!creating ? (
            <Button
              variant={lock?.method === 'passcode' ? 'outline' : 'primary'}
              disabled={!ready || pending || Platform.OS === 'web'}
              onPress={() => setCreating(true)}
            >
              {lock?.method === 'passcode' ? 'Change app passcode' : 'Set app passcode'}
            </Button>
          ) : (
            <View style={{ gap: 12 }}>
              <Text>New six-digit passcode</Text>
              <PasscodeInput value={code} onChangeText={setCode} label="New app passcode" />
              <Text>Confirm passcode</Text>
              <PasscodeInput
                value={confirmation}
                onChangeText={setConfirmation}
                label="Confirm app passcode"
              />
              <Button
                disabled={!ready || pending || code.length !== 6 || confirmation.length !== 6}
                onPress={() => void change('passcode')}
              >
                {pending ? 'Saving…' : 'Save passcode'}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onPress={() => {
                  setCreating(false);
                  setCode('');
                  setConfirmation('');
                  setError('');
                }}
              >
                Cancel
              </Button>
            </View>
          )}
        </View>
        {!!lock && (
          <>
            <Separator />
            <Button
              variant="outline"
              disabled={!ready || pending}
              onPress={() => void change(null)}
            >
              Turn off app lock
            </Button>
          </>
        )}
        {!!error && (
          <Typography
            variant="small"
            accessibilityLiveRegion="polite"
            style={{ color: tokens.destructive }}
          >
            {error}
          </Typography>
        )}
      </View>
    </ScrollView>
  );
}
