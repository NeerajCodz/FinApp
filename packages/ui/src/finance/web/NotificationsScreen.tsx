'use client';

import React from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  CircleDot,
  HandCoins,
  MailOpen,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Target,
  Trash2,
  UserCheck,
  UserPlus,
  UsersRound,
  WalletCards,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { IconTile } from '@finapp/ui/web';
import { FinanceEmptyState } from './FinanceEmptyState';
import styles from './NotificationsScreen.module.css';
import {
  notificationAction,
  notificationEmptyCopy,
  notificationIconKind,
  notificationKindLabel,
  notificationTime,
  notificationTimestamp,
  notificationTone,
  type NotificationIconKind,
  type NotificationListItem,
} from '../notifications';
import { useNotificationInbox } from '../useNotificationInbox';

const icons: Record<NotificationIconKind, LucideIcon> = {
  split: ReceiptText,
  settlement: HandCoins,
  reminder: BellRing,
  group: UsersRound,
  invitation: MailOpen,
  friend: UserCheck,
  friendRequest: UserPlus,
  budget: WalletCards,
  goal: Target,
  recurring: CalendarClock,
  security: ShieldAlert,
  sync: RefreshCw,
  transaction: ArrowLeftRight,
  other: Bell,
};

/** Where a friend request stands: answerable, already handled, or not known yet. */
export type FriendRequestStatus = 'pending' | 'answered' | 'loading';

export type NotificationsScreenProps = {
  /** `undefined` while saved notifications load. */
  items: readonly NotificationListItem[] | undefined;
  error?: string | null;
  loadError?: string | null;
  onRetry?: () => void;
  offline?: boolean;
  /** Disables Mark all read while a bulk write runs. */
  busy?: boolean;
  onBack?: () => void;
  onOpenSettings: () => void;
  /** Mark read and navigate; called on row activation. */
  onOpen: (item: NotificationListItem) => void;
  /** Whether a row has a screen to open; rows without one only toggle read state. */
  canOpen?: (item: NotificationListItem) => boolean;
  onMarkRead: (item: NotificationListItem) => void;
  onMarkUnread: (item: NotificationListItem) => void;
  /** Sent after the undo window closes. */
  onDelete: (item: NotificationListItem) => void;
  onMarkAllRead: () => void;
  friendRequestStatus?: (item: NotificationListItem) => FriendRequestStatus;
  onRespondToFriendRequest?: (
    item: NotificationListItem,
    response: 'accept' | 'decline',
  ) => Promise<void>;
  /** Inline group-invitation answers (e.g. `InvitationNotificationActions`). */
  renderInvitationActions?: (item: NotificationListItem) => React.ReactNode;
  /** Fixed clock for tests and stories. */
  now?: number;
};

function FriendRequestActions({
  item,
  status,
  onRespond,
}: {
  item: NotificationListItem;
  status: FriendRequestStatus;
  onRespond?: (item: NotificationListItem, response: 'accept' | 'decline') => Promise<void>;
}) {
  const [busy, setBusy] = React.useState<'accept' | 'decline' | null>(null);
  const [result, setResult] = React.useState<'accepted' | 'declined' | null>(null);
  const [error, setError] = React.useState('');
  if (result)
    return (
      <p className={styles.inlineNote} role="status">
        {result === 'accepted' ? 'You’re now friends.' : 'Request declined.'}
      </p>
    );
  if (status === 'loading') return <span className={styles.inlineSkeleton} aria-hidden />;
  if (status === 'answered' || !onRespond)
    return <p className={styles.inlineNote}>This request has been answered.</p>;
  const respond = async (response: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(response);
    setError('');
    try {
      await onRespond(item, response);
      setResult(response === 'accept' ? 'accepted' : 'declined');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not answer this request.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className={styles.inlineActions} role="group" aria-label="Answer friend request">
      <button
        type="button"
        className={styles.primaryChip}
        disabled={busy !== null}
        onClick={() => void respond('accept')}
      >
        {busy === 'accept' ? 'Accepting…' : 'Accept'}
      </button>
      <button
        type="button"
        className={styles.ghostChip}
        disabled={busy !== null}
        onClick={() => void respond('decline')}
      >
        {busy === 'decline' ? 'Declining…' : 'Decline'}
      </button>
      {error ? (
        <span className={styles.inlineError} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function NotificationRow({
  item,
  now,
  openable,
  extra,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  item: NotificationListItem;
  now: number;
  openable: boolean;
  extra: React.ReactNode;
  onOpen: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const unread = item.readAt === undefined;
  const Icon = icons[notificationIconKind(item)];
  const kind = notificationKindLabel(item.type);
  const action = notificationAction(item);
  const time = notificationTime(item.createdAt, now);
  return (
    <li className={styles.row} data-unread={unread || undefined}>
      <button
        type="button"
        className={styles.rowMain}
        onClick={openable ? onOpen : onToggleRead}
        aria-label={`${unread ? 'Unread. ' : ''}${kind}: ${item.title}. ${item.body}. ${notificationTimestamp(item.createdAt)}`}
      >
        <span className={styles.tile}>
          <IconTile tone={notificationTone(item)} size={44}>
            <Icon size={19} aria-hidden="true" />
          </IconTile>
          {unread ? <span className={styles.dot} aria-hidden /> : null}
        </span>
        <span className={styles.copy}>
          <span className={styles.meta}>
            <span className={styles.kind}>{kind}</span>
            <span aria-hidden>·</span>
            <time
              dateTime={new Date(item.createdAt).toISOString()}
              title={notificationTimestamp(item.createdAt)}
            >
              {time}
            </time>
          </span>
          <span className={styles.title}>{item.title}</span>
          <span className={styles.body}>{item.body}</span>
          {action.kind === 'open' && openable ? (
            <span className={styles.openHint} aria-hidden>
              {action.label} <ArrowRight size={13} />
            </span>
          ) : null}
        </span>
      </button>
      {extra ? <div className={styles.extra}>{extra}</div> : null}
      <div className={styles.rowActions}>
        <button
          type="button"
          className={styles.rowAction}
          onClick={onToggleRead}
          aria-label={unread ? `Mark “${item.title}” as read` : `Mark “${item.title}” as unread`}
          title={unread ? 'Mark as read' : 'Mark as unread'}
        >
          {unread ? <CheckCheck size={16} aria-hidden /> : <CircleDot size={16} aria-hidden />}
        </button>
        <button
          type="button"
          className={styles.rowAction}
          data-danger
          onClick={onDelete}
          aria-label={`Delete “${item.title}”`}
          title="Delete"
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}

function InboxSkeleton() {
  return (
    <div className={styles.skeleton} role="status" aria-label="Loading notifications">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className={styles.skeletonRow}>
          <span className={styles.skeletonTile} />
          <span className={styles.skeletonLines}>
            <span style={{ width: '30%' }} />
            <span style={{ width: `${70 - index * 6}%` }} />
            <span style={{ width: `${88 - index * 4}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function NotificationsScreen({
  items,
  error,
  loadError,
  onRetry,
  offline,
  busy,
  onBack,
  onOpenSettings,
  onOpen,
  canOpen,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onMarkAllRead,
  friendRequestStatus,
  onRespondToFriendRequest,
  renderInvitationActions,
  now: fixedNow,
}: NotificationsScreenProps) {
  const inbox = useNotificationInbox({ items, onDelete, now: fixedNow });
  const sentinel = React.useRef<HTMLDivElement | null>(null);
  const { hasMore, loadMore } = inbox;

  React.useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: '480px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const extraFor = (item: NotificationListItem): React.ReactNode => {
    const action = notificationAction(item);
    if (action.kind === 'friendRequest')
      return (
        <FriendRequestActions
          item={item}
          status={friendRequestStatus?.(item) ?? 'answered'}
          onRespond={onRespondToFriendRequest}
        />
      );
    if (action.kind === 'invitation') return renderInvitationActions?.(item) ?? null;
    return null;
  };

  const empty = inbox.filtered && inbox.filtered.length === 0;
  const emptyCopy = notificationEmptyCopy(inbox.filter);
  const subtitle = !items
    ? 'Loading your updates…'
    : inbox.unread > 0
      ? `${inbox.unread} unread · ${inbox.total} total`
      : inbox.total > 0
        ? 'You’re all caught up'
        : 'Updates from your money and your people';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        {onBack ? (
          <button type="button" className={styles.iconButton} aria-label="Go back" onClick={onBack}>
            <ArrowLeft size={19} aria-hidden />
          </button>
        ) : null}
        <div className={styles.titles}>
          <h1>Notifications</h1>
          <p aria-live="polite">{subtitle}</p>
        </div>
        <div className={styles.headerActions}>
          {inbox.unread > 0 ? (
            <button
              type="button"
              className={styles.markAll}
              disabled={busy}
              onClick={onMarkAllRead}
            >
              <CheckCheck size={16} aria-hidden />
              <span>Mark all read</span>
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Notification settings"
            title="Notification settings"
            onClick={onOpenSettings}
          >
            <Settings2 size={18} aria-hidden />
          </button>
        </div>
      </header>

      {offline ? (
        <p className={styles.banner} role="status">
          <WifiOff size={15} aria-hidden /> Offline — showing saved notifications. Changes sync when
          you reconnect.
        </p>
      ) : null}
      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      {loadError ? (
        <div className={styles.alert} role="alert">
          <span>{loadError}</span>
          {onRetry ? (
            <button type="button" className={styles.ghostChip} onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <div className={styles.chips} role="tablist" aria-label="Filter notifications">
          {inbox.chips.map((chip) => {
            const count = chip.key === 'unread' ? inbox.unread : inbox.counts[chip.key];
            const active = inbox.filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active || undefined}
                className={styles.chip}
                onClick={() => inbox.setFilter(chip.key)}
              >
                {chip.label}
                {count > 0 ? <span className={styles.chipCount}>{count}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {!items && !loadError ? <InboxSkeleton /> : null}

      <div className={styles.sections}>
        {inbox.sections.map((section) => (
          <section
            key={section.key}
            className={styles.section}
            aria-labelledby={`nh-${section.key}`}
          >
            <h2 id={`nh-${section.key}`} className={styles.sectionHead}>
              <span>{section.label}</span>
              <span className={styles.sectionCount}>{section.items.length}</span>
            </h2>
            <ul className={styles.list}>
              {section.items.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
                  now={inbox.now}
                  openable={canOpen ? canOpen(item) : true}
                  extra={extraFor(item)}
                  onOpen={() => onOpen(item)}
                  onToggleRead={() =>
                    item.readAt === undefined ? onMarkRead(item) : onMarkUnread(item)
                  }
                  onDelete={() => inbox.remove(item)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {hasMore ? (
        <div ref={sentinel} className={styles.more}>
          <button type="button" className={styles.ghostChip} onClick={loadMore}>
            Show older notifications
          </button>
        </div>
      ) : null}

      {empty ? (
        <FinanceEmptyState
          kind="activity"
          scene={inbox.filter === 'unread' ? 'success' : 'notifications'}
          title={emptyCopy.title}
          description={emptyCopy.description}
          action={
            inbox.filter !== 'all' ? (
              <button
                type="button"
                className={styles.ghostChip}
                onClick={() => inbox.setFilter('all')}
              >
                Show all notifications
              </button>
            ) : (
              <button type="button" className={styles.ghostChip} onClick={onOpenSettings}>
                Choose what you hear about
              </button>
            )
          }
        />
      ) : null}

      {inbox.lastDeleted ? (
        <div className={styles.toast} role="status" aria-live="polite">
          <span>Notification deleted</span>
          <button type="button" onClick={inbox.undo}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
  );
}
