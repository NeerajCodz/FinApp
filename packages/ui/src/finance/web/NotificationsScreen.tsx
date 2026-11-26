'use client';

import React from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  HandCoins,
  MailOpen,
  ReceiptText,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Target,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { Button, IconButton, ListSkeleton, Typography, IconTile } from '@finapp/ui/web';
import { FinanceEmptyState } from './FinanceEmptyState';
import styles from './NotificationsScreen.module.css';
import {
  notificationIconKind,
  notificationSections,
  notificationTime,
  notificationTone,
  unreadCount,
  type NotificationIconKind,
  type NotificationListItem,
} from '../notifications';

const icons: Record<NotificationIconKind, LucideIcon> = {
  split: ReceiptText,
  settlement: HandCoins,
  reminder: BellRing,
  group: UsersRound,
  invitation: MailOpen,
  budget: WalletCards,
  goal: Target,
  recurring: CalendarClock,
  security: ShieldAlert,
  sync: RefreshCw,
  transaction: ArrowLeftRight,
  other: Bell,
};

export type NotificationsScreenProps = {
  /** `undefined` while saved notifications load. */
  items: readonly NotificationListItem[] | undefined;
  /** Label per notification type, e.g. from `notificationTypeLabels`. */
  typeLabels: Readonly<Record<string, string>>;
  /** Types offered as filters; omit to hide the type filter. */
  filterTypes?: readonly string[];
  error?: string | null;
  loadError?: string | null;
  onRetry?: () => void;
  offline?: boolean;
  busy?: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  /** Mark read and navigate; the screen calls it on row activation. */
  onOpen: (item: NotificationListItem) => void;
  onMarkRead: (item: NotificationListItem) => void;
  onMarkAllRead: () => void;
  /** Extra content under a row, e.g. invitation actions. */
  renderItemFooter?: (item: NotificationListItem) => React.ReactNode;
};

export function NotificationsScreen({
  items,
  typeLabels,
  filterTypes,
  error,
  loadError,
  onRetry,
  offline,
  busy,
  onBack,
  onOpenSettings,
  onOpen,
  onMarkRead,
  onMarkAllRead,
  renderItemFooter,
}: NotificationsScreenProps) {
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<string | null>(null);
  const unread = items ? unreadCount(items) : 0;
  const visible = items?.filter(
    (item) =>
      (!unreadOnly || item.readAt === undefined) && (!typeFilter || item.type === typeFilter),
  );
  const sections = React.useMemo(() => notificationSections(visible ?? []), [visible]);
  const filtered = unreadOnly || !!typeFilter;
  const clearFilters = () => {
    setUnreadOnly(false);
    setTypeFilter(null);
  };

  return (
    <div className={`finance-page ${styles.screen}`}>
      <header className={styles.header}>
        <IconButton label="Go back" variant="ghost" onPress={onBack}>
          <ArrowLeft size={21} aria-hidden="true" />
        </IconButton>
        <div className={styles.heading}>
          <Typography variant="title">Notifications</Typography>
          <Typography variant="caption" aria-live="polite">
            {!items
              ? 'Your recent activity'
              : unread > 0
                ? `${unread} unread`
                : 'You’re all caught up'}
          </Typography>
        </div>
        {unread > 0 ? (
          <Button variant="ghost" size="sm" disabled={busy} onPress={onMarkAllRead}>
            <CheckCheck size={16} aria-hidden="true" /> Mark all read
          </Button>
        ) : null}
        <IconButton label="Notification settings" variant="ghost" onPress={onOpenSettings}>
          <Settings2 size={20} aria-hidden="true" />
        </IconButton>
      </header>

      {items && items.length > 0 ? (
        <div className={styles.filters} role="group" aria-label="Filter notifications">
          <Button
            variant={!filtered ? 'primary' : 'outline'}
            size="sm"
            aria-pressed={!filtered}
            onPress={clearFilters}
          >
            All
          </Button>
          <Button
            variant={unreadOnly ? 'primary' : 'outline'}
            size="sm"
            aria-pressed={unreadOnly}
            onPress={() => setUnreadOnly((value) => !value)}
          >
            {unread > 0 ? `Unread · ${unread}` : 'Unread'}
          </Button>
          {filterTypes?.map((type) => (
            <Button
              key={type}
              variant={typeFilter === type ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={typeFilter === type}
              onPress={() => setTypeFilter(typeFilter === type ? null : type)}
            >
              {typeLabels[type] ?? type}
            </Button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      {loadError ? (
        <div role="alert" className={styles.section}>
          <p className={styles.error}>{loadError}</p>
          {onRetry ? (
            <Button variant="outline" onPress={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      ) : null}

      {!items && !loadError ? <ListSkeleton rows={5} /> : null}

      {sections.map((section) => (
        <section key={section.key} aria-label={section.label} className={styles.section}>
          <div className={styles.sectionHeader}>
            <Typography variant="label">{section.label}</Typography>
            <Typography variant="caption">
              {section.items.length} {section.items.length === 1 ? 'update' : 'updates'}
            </Typography>
          </div>
          <ul className={styles.list}>
            {section.items.map((item, index) => {
              const isUnread = item.readAt === undefined;
              const Icon = icons[notificationIconKind(item)];
              const footer = renderItemFooter?.(item);
              return (
                <li
                  key={item.id}
                  className={styles.item}
                  data-unread={isUnread || undefined}
                  style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                >
                  <div className={styles.row}>
                    <button
                      type="button"
                      className={styles.open}
                      disabled={busy}
                      aria-label={`${isUnread ? 'Unread' : 'Read'}: ${item.title}. ${item.body}`}
                      onClick={() => onOpen(item)}
                    >
                      <IconTile tone={notificationTone(item.type)} size={42}>
                        <Icon size={19} aria-hidden="true" />
                      </IconTile>
                      <span className={styles.copy}>
                        <span className={styles.titleLine}>
                          <span className={styles.title}>{item.title}</span>
                          <time
                            className={styles.time}
                            dateTime={new Date(item.createdAt).toISOString()}
                          >
                            {notificationTime(item.createdAt)}
                          </time>
                          {isUnread ? <span className={styles.dot} aria-hidden="true" /> : null}
                        </span>
                        <span className={styles.body}>{item.body}</span>
                        <span className={styles.label}>{typeLabels[item.type] ?? 'Update'}</span>
                      </span>
                    </button>
                    {isUnread ? (
                      <button
                        type="button"
                        className={styles.markRead}
                        disabled={busy}
                        aria-label={`Mark “${item.title}” as read`}
                        title="Mark as read"
                        onClick={() => onMarkRead(item)}
                      >
                        <Check size={17} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {footer ? <div className={styles.footer}>{footer}</div> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {visible && visible.length === 0 ? (
        <FinanceEmptyState
          kind="activity"
          scene="notifications"
          title={filtered ? 'Nothing here' : 'No notifications yet'}
          description={
            filtered
              ? 'No updates match this filter. New ones will show up here.'
              : 'Shared expenses, settlements, reminders, and category limit alerts will appear here.'
          }
          action={
            filtered ? (
              <Button variant="outline" size="sm" onPress={clearFilters}>
                Show all
              </Button>
            ) : undefined
          }
        />
      ) : null}

      {offline ? <p className={styles.offline}>Offline · showing saved activity</p> : null}
    </div>
  );
}
