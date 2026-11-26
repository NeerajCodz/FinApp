import React from 'react';
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_UNDO_MS,
  filterNotifications,
  notificationFilterCounts,
  notificationSections,
  unreadCount,
  visibleNotificationFilters,
  type NotificationFilterKey,
  type NotificationListItem,
} from './notifications';

/**
 * Inbox state shared by the web and native notification screens: the active filter, how many
 * rows are rendered (grows as the list scrolls), and deletes that wait a few seconds so they can
 * be undone. Pending deletes are sent when the screen unmounts.
 */
export function useNotificationInbox({
  items,
  onDelete,
  now: fixedNow,
}: {
  items: readonly NotificationListItem[] | undefined;
  onDelete: (item: NotificationListItem) => void;
  now?: number;
}) {
  const [filter, setFilterState] = React.useState<NotificationFilterKey>('all');
  const [limit, setLimit] = React.useState(NOTIFICATION_PAGE_SIZE);
  const [pending, setPending] = React.useState<readonly NotificationListItem[]>([]);
  const [clock, setClock] = React.useState(() => Date.now());
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingRef = React.useRef(new Map<string, NotificationListItem>());
  const onDeleteRef = React.useRef(onDelete);
  React.useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  // Relative times ("5m") and day groups stay current while the screen is open.
  React.useEffect(() => {
    if (fixedNow !== undefined) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [fixedNow]);
  const now = fixedNow ?? clock;

  React.useEffect(() => {
    const scheduled = timers.current;
    const waiting = pendingRef.current;
    return () => {
      for (const timer of scheduled.values()) clearTimeout(timer);
      for (const item of waiting.values()) onDeleteRef.current(item);
      scheduled.clear();
      waiting.clear();
    };
  }, []);

  const pendingIds = React.useMemo(() => new Set(pending.map((item) => item.id)), [pending]);
  const live = React.useMemo(
    () => items?.filter((item) => !pendingIds.has(item.id)),
    [items, pendingIds],
  );
  const counts = React.useMemo(() => notificationFilterCounts(live ?? []), [live]);
  const chips = React.useMemo(() => visibleNotificationFilters(counts, filter), [counts, filter]);
  const filtered = React.useMemo(
    () => (live ? filterNotifications(live, filter) : undefined),
    [live, filter],
  );
  const sections = React.useMemo(
    () => notificationSections(filtered?.slice(0, limit) ?? [], now),
    [filtered, limit, now],
  );

  const setFilter = React.useCallback((next: NotificationFilterKey) => {
    setFilterState(next);
    setLimit(NOTIFICATION_PAGE_SIZE);
  }, []);
  const loadMore = React.useCallback(() => setLimit((value) => value + NOTIFICATION_PAGE_SIZE), []);

  const remove = React.useCallback((item: NotificationListItem) => {
    if (pendingRef.current.has(item.id)) return;
    pendingRef.current.set(item.id, item);
    setPending((current) => [...current, item]);
    timers.current.set(
      item.id,
      setTimeout(() => {
        timers.current.delete(item.id);
        if (!pendingRef.current.delete(item.id)) return;
        setPending((current) => current.filter((candidate) => candidate.id !== item.id));
        onDeleteRef.current(item);
      }, NOTIFICATION_UNDO_MS),
    );
  }, []);

  /** Restores the most recently deleted row. */
  const undo = React.useCallback(() => {
    const last = [...pendingRef.current.values()].at(-1);
    if (!last) return;
    clearTimeout(timers.current.get(last.id));
    timers.current.delete(last.id);
    pendingRef.current.delete(last.id);
    setPending((current) => current.filter((candidate) => candidate.id !== last.id));
  }, []);

  return {
    filter,
    setFilter,
    chips,
    counts,
    sections,
    /** `undefined` while loading. */
    filtered,
    total: live?.length ?? 0,
    unread: live ? unreadCount(live) : 0,
    hasMore: (filtered?.length ?? 0) > limit,
    loadMore,
    remove,
    undo,
    /** The row an Undo would restore. */
    lastDeleted: pending.at(-1),
    now,
  };
}
