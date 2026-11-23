'use client';

import React from 'react';
import {
  ArrowDown,
  Image as ImageIcon,
  PaperPlaneTilt,
  PushPin,
  PushPinSlash,
  X,
} from '@phosphor-icons/react';
import { Avatar } from '../../web/fields';
import { AvatarStack, ListSkeleton } from '../../web/visual';
import { Illustration } from '../../illustrations/web';
import {
  buildChatRows,
  CHAT_NEAR_BOTTOM_PX,
  CHAT_REACTIONS,
  CHAT_TEXT_LIMIT,
  messageAccessibleLabel,
  pinPreview,
  receiptLabel,
  timeLabel,
  typingLabel,
  type ChatMessage,
  type ChatPin,
  type ChatReactionEmoji,
  type ChatRow,
} from '../model';
import styles from './ChatThread.module.css';

export type ChatComposerProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onBlur?: () => void;
  onAttachFile?: (file: File) => void;
  attachLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  uploading?: boolean;
};

export type ChatThreadProps = {
  mode: 'direct' | 'group';
  /** Oldest first, including optimistic messages. */
  messages: readonly ChatMessage[];
  loading: boolean;
  canLoadOlder?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string;
  typingNames?: readonly string[];
  pinned?: readonly (ChatPin & { canUnpin?: boolean })[];
  onTogglePin?: (id: string, pinned: boolean) => void;
  onReact?: (id: string, emoji: ChatReactionEmoji) => void;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
  /** Called with the newest incoming message time while the viewer is at the bottom. */
  onSeenLatest?: (createdAt: number) => void;
  renderEvent?: (message: ChatMessage) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  composer?: ChatComposerProps;
  footer?: React.ReactNode;
  error?: string;
  className?: string;
  style?: React.CSSProperties;
};

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

export function ChatThread(p: ChatThreadProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const topSentinel = React.useRef<HTMLDivElement>(null);
  const rows = React.useMemo(
    () => buildChatRows(p.messages, { firstUnreadId: p.firstUnreadId }),
    [p.messages, p.firstUnreadId],
  );
  const nearBottom = React.useRef(true);
  const [newCount, setNewCount] = React.useState(0);
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [jumpTarget, setJumpTarget] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState('');
  const [pinIndex, setPinIndex] = React.useState(0);
  const first = p.messages[0];
  const newest = p.messages[p.messages.length - 1];
  const newestIncoming = React.useMemo(
    () =>
      [...p.messages].reverse().find((message) => !message.mine && message.status !== 'pending'),
    [p.messages],
  );
  const onSeenLatest = p.onSeenLatest;
  const reportSeen = React.useCallback(() => {
    if (newestIncoming && document.visibilityState === 'visible')
      onSeenLatest?.(newestIncoming.createdAt);
  }, [newestIncoming, onSeenLatest]);

  const scrollToBottom = React.useCallback(
    (smooth = false) => {
      const element = scroller.current;
      if (!element) return;
      element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      nearBottom.current = true;
      setNewCount(0);
      reportSeen();
    },
    [reportSeen],
  );

  // Keep position when older pages are prepended; stick to the bottom for own sends and for
  // incoming messages while already at the bottom, otherwise count them on the chip.
  const snapshot = React.useRef<{
    firstId?: string;
    newest?: ChatMessage;
    height: number;
    top: number;
  }>({ height: 0, top: 0 });
  const opened = React.useRef(false);
  React.useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const previous = snapshot.current;
    if (!opened.current && !p.loading && p.messages.length) {
      opened.current = true;
      const marker = element.querySelector<HTMLElement>('[data-unread-marker]');
      if (marker && marker.offsetTop > element.clientHeight / 2) {
        element.scrollTop = Math.max(0, marker.offsetTop - element.clientHeight / 3);
        nearBottom.current = false;
      } else {
        element.scrollTop = element.scrollHeight;
        reportSeen();
      }
    } else if (opened.current) {
      const prepended =
        previous.firstId !== undefined &&
        first?.id !== previous.firstId &&
        newest?.id === previous.newest?.id;
      if (prepended) element.scrollTop = previous.top + (element.scrollHeight - previous.height);
      else if (newest && previous.newest && newest.id !== previous.newest.id) {
        if (newest.createdAt >= previous.newest.createdAt) {
          if (newest.mine || nearBottom.current) scrollToBottom(true);
          else {
            const fresh = p.messages.filter(
              (message) => !message.mine && message.createdAt > previous.newest!.createdAt,
            ).length;
            setNewCount((count) => count + Math.max(1, fresh));
          }
        }
      }
    }
    snapshot.current = {
      firstId: first?.id,
      newest,
      height: element.scrollHeight,
      top: element.scrollTop,
    };
  }, [first?.id, newest, p.loading, p.messages, reportSeen, scrollToBottom]);

  const typingVisible = !!p.typingNames?.length;
  React.useLayoutEffect(() => {
    if (typingVisible && nearBottom.current) {
      const element = scroller.current;
      if (element) element.scrollTop = element.scrollHeight;
    }
  }, [typingVisible]);

  // Load older history when the top sentinel scrolls into view.
  const loadOlder = React.useRef(p.onLoadOlder);
  loadOlder.current = p.onLoadOlder;
  const canLoad = !!p.canLoadOlder && !p.loadingOlder;
  React.useEffect(() => {
    const sentinel = topSentinel.current;
    if (!sentinel || !canLoad || !opened.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadOlder.current?.();
      },
      { root: scroller.current, rootMargin: '240px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoad, rows.length]);

  // Jump to a pinned message, paging in older history until it is present.
  React.useEffect(() => {
    if (!jumpTarget) return;
    const element = scroller.current?.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(jumpTarget)}"]`,
    );
    if (element) {
      setJumpTarget(null);
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlightId(jumpTarget);
      return;
    }
    if (p.canLoadOlder) {
      if (!p.loadingOlder) p.onLoadOlder?.();
      return;
    }
    setJumpTarget(null);
    setNotice('That pinned message is no longer in the chat history.');
  }, [jumpTarget, p, rows]);
  React.useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 1_800);
    return () => window.clearTimeout(timer);
  }, [highlightId]);
  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3_500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const composerBlur = p.composer?.onBlur;
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') composerBlur?.();
      else if (nearBottom.current) reportSeen();
    };
    const onHide = () => composerBlur?.();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    };
  }, [composerBlur, reportSeen]);
  React.useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setPreview(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  function onScroll() {
    const element = scroller.current;
    if (!element) return;
    const atBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < CHAT_NEAR_BOTTOM_PX;
    if (atBottom && !nearBottom.current) {
      setNewCount(0);
      reportSeen();
    }
    nearBottom.current = atBottom;
  }

  const pins = p.pinned ?? [];
  const pinPosition = Math.min(pinIndex, Math.max(0, pins.length - 1));
  const activePin = pins[pinPosition];
  const empty = !p.loading && !p.messages.length;

  return (
    <div className={cx(styles.thread, p.className)} style={p.style}>
      {activePin && (
        <div className={styles.pinBar}>
          <PushPin size={18} weight="fill" aria-hidden />
          <button
            type="button"
            className={styles.pinButton}
            aria-label={`Pinned message from ${activePin.senderName}: ${activePin.text}. Jump to message`}
            onClick={() => {
              setJumpTarget(activePin.id);
              if (pins.length > 1) setPinIndex((index) => (index + 1) % pins.length);
            }}
          >
            <small>
              Pinned{pins.length > 1 ? ` · ${pinPosition + 1}/${pins.length}` : ''} ·{' '}
              {activePin.senderName}
            </small>
            <span>{pinPreview(activePin.text)}</span>
          </button>
          {activePin.canUnpin && p.onTogglePin && (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Unpin message"
              onClick={() => p.onTogglePin?.(activePin.id, false)}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}
      {p.loading && !p.messages.length ? (
        <ListSkeleton rows={5} />
      ) : empty ? (
        <div className={styles.empty}>
          <Illustration scene="message" size={170} />
          <h3>{p.emptyTitle ?? 'Start the conversation'}</h3>
          <p>{p.emptyDescription ?? 'Say hello — messages appear here instantly.'}</p>
        </div>
      ) : (
        <div
          ref={scroller}
          className={styles.scroller}
          role="log"
          aria-label={p.mode === 'group' ? 'Group messages' : 'Messages'}
          aria-live="polite"
          onScroll={onScroll}
        >
          <div ref={topSentinel} aria-hidden style={{ height: 1 }} />
          {p.loadingOlder && (
            <p className={styles.status} role="status">
              Loading earlier messages…
            </p>
          )}
          {!p.canLoadOlder && p.messages.length > 20 && (
            <p className={styles.status}>Beginning of the conversation</p>
          )}
          {rows.map((row) => (
            <Row
              key={row.key}
              row={row}
              mode={p.mode}
              highlighted={row.type === 'message' && row.message.id === highlightId}
              renderEvent={p.renderEvent}
              onOpenImage={setPreview}
              onReact={p.onReact}
              onTogglePin={p.onTogglePin}
              onRetry={p.onRetry}
              onDiscard={p.onDiscard}
            />
          ))}
          {typingVisible && (
            <div className={styles.typing} role="status" aria-label={typingLabel(p.typingNames!)}>
              <span className={styles.dots} aria-hidden>
                <span />
                <span />
                <span />
              </span>
              {typingLabel(p.typingNames!)}…
            </div>
          )}
        </div>
      )}
      {newCount > 0 && (
        <button type="button" className={styles.chip} onClick={() => scrollToBottom(true)}>
          {newCount} new {newCount === 1 ? 'message' : 'messages'} <ArrowDown size={16} />
        </button>
      )}
      {notice && (
        <p className={styles.status} role="status">
          {notice}
        </p>
      )}
      {p.error && (
        <p className={styles.error} role="alert">
          {p.error}
        </p>
      )}
      {p.composer ? <Composer {...p.composer} /> : p.footer}
      {preview && (
        <button
          type="button"
          className={styles.lightbox}
          aria-label="Close image preview"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="Image attachment" />
        </button>
      )}
    </div>
  );
}

function Row({
  row,
  mode,
  highlighted,
  renderEvent,
  onOpenImage,
  onReact,
  onTogglePin,
  onRetry,
  onDiscard,
}: {
  row: ChatRow;
  mode: 'direct' | 'group';
  highlighted: boolean;
  renderEvent?: (message: ChatMessage) => React.ReactNode;
  onOpenImage: (url: string) => void;
  onReact?: (id: string, emoji: ChatReactionEmoji) => void;
  onTogglePin?: (id: string, pinned: boolean) => void;
  onRetry?: (id: string) => void;
  onDiscard?: (id: string) => void;
}) {
  if (row.type === 'day')
    return (
      <div className={styles.day} role="separator" aria-label={row.label}>
        {row.label}
      </div>
    );
  if (row.type === 'unread')
    return (
      <div
        className={styles.unread}
        data-unread-marker
        role="separator"
        aria-label="Unread messages"
      >
        Unread
      </div>
    );
  const { message, firstInGroup, lastInGroup } = row;
  const label = messageAccessibleLabel(message, mode);
  if (message.kind === 'event')
    return (
      <div className={cx(styles.row, styles.event)} data-message-id={message.id} aria-label={label}>
        {renderEvent?.(message) ?? message.event?.title}
      </div>
    );
  if (message.kind === 'system')
    return (
      <div className={styles.system} data-message-id={message.id}>
        {message.text}
      </div>
    );
  const settled = message.status !== 'pending' && message.status !== 'failed';
  return (
    <article
      data-message-id={message.id}
      aria-label={label}
      className={cx(
        styles.row,
        styles.message,
        message.mine && styles.mine,
        message.kind === 'ai' && styles.ai,
        firstInGroup && styles.first,
        lastInGroup && styles.last,
        highlighted && styles.highlight,
      )}
    >
      {mode === 'group' && !message.mine && (
        <div className={styles.avatarSlot}>
          {lastInGroup && (
            <Avatar
              label={message.senderName ?? 'Member'}
              initials={(message.senderName ?? '?').slice(0, 2).toUpperCase()}
              imageUrl={message.senderAvatarUrl}
              avatarId={message.senderAvatarId}
              size={30}
            />
          )}
        </div>
      )}
      <div className={styles.column}>
        {firstInGroup && !message.mine && (mode === 'group' || message.kind === 'ai') && (
          <span className={styles.sender}>
            {message.senderName ?? 'Member'}
            {message.kind === 'ai' ? ' · Assistant' : ''}
          </span>
        )}
        <div className={styles.bubbleWrap}>
          <div
            className={cx(
              styles.bubble,
              message.kind === 'image' && styles.image,
              message.status === 'pending' && styles.pending,
              message.status === 'failed' && styles.failed,
            )}
          >
            {message.pinned && (
              <span className={styles.pinnedTag}>
                <PushPin size={11} weight="fill" aria-hidden /> Pinned
              </span>
            )}
            {message.kind === 'image' ? (
              message.imageUrl ? (
                <button
                  type="button"
                  className={styles.imageButton}
                  aria-label="Open image"
                  onClick={() => onOpenImage(message.imageUrl!)}
                >
                  <img src={message.imageUrl} alt="Image attachment" loading="lazy" />
                </button>
              ) : (
                <span>Image is no longer available.</span>
              )
            ) : (
              message.text
            )}
          </div>
          {settled && (onReact || (onTogglePin && message.canPin)) && (
            <div className={styles.actions} role="group" aria-label="Message actions">
              {onReact &&
                CHAT_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={`React with ${emoji}`}
                    aria-pressed={message.myReaction === emoji}
                    onClick={() => onReact(message.id, emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              {onTogglePin && message.canPin && (
                <button
                  type="button"
                  aria-label={message.pinned ? 'Unpin message' : 'Pin message'}
                  onClick={() => onTogglePin(message.id, !message.pinned)}
                >
                  {message.pinned ? <PushPinSlash size={13} /> : <PushPin size={13} />}
                </button>
              )}
            </div>
          )}
        </div>
        {!!message.reactions?.length && (
          <div className={styles.reactions}>
            {message.reactions.map(({ emoji, count }) => (
              <button
                key={emoji}
                type="button"
                aria-label={`${emoji} reaction, ${count} ${count === 1 ? 'person' : 'people'}`}
                aria-pressed={message.myReaction === emoji}
                disabled={!onReact}
                onClick={() => onReact?.(message.id, emoji as ChatReactionEmoji)}
              >
                {emoji} {count}
              </button>
            ))}
          </div>
        )}
        {message.status === 'failed' ? (
          <div className={styles.meta}>
            <span className={styles.failedText}>Not sent</span>
            {onRetry && (
              <button type="button" onClick={() => onRetry(message.id)}>
                Retry
              </button>
            )}
            {onDiscard && (
              <button type="button" onClick={() => onDiscard(message.id)}>
                Discard
              </button>
            )}
          </div>
        ) : (
          lastInGroup && (
            <div className={styles.meta}>
              <time dateTime={new Date(message.createdAt).toISOString()}>
                {timeLabel(message.createdAt)}
              </time>
              {message.mine && <span>· {receiptLabel(message, mode)}</span>}
              {message.mine && mode === 'group' && !!message.seenBy?.length && (
                <AvatarStack
                  size={16}
                  max={3}
                  people={message.seenBy.map((person) => ({
                    id: person.id,
                    name: person.name,
                    imageUrl: person.avatarUrl,
                    avatarId: person.avatarId,
                  }))}
                />
              )}
            </div>
          )
        )}
      </div>
    </article>
  );
}

function Composer(c: ChatComposerProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const canSend = !c.disabled && !!c.draft.trim();
  return (
    <form
      className={styles.composer}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) c.onSend();
      }}
    >
      {c.onAttachFile && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label={c.attachLabel ?? 'Attach image'}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) c.onAttachFile?.(file);
            }}
          />
          <button
            type="button"
            className={styles.iconButton}
            aria-label={c.attachLabel ?? 'Attach image'}
            disabled={c.disabled || c.uploading}
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon size={22} />
          </button>
        </>
      )}
      <textarea
        aria-label="Message"
        rows={1}
        value={c.draft}
        maxLength={CHAT_TEXT_LIMIT}
        placeholder={c.placeholder ?? 'Write a message…'}
        disabled={c.disabled}
        onChange={(event) => c.onDraftChange(event.currentTarget.value)}
        onBlur={c.onBlur}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (canSend) c.onSend();
          }
        }}
      />
      <button
        type="submit"
        className={cx(styles.iconButton, styles.primary)}
        aria-label="Send message"
        disabled={!canSend}
      >
        <PaperPlaneTilt size={20} weight="fill" />
      </button>
    </form>
  );
}
