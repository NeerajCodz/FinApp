import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type AppLock = { method: 'device' } | { method: 'passcode'; salt: string; digest: string };

const keyFor = (userId: string) => `finapp.app-lock.v1.${userId}`;
const throttleKeyFor = (userId: string) => `finapp.app-lock-throttle.v1.${userId}`;
const storageOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function readAppLock(userId: string): Promise<AppLock | null> {
  if (Platform.OS === 'web') return null;
  const stored = await SecureStore.getItemAsync(keyFor(userId));
  if (stored === null) return null;
  const value: unknown = JSON.parse(stored);
  if (value && typeof value === 'object' && 'method' in value) {
    if (value.method === 'device') return { method: 'device' };
    if (
      value.method === 'passcode' &&
      'salt' in value &&
      typeof value.salt === 'string' &&
      'digest' in value &&
      typeof value.digest === 'string' &&
      /^[a-f0-9]{64}$/.test(value.digest)
    )
      return { method: 'passcode', salt: value.salt, digest: value.digest };
  }
  throw new Error('The saved app lock could not be read. Your data has not been changed.');
}

export async function saveAppLock(userId: string, lock: AppLock | null): Promise<void> {
  if (Platform.OS === 'web' || !(await SecureStore.isAvailableAsync()))
    throw new Error('Secure device storage is unavailable. App lock cannot be changed.');
  if (lock) await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(lock), storageOptions);
  else await SecureStore.deleteItemAsync(keyFor(userId));
}

export async function readPasscodeThrottle(
  userId: string,
): Promise<{ attempts: number; retryAt: number }> {
  const stored = await SecureStore.getItemAsync(throttleKeyFor(userId));
  if (!stored) return { attempts: 0, retryAt: 0 };
  const value: unknown = JSON.parse(stored);
  if (
    !value ||
    typeof value !== 'object' ||
    !('attempts' in value) ||
    !('retryAt' in value) ||
    typeof value.attempts !== 'number' ||
    typeof value.retryAt !== 'number' ||
    !Number.isInteger(value.attempts) ||
    value.attempts < 0 ||
    value.attempts > 4 ||
    !Number.isFinite(value.retryAt)
  )
    throw new Error('The app passcode attempt limit could not be read.');
  return { attempts: value.attempts, retryAt: value.retryAt };
}

export async function recordFailedPasscode(
  userId: string,
): Promise<{ attempts: number; retryAt: number }> {
  const previous = await readPasscodeThrottle(userId);
  if (previous.retryAt > Date.now()) return previous;
  const attempts = previous.attempts + 1;
  const next =
    attempts >= 5 ? { attempts: 0, retryAt: Date.now() + 30_000 } : { attempts, retryAt: 0 };
  await SecureStore.setItemAsync(throttleKeyFor(userId), JSON.stringify(next), storageOptions);
  return next;
}

export async function clearPasscodeThrottle(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(throttleKeyFor(userId));
}

export async function createPasscodeLock(code: string): Promise<AppLock> {
  if (!/^\d{6}$/.test(code)) throw new Error('Use a six-digit passcode.');
  const salt = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return { method: 'passcode', salt, digest: await passcodeDigest(salt, code) };
}

async function passcodeDigest(salt: string, code: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${code}`);
}

export async function verifyPasscode(lock: AppLock, code: string): Promise<boolean> {
  if (lock.method !== 'passcode' || !/^\d{6}$/.test(code)) return false;
  const digest = await passcodeDigest(lock.salt, code);
  let mismatch = 0;
  for (let index = 0; index < lock.digest.length; index += 1)
    mismatch |= lock.digest.charCodeAt(index) ^ digest.charCodeAt(index);
  return mismatch === 0;
}

export async function canUseDeviceLock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (
    (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  );
}

export async function authenticateDevice(): Promise<boolean> {
  if (!(await canUseDeviceLock()))
    throw new Error('Set up biometrics in device settings to use device unlock.');
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Finapp',
    cancelLabel: 'Cancel',
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false,
  });
  if (result.success) return true;
  if (
    result.error === 'user_cancel' ||
    result.error === 'system_cancel' ||
    result.error === 'app_cancel'
  )
    return false;
  throw new Error(result.warning ?? `Device authentication failed (${result.error}).`);
}
