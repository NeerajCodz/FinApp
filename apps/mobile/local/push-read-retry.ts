export async function retryPushRead(
  markRead: () => Promise<void>,
  isActive: () => boolean,
  wait: (delayMs: number) => Promise<void>,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3 && isActive(); attempt++) {
    try {
      await markRead();
      return true;
    } catch (error) {
      if (!isActive()) return false;
      if (attempt === 2) throw error;
      await wait(500 * 2 ** attempt);
    }
  }
  return false;
}
