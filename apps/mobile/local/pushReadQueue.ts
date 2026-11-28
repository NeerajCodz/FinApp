const RETRY_DELAYS_MS = [1_000, 2_000] as const;

/** Starts bounded read attempts and cancels delayed retries when the owner changes. */
export function retryPushReadQueue(
  ids: readonly string[],
  markRead: (id: string) => Promise<void>,
  onRead: (id: string) => void,
  onError: (error: unknown) => void,
): () => void {
  let active = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const attempt = (id: string, retry: number) => {
    void markRead(id).then(
      () => {
        if (active) onRead(id);
      },
      (error: unknown) => {
        if (!active) return;
        onError(error);
        const delay = RETRY_DELAYS_MS[retry];
        if (delay === undefined) return;
        const timer = setTimeout(() => {
          timers.delete(timer);
          attempt(id, retry + 1);
        }, delay);
        timers.add(timer);
      },
    );
  };

  for (const id of ids) attempt(id, 0);
  return () => {
    active = false;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
}
