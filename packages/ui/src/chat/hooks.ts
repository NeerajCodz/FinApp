import React from 'react';
import type { ChatMessage } from './model';

/** Typing refreshes go out at most this often while the user keeps typing. */
export const TYPING_THROTTLE_MS = 2_500;
/** Typing is withdrawn after this long without a keystroke. */
export const TYPING_IDLE_MS = 4_000;
/** Remote typing indicators disappear this long after their last refresh arrives. */
export const TYPING_DISPLAY_MS = 5_500;

/**
 * Throttled typing publisher: `onDraftChange` sends `true` at most once per throttle window and
 * `false` after an idle pause, on `stop()` (send, blur, backgrounding) and on unmount.
 */
export function useTypingSender(
  send: ((typing: boolean) => Promise<unknown>) | undefined,
  { throttleMs = TYPING_THROTTLE_MS, idleMs = TYPING_IDLE_MS } = {},
) {
  const sendRef = React.useRef(send);
  sendRef.current = send;
  const active = React.useRef(false);
  const lastSent = React.useRef(0);
  const idle = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stop = React.useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = undefined;
    if (!active.current) return;
    active.current = false;
    lastSent.current = 0;
    void sendRef.current?.(false).catch(() => undefined);
  }, []);
  const onDraftChange = React.useCallback(
    (value: string) => {
      if (!value.trim()) {
        stop();
        return;
      }
      const now = Date.now();
      if (!active.current || now - lastSent.current >= throttleMs) {
        active.current = true;
        lastSent.current = now;
        void sendRef.current?.(true).catch(() => {
          active.current = false;
        });
      }
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(stop, idleMs);
    },
    [idleMs, stop, throttleMs],
  );
  React.useEffect(() => stop, [stop]);
  return { onDraftChange, stop };
}

export type TypingEntry = { userId: string; updatedAt: number };

/**
 * Remote typists, expired on this device's clock: an entry shows for TYPING_DISPLAY_MS after
 * its latest refresh arrives, so cached query results and clock skew cannot pin it on.
 */
export function useLiveTypists(entries: readonly TypingEntry[] | undefined): string[] {
  const seen = React.useRef(new Map<string, { updatedAt: number; receivedAt: number }>());
  const [now, setNow] = React.useState(() => Date.now());
  const current = entries ?? [];
  const signature = current.map((entry) => `${entry.userId}:${entry.updatedAt}`).join('|');
  const live = React.useMemo(() => {
    const map = seen.current;
    const received = Date.now();
    const ids = new Set(current.map((entry) => entry.userId));
    for (const key of [...map.keys()]) if (!ids.has(key)) map.delete(key);
    for (const entry of current) {
      const known = map.get(entry.userId);
      if (!known || known.updatedAt !== entry.updatedAt)
        map.set(entry.userId, { updatedAt: entry.updatedAt, receivedAt: received });
    }
    return [...map]
      .filter(([, value]) => now - value.receivedAt < TYPING_DISPLAY_MS)
      .map(([userId]) => userId);
    // `signature` captures every change to `current`.
  }, [signature, now]);
  React.useEffect(() => {
    if (!seen.current.size) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [signature]);
  return live;
}

type PendingSend = {
  message: ChatMessage;
  run: () => Promise<unknown>;
};

/**
 * Optimistic sends: a message appears at once as `pending`, disappears when the server copy
 * arrives (Convex resolves a mutation after its query results include the write), and turns
 * `failed` with retry/discard if the mutation throws.
 */
/** Releases a local preview (`blob:` URL) once its pending message is gone. */
function releasePreview(message: ChatMessage | undefined) {
  for (const url of [message?.imageUrl, message?.audioUrl]) {
    if (
      typeof url === 'string' &&
      url.startsWith('blob:') &&
      typeof URL.revokeObjectURL === 'function'
    )
      URL.revokeObjectURL(url);
  }
}

export function useOptimisticMessages(onError?: (error: unknown) => void) {
  const [pending, setPending] = React.useState<PendingSend[]>([]);
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;
  const pendingRef = React.useRef(pending);
  pendingRef.current = pending;
  const remove = React.useCallback((id: string) => {
    releasePreview(pendingRef.current.find((item) => item.message.id === id)?.message);
    setPending((items) => items.filter((item) => item.message.id !== id));
  }, []);
  // Previews still pending when the thread closes are released too.
  React.useEffect(
    () => () => {
      for (const item of pendingRef.current) releasePreview(item.message);
    },
    [],
  );
  /** Runs the job; resolves true when it succeeded (the pending message is then removed). */
  const execute = React.useCallback(
    async (id: string, run: () => Promise<unknown>) => {
      try {
        await run();
        remove(id);
        return true;
      } catch (error) {
        setPending((items) =>
          items.map((item) =>
            item.message.id === id
              ? { ...item, message: { ...item.message, status: 'failed' as const } }
              : item,
          ),
        );
        onErrorRef.current?.(error);
        return false;
      }
    },
    [remove],
  );
  /**
   * Shows the message at once and runs `run`. Resolves when it settles (true on success), so
   * callers can keep an upload control busy until the upload actually finished.
   */
  const send = React.useCallback(
    (
      draft: Omit<ChatMessage, 'id' | 'createdAt' | 'mine' | 'status'>,
      run: () => Promise<unknown>,
    ) => {
      const id = `pending:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const message: ChatMessage = {
        ...draft,
        id,
        createdAt: Date.now(),
        mine: true,
        status: 'pending',
      };
      setPending((items) => [...items, { message, run }]);
      return execute(id, run);
    },
    [execute],
  );
  const retry = React.useCallback(
    (id: string) => {
      const job = pendingRef.current.find((item) => item.message.id === id);
      if (!job) return;
      setPending((items) =>
        items.map((item) =>
          item.message.id === id
            ? { ...item, message: { ...item.message, status: 'pending' as const } }
            : item,
        ),
      );
      void execute(id, job.run);
    },
    [execute],
  );
  const discard = remove;
  const messages = React.useMemo(() => pending.map((item) => item.message), [pending]);
  return { messages, send, retry, discard, isPending: (id: string) => id.startsWith('pending:') };
}

/**
 * Debounced read pointer updates: reports the newest createdAt the viewer has seen, skipping
 * anything the server pointer already covers.
 */
export function useReadMarker(
  markRead: ((readAt: number) => Promise<unknown>) | undefined,
  serverLastReadAt: number | undefined,
) {
  const markRef = React.useRef(markRead);
  markRef.current = markRead;
  const requested = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = React.useRef(0);
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return React.useCallback(
    (createdAt: number) => {
      if (createdAt <= Math.max(requested.current, serverLastReadAt ?? 0)) return;
      latest.current = Math.max(latest.current, createdAt);
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = undefined;
        const readAt = latest.current;
        if (readAt <= requested.current) return;
        requested.current = readAt;
        void markRef.current?.(readAt).catch(() => {
          requested.current = 0;
        });
      }, 400);
    },
    [serverLastReadAt],
  );
}

/**
 * Before the unread divider is frozen, pages back until the oldest loaded message is at or
 * before the read pointer, so the divider sits on the thread's real first unread message even
 * when more than one page is unread. Returns true while it is still loading those pages.
 *
 * `createdAtOldestFirst` are the loaded server messages' timestamps, oldest first.
 */
export function useLoadUnreadHistory({
  active,
  createdAtOldestFirst,
  lastReadAt,
  unreadCount,
  status,
  loadMore,
  maxPages = 4,
}: {
  /** False once the divider is frozen. */
  active: boolean;
  createdAtOldestFirst: readonly number[];
  lastReadAt: number | undefined;
  unreadCount: number | undefined;
  status: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  loadMore: () => void;
  maxPages?: number;
}): boolean {
  const pages = React.useRef(0);
  const oldest = createdAtOldestFirst[0];
  const needsOlder =
    active &&
    lastReadAt !== undefined &&
    !!unreadCount &&
    oldest !== undefined &&
    oldest > lastReadAt &&
    pages.current < maxPages &&
    (status === 'CanLoadMore' || status === 'LoadingMore');
  const loadMoreRef = React.useRef(loadMore);
  loadMoreRef.current = loadMore;
  React.useEffect(() => {
    if (!needsOlder || status !== 'CanLoadMore') return;
    pages.current += 1;
    loadMoreRef.current();
  }, [needsOlder, status, oldest]);
  return needsOlder;
}
