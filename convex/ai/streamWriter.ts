/**
 * Coalescing live-text writer for streamed replies.
 *
 * The model's SSE stream must never wait on the database: `push` only records the latest text and
 * returns immediately. At most one write is in flight; the newest text is written as soon as the
 * previous write finishes and `intervalMs` has passed, and a trailing timer makes sure the tail is
 * written even when no further delta arrives. `drain` waits for everything to land (call it before
 * the final `complete` write so the two can't race).
 */
export type StreamWriter = {
  push(text: string): void;
  drain(): Promise<void>;
};

export function createStreamWriter(
  write: (text: string) => Promise<unknown>,
  intervalMs: number,
  now: () => number = Date.now,
): StreamWriter {
  let latest = '';
  let written = '';
  let lastWriteAt = 0;
  let inFlight: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failed = false;

  const pump = () => {
    if (inFlight || failed || latest === written) return;
    const wait = lastWriteAt + intervalMs - now();
    if (wait > 0) {
      timer ??= setTimeout(() => {
        timer = null;
        pump();
      }, wait);
      return;
    }
    const text = latest;
    lastWriteAt = now();
    inFlight = write(text)
      .then(
        () => {
          written = text;
        },
        (error) => {
          // A failed live write is cosmetic (the final write carries the full text); stop trying.
          failed = true;
          console.warn('[ai] live text write failed', String(error));
        },
      )
      .finally(() => {
        inFlight = null;
        pump();
      });
  };

  return {
    push(text) {
      latest = text;
      pump();
    },
    async drain() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      while (inFlight) await inFlight;
    },
  };
}
