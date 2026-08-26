import * as LocalAuthentication from 'expo-local-authentication';

export type AppLockPreferences = { enabled: boolean; fallback: 'device-pin' | 'disabled' };

export async function canUseBiometrics(): Promise<boolean> {
  return (
    (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  );
}

export async function unlockApp(preferences: AppLockPreferences): Promise<boolean> {
  if (!preferences.enabled) return true;
  if (!(await canUseBiometrics())) return preferences.fallback === 'device-pin';
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Finapp',
    disableDeviceFallback: preferences.fallback !== 'device-pin',
  });
  return result.success;
}
