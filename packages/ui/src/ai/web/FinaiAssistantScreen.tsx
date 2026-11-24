'use client';

/**
 * The FinAI assistant on the web: a conversation rail, the thread (user bubbles, streamed
 * FinAI replies with Thinking Orb progress and A2UI cards) and a composer with suggestions.
 * Data and actions come from the app through props.
 */
import React from 'react';
import { ArrowDown, ChatsCircle, PaperPlaneTilt, Plus, Trash } from '@phosphor-icons/react';
import { Illustration } from '../../illustrations/web';
import { ThinkingOrb } from '../../web/ThinkingOrb';
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
  const nearBottom = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);
  const busy = p.sending || p.messages.some((message) => isFinaiBusy(message));
  const last = p.messages[p.messages.length - 1];
  const scrollKey = `${p.messages.length}:${last?.text.length ?? 0}:${last?.status ?? ''}:${last?.a2ui ? 1 : 0}`;

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

  const canSend = p.available && !busy && !!p.draft.trim();
  const empty = !p.loading && p.messages.length === 0;

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="FinAI conversations">
        <button type="button" className={styles.newChat} onClick={() => p.onSelect(null)}>
          <Plus size={18} weight="bold" /> New chat
        </button>
        {p.conversations.length === 0 ? (
          <p className={styles.railEmpty}>Your chats with {FINAI_NAME} appear here.</p>
        ) : (
          <ul className={styles.conversations}>
            {p.conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className={cx(
                    styles.conversation,
                    conversation.id === p.activeId && styles.active,
                  )}
                  aria-current={conversation.id === p.activeId ? 'true' : undefined}
                  onClick={() => p.onSelect(conversation.id)}
                >
                  <ChatsCircle size={18} aria-hidden />
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
      </aside>

      <section className={styles.main} aria-label={`Chat with ${FINAI_NAME}`}>
        <header className={styles.header}>
          <span className={styles.orbBadge} aria-hidden>
            <ThinkingOrb state={busy ? 'working' : 'idle'} size={22} />
          </span>
          <div>
            <h1>{FINAI_NAME}</h1>
            <p>{busy ? 'Working on it…' : 'Your money, answered. Changes always ask first.'}</p>
          </div>
          <select
            className={styles.picker}
            aria-label="Conversation"
            value={p.activeId ?? ''}
            onChange={(event) => p.onSelect(event.currentTarget.value || null)}
          >
            <option value="">New chat</option>
            {p.conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
        </header>

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
              <Illustration scene="assistant" size={196} />
              <h2>Ask {FINAI_NAME} anything about your money</h2>
              <p>
                It reads your accounts, budgets, groups and friends, answers with live cards, and
                prepares changes for you to confirm.
              </p>
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
                <article key={message.id} className={styles.row} aria-label={`${FINAI_NAME} reply`}>
                  <span className={styles.avatar} aria-hidden>
                    <ThinkingOrb
                      state={isFinaiBusy(message) ? orbStateFor(message) : 'idle'}
                      size={18}
                    />
                  </span>
                  <div className={styles.reply}>
                    {message.status === 'error' ? (
                      <p className={styles.errorText}>{finaiErrorMessage(message.errorCode)}</p>
                    ) : !message.text && isFinaiBusy(message) ? (
                      <ThinkingOrb
                        state={orbStateFor(message)}
                        size={20}
                        label={`${FINAI_NAME} is thinking`}
                        caption={message.stageLabel ?? 'Thinking…'}
                      />
                    ) : (
                      <p className={styles.replyText}>
                        {message.text}
                        {isFinaiBusy(message) && <span className={styles.caret} aria-hidden />}
                      </p>
                    )}
                    {message.status === 'streaming' && message.stageLabel && message.text ? (
                      <span className={styles.stage}>{message.stageLabel}</span>
                    ) : null}
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
            aria-label={`Message ${FINAI_NAME}`}
            rows={1}
            value={p.draft}
            maxLength={4000}
            disabled={!p.available}
            placeholder={p.available ? `Ask ${FINAI_NAME}…` : 'FinAI is unavailable'}
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
              <ThinkingOrb state="working" size={18} />
            ) : (
              <PaperPlaneTilt size={20} weight="fill" />
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
