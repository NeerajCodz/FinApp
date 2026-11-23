import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    executionEnvironment: 'storeClient',
    expoConfig: { extra: { eas: { projectId: 'project-id' } } },
  },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => {
  throw new Error('Expo Go must not initialize expo-notifications');
});
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock('../../apps/mobile/local/commands', () => ({ getDeviceId: vi.fn() }));

describe('push registration', () => {
  it('is a no-op in Expo Go', async () => {
    const { easProjectId, promptForPushOnce, pushSupported, registerForPush, unregisterPush } =
      await import('../../apps/mobile/lib/push');
    const convex = { mutation: vi.fn() };
    expect(pushSupported()).toBe(false);
    expect(easProjectId()).toBe('project-id');
    await expect(registerForPush(convex as never, { prompt: true })).resolves.toBe('unsupported');
    await promptForPushOnce(convex as never);
    await unregisterPush(convex as never);
    expect(convex.mutation).not.toHaveBeenCalled();
  });

  it('follows only in-app notification urls', async () => {
    const { appPathForNotificationUrl } = await import('../../apps/mobile/lib/push');
    expect(appPathForNotificationUrl('/group/g1/balances')).toBe('/group/g1/balances');
    expect(appPathForNotificationUrl('/recurring')).toBe('/recurring');
    expect(appPathForNotificationUrl('/groups?invitations=1')).toBe('/(tabs)/people?invitations=1');
    expect(appPathForNotificationUrl('https://example.com')).toBeNull();
    expect(appPathForNotificationUrl('//example.com')).toBeNull();
    expect(appPathForNotificationUrl(undefined)).toBeNull();
  });
});
