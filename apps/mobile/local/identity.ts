import * as SecureStore from 'expo-secure-store';

const VALIDATED_USER_KEY = 'finapp.local.validated-user.v1';

export async function readValidatedLocalUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(VALIDATED_USER_KEY);
}

export async function saveValidatedLocalUserId(userId: string): Promise<void> {
  if (!userId) throw new Error('VALIDATED_USER_ID_REQUIRED');
  await SecureStore.setItemAsync(VALIDATED_USER_KEY, userId, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearValidatedLocalUserId(): Promise<void> {
  await SecureStore.deleteItemAsync(VALIDATED_USER_KEY);
}
