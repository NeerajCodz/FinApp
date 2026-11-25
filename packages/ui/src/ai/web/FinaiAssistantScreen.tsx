'use client';

/**
 * The FinAI chat on the web, as one focused column: a slim header (history, new chat, close),
 * the thread (user bubbles, streamed replies with Thinking Orb progress and A2UI cards) and a
 * pill composer. Past chats open in place from the history button instead of a side rail.
 *
 * `variant="panel"` is the floating launcher's popover; `variant="page"` fills a route.
 */
import React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ClockCounterClockwise,
  NotePencil,
  Trash,
  X,
} from '@phosphor-icons/react';
import { ThinkingOrb } from '../../web/ThinkingOrb';
import { FinaiLogo } from './FinaiLogo';
import { FinaiMarkdown } from './FinaiMarkdown';
import { FinaiSteps } from './FinaiSteps';
import {
  FINAI_NAME,
  FINAI_SUGGESTIONS,
  finaiErrorMessage,
  isFinaiBusy,
  orbStateFor,
  type FinaiAssistantMessage,
} from '../finai';
import type { FinaiDecision } from './FinaiCards';
import { FinaiSurface } from './FinaiSurface';
import styles from './FinaiAssistantScreen.module.css';

export type FinaiConversationSummary = {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
};

export type FinaiAssistantScreenProps = {
  available: boolean;
  /** Show the tool steps under replies (FinAI setting; default on). */
  showSteps?: boolean;
  conversations: readonly FinaiConversationSummary[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onDelete?: (id: string) => void;
  /** Oldest first. */
  messages: readonly FinaiAssistantMessage[];
  loading: boolean;
  canLoadOlder?: boolean;
  onLoadOlder?: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: (text?: string) => void;
  sending: boolean;
  error?: string | null;
  onDecide: (actionId: string, decision: FinaiDecision) => Promise<unknown>;
  variant?: 'page' | 'panel';
  /** Shown as a close button (panel). */
  onClose?: () => void;
};

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function relativeTime(timestamp: number, now = Date.now()) {
  const minutes = Math.round((now - timestamp) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function FinaiAssistantScreen(p: FinaiAssistantScreenProps) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const input = React.useRef<HTMLTextAreaElement>(null);
  const nearBottom = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);
  const [view, setView] = React.useState<'chat' | 'history'>('chat');
  /** Thread position kept while history is open (the thread unmounts meanwhile). */
  const savedScroll = React.useRef<number | null>(null);
  const openHistory = () => {
    savedScroll.current = scroller.current?.scrollTop ?? null;
    setView('history');
  };
  const busy = p.sending || p.messages.some((message) => isFinaiBusy(message));
  const last = p.messages[p.messages.length - 1];
  const scrollKey = `${p.messages.length}:${last?.text.length ?? 0}:${last?.status ?? ''}:${last?.a2ui ? 1 : 0}`;
  const activeTitle = p.conversations.find((row) => row.id === p.activeId)?.title;

  const scrollToBottom = React.useCallback((smooth: boolean) => {
    const node = scroller.current;
    if (node) node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Follow the reply as it streams, unless the reader scrolled up.
  React.useLayoutEffect(() => {
    if (nearBottom.current) scrollToBottom(false);
    else setShowJump(true);
  }, [scrollKey, scrollToBottom]);
  React.useEffect(() => {
    nearBottom.current = true;
    scrollToBottom(false);
  }, [p.activeId, scrollToBottom]);
  // Back from history: put the thread where it was, or at the bottom.
  React.useLayoutEffect(() => {
    if (view !== 'chat') return;
    const node = scroller.current;
    if (!node) return;
    if (savedScroll.current !== null) node.scrollTop = savedScroll.current;
    else {
      nearBottom.current = true;
      node.scrollTop = node.scrollHeight;
    }
    savedScroll.current = null;
  }, [view]);
  // Grow the composer with its text, up to a few lines.
  React.useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 140)}px`;
  }, [p.draft]);

  const canSend = p.available && !busy && !!p.draft.trim();
  const empty = !p.loading && p.messages.length === 0;
  const select = (id: string | null) => {
    // Another conversation opens at its latest message; the same one where it was left.
    if (id !== p.activeId) savedScroll.current = null;
    p.onSelect(id);
    setView('chat');
    requestAnimationFrame(() => input.current?.focus());
  };

  return (
    <section
      className={cx(styles.shell, p.variant === 'panel' ? styles.panel : styles.page)}
      aria-label={`Chat with ${FINAI_NAME}`}
    >
      <header className={styles.header}>
        {view === 'history' ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Back to chat"
            onClick={() => setView('chat')}
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <span className={styles.orbBadge} aria-hidden>
            {/* The orb only appears while FinAI is thinking; otherwise its logo. */}
            {busy ? <ThinkingOrb state="working" size={20} /> : <FinaiLogo size={22} />}
          </span>
        )}
        <div className={styles.titleBlock}>
          <h1>{view === 'history' ? 'Chats' : (activeTitle ?? FINAI_NAME)}</h1>
          <p>
            {view === 'history'
              ? `${p.conversations.length} saved`
              : busy
                ? 'Working on it…'
                : 'Asks before changing anything'}
          </p>
        </div>
        {view === 'chat' && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Chat history"
            title="Chat history"
            onClick={openHistory}
          >
            <ClockCounterClockwise size={18} />
          </button>
        )}
        <button
          type="button"
          className={styles.iconButton}
          aria-label="New chat"
          title="New chat"
          onClick={() => select(null)}
        >
          <NotePencil size={18} />
        </button>
        {p.onClose && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Close ${FINAI_NAME}`}
            onClick={p.onClose}
          >
            <X size={18} />
          </button>
        )}
      </header>

      {view === 'history' ? (
        <div className={styles.history}>
          {p.conversations.length === 0 ? (
            <p className={styles.historyEmpty}>Your chats with {FINAI_NAME} appear here.</p>
          ) : (
            <ul>
              {p.conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className={cx(
                      styles.conversation,
                      conversation.id === p.activeId && styles.active,
                    )}
                    aria-current={conversation.id === p.activeId ? 'true' : undefined}
                    onClick={() => select(conversation.id)}
                  >
                    <span className={styles.conversationText}>
                      <strong>{conversation.title}</strong>
                      <small>{conversation.preview}</small>
                    </span>
                    <time>{relativeTime(conversation.updatedAt)}</time>
                  </button>
                  {p.onDelete && (
                    <button
                      type="button"
                      className={styles.delete}
                      aria-label={`Delete “${conversation.title}”`}
                      onClick={() => p.onDelete?.(conversation.id)}
                    >
                      <Trash size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div
            ref={scroller}
            className={styles.thread}
            role="log"
            aria-live="polite"
            aria-busy={busy}
            onScroll={(event) => {
              const node = event.currentTarget;
              nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
              if (nearBottom.current) setShowJump(false);
              if (node.scrollTop < 80 && p.canLoadOlder) p.onLoadOlder?.();
            }}
          >
            {p.loading && p.messages.length === 0 ? (
              <div className={styles.center}>
                <ThinkingOrb state="searching" size={28} caption="Loading your chat…" />
              </div>
            ) : empty ? (
              <div className={styles.welcome}>
                <FinaiLogo size={44} />
                <h2>What do you want to know?</h2>
                <p>Ask about spending, budgets, groups or friends, or tell me what to add.</p>
                {!p.available && (
                  <p className={styles.notice}>{finaiErrorMessage('AI_NOT_CONFIGURED')}</p>
                )}
                <div className={styles.suggestions}>
                  {FINAI_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={!p.available || busy}
                      onClick={() => p.onSend(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              p.messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className={cx(styles.row, styles.mine)}>
                    <div className={styles.userBubble}>{message.text}</div>
                  </div>
                ) : (
                  <article
                    key={message.id}
                    className={styles.row}
                    aria-label={`${FINAI_NAME} reply`}
                  >
                    <span className={styles.avatar} aria-hidden>
                      {isFinaiBusy(message) ? (
                        <ThinkingOrb state={orbStateFor(message)} size={16} />
                      ) : (
                        <FinaiLogo size={18} />
                      )}
                    </span>
                    <div className={styles.reply}>
                      {p.showSteps !== false && message.steps?.length ? (
                        <FinaiSteps steps={message.steps} busy={isFinaiBusy(message)} />
                      ) : null}
                      {message.status === 'error' ? (
                        <p className={styles.errorText}>{finaiErrorMessage(message.errorCode)}</p>
                      ) : !message.text && isFinaiBusy(message) ? (
                        message.steps?.some((step) => step.status === 'running') ? null : (
                          <ThinkingOrb
                            state={orbStateFor(message)}
                            size={18}
                            label={`${FINAI_NAME} is thinking`}
                            caption={message.stageLabel ?? 'Thinking…'}
                          />
                        )
                      ) : (
                        <FinaiMarkdown
                          text={message.text}
                          streaming={message.status === 'streaming'}
                        />
                      )}
                      {message.status === 'done' && message.a2ui ? (
                        <FinaiSurface
                          a2ui={message.a2ui}
                          actions={message.actions}
                          onDecide={p.onDecide}
                        />
                      ) : null}
                    </div>
                  </article>
                ),
              )
            )}
          </div>

          {showJump && (
            <button
              type="button"
              className={styles.jump}
              onClick={() => {
                nearBottom.current = true;
                setShowJump(false);
                scrollToBottom(true);
              }}
            >
              New reply <ArrowDown size={14} />
            </button>
          )}

          {p.error && (
            <p className={styles.error} role="alert">
              {p.error}
            </p>
          )}

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              if (canSend) p.onSend();
            }}
          >
            <textarea
              ref={input}
              aria-label={`Message ${FINAI_NAME}`}
              rows={1}
              value={p.draft}
              maxLength={4000}
              disabled={!p.available}
              placeholder={p.available ? `Message ${FINAI_NAME}` : 'FinAI is unavailable'}
              onChange={(event) => p.onDraftChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  if (canSend) p.onSend();
                }
              }}
            />
            <button type="submit" className={styles.send} aria-label="Send" disabled={!canSend}>
              {busy ? (
                <ThinkingOrb state="working" size={16} />
              ) : (
                <ArrowUp size={18} weight="bold" />
              )}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
