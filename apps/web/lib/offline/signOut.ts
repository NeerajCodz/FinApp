export async function signOutAndClearLocalData(
  userId: string,
  stopSync: () => Promise<void>,
  clearLocalData: (userId: string) => Promise<void>,
  signOut: () => Promise<void>,
): Promise<unknown | null> {
  let cleanupError: unknown | null = null;
  try {
    await stopSync();
    await clearLocalData(userId);
  } catch (cause) {
    cleanupError = cause;
  }
  await signOut();
  return cleanupError;
}
