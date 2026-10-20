import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { appOwnership: 'expo', executionEnvironment: 'storeClient' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-notifications', () => {
  throw new Error('Expo Go must not initialize expo-notifications');
});
vi.mock('../../apps/mobile/local/commands', () => ({ commitLocalWrite: vi.fn() }));
vi.mock('../../apps/mobile/local/repository', () => ({
  markDeviceNotificationRead: vi.fn(),
  putLocalNotification: vi.fn(),
  readLocal: vi.fn(),
}));

describe('Expo Go notification capability', () => {
  it('does not initialize expo-notifications push registration in the store client', async () => {
    const { permissionStatus, requestNotificationPermission } =
      await import('../../apps/mobile/local/notification-events');

    await expect(permissionStatus()).resolves.toBe('denied');
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });
});
