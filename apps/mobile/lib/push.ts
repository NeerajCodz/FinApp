import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import type { ConvexReactClient } from 'convex/react';
import { api } from '@convex/_generated/api';
import { isSafeNotificationUrl } from '@convex/notifications/domain';
import { isExpoGo } from '@/local/runtime';
import { getDeviceId } from '@/local/commands';

const TOKEN_KEY = 'finapp.push.token.v1';
const PROMPTED_KEY = 'finapp.push.prompted.v1';
/** Matches ANDROID_PUSH_CHANNEL in convex/notifications/push.ts. */
export const PUSH_CHANNEL_ID = 'default';

/** Remote push needs a development or store build: never in Expo Go, never on web. */
export function pushSupported(): boolean {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGo();
}

async function loadNotifications() {
  return pushSupported() ? import('expo-notifications') : null;
}

export function easProjectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)
    ?.eas?.projectId;
  const projectId = typeof fromConfig === 'string' ? fromConfig : Constants.easConfig?.projectId;
  return projectId || undefined;
}

export type PushRegistrationResult = 'registered' | 'denied' | 'unsupported' | 'unavailable';

/**
 * Registers this device for remote pushes. Without `prompt`, it only registers when permission
 * was already granted; with it, the system prompt is shown if the OS still allows asking.
 */
export async function registerForPush(
  convex: ConvexReactClient,
  { prompt = false }: { prompt?: boolean } = {},
): Promise<PushRegistrationResult> {
  const Notifications = await loadNotifications();
  if (!Notifications) return 'unsupported';
  const projectId = easProjectId();
  if (!projectId) return 'unavailable';
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Updates',
      importance: Notifications.AndroidImportance.HIGH,
    });
  let permission = await Notifications.getPermissionsAsync();
  const granted = (value: typeof permission) =>
    value.granted || value.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted(permission) && prompt && permission.canAskAgain) {
    await SecureStore.setItemAsync(PROMPTED_KEY, '1');
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!granted(permission)) return 'denied';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await convex.mutation(api.notifications.push.registerDevice, {
    token,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    deviceId: await getDeviceId(),
  });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  return 'registered';
}

/** Asks for push permission once, at a moment the user shows interest in updates. */
export async function promptForPushOnce(convex: ConvexReactClient): Promise<void> {
  if (!pushSupported()) return;
  if (await SecureStore.getItemAsync(PROMPTED_KEY)) return;
  await registerForPush(convex, { prompt: true });
}

/**
 * Stops pushes for the signed-in account on this device; call before signing out. The token is
 * forgotten only after the server removed the device, so a failed attempt can be retried
 * (one retry here, then the next call) instead of leaving the device registered forever.
 */
export async function unregisterPush(convex: ConvexReactClient): Promise<void> {
  if (!pushSupported()) return;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return;
  try {
    await convex.mutation(api.notifications.push.unregisterDevice, { token });
  } catch {
    await convex.mutation(api.notifications.push.unregisterDevice, { token });
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** In-app path for a notification route; null when it must not be followed. */
export function appPathForNotificationUrl(url: unknown): string | null {
  if (!isSafeNotificationUrl(url)) return null;
  if (url === '/notifications') return '/notifications';
  if (url.startsWith('/groups?invitations=1')) return '/(tabs)/people?invitations=1';
  return url;
}
