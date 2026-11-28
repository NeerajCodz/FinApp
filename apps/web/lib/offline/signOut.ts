export async function signOutAndClearLocalData(
  userId: string,
  stopSync: () => Promise<void>,
  clearLocalData: (userId: string) => Promise<void>,
  signOut: () => Promise<void>,
  resumeSync?: () => void,
): Promise<unknown | null> {
  let cleanupError: unknown | null = null;
  try {
    await stopSync();
    await clearLocalData(userId);
  } catch (cause) {
    cleanupError = cause;
  }
  try {
    await signOut();
  } catch (cause) {
    resumeSync?.();
    throw cause;
  }
  return cleanupError;
}
