'use client';

import * as React from 'react';
import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  finaiErrorMessage,
  finaiViewing,
  setFinaiViewing,
  type FinaiAssistantMessage,
} from '@finapp/ui/ai/finai';

const PAGE_SIZE = 30;

function errorCode(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'data' in cause) {
    const data = (cause as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'code' in data)
      return String((data as { code: unknown }).code);
  }
  return cause instanceof Error ? (/[A-Z][A-Z_]{3,}/.exec(cause.message)?.[0] ?? '') : '';
}

/** State and actions for the FinAI assistant screen (web). */
export function useFinaiAssistant(enabled: boolean, initialId: string | null = null) {
  const [activeId, setActiveId] = React.useState<string | null>(initialId);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const status = useQuery(api.ai.assistant.status, enabled ? {} : 'skip');
  const conversations = useQuery(api.ai.assistant.conversations, enabled ? {} : 'skip');
  const history = usePaginatedQuery(
    api.ai.assistant.messages,
    enabled && activeId ? { conversationId: activeId } : 'skip',
    { initialNumItems: PAGE_SIZE },
  );
  const sendAction = useAction(api.ai.assistant.send);
  const remove = useMutation(api.ai.assistant.deleteConversation);
  const createConversation = useMutation(api.ai.assistant.createConversation);
  const markRead = useMutation(api.ai.assistant.markRead);

  // The open chat is "on screen": its replies are marked read and never toast.
  React.useEffect(() => {
    if (!enabled || !activeId) return;
    setFinaiViewing(activeId);
    return () => {
      if (finaiViewing() === activeId) setFinaiViewing(null);
    };
  }, [enabled, activeId]);
  const activeUnread = conversations?.some((row) => String(row.id) === activeId && row.unread);
  React.useEffect(() => {
    if (!enabled || !activeId || !activeUnread) return;
    markRead({ conversationId: activeId as Id<'finaiConversations'> }).catch(() => undefined);
  }, [enabled, activeId, activeUnread, markRead]);
  // The prompt shows immediately while the action stores it, only in its own conversation
  // (`conversationId` is null until a new conversation has been created).
  const [optimistic, setOptimistic] = React.useState<{
    conversationId: string | null;
    message: FinaiAssistantMessage;
  } | null>(null);

  const messages = React.useMemo<FinaiAssistantMessage[]>(() => {
    const rows = activeId
      ? [...history.results]
          .reverse()
          .map((row) => ({ ...row, id: String(row.id) }) as FinaiAssistantMessage)
      : [];
    const pending = optimistic?.conversationId === activeId ? optimistic?.message : undefined;
    if (
      pending &&
      !rows.some(
        (row) =>
          row.role === 'user' &&
          row.text === pending.text &&
          row.createdAt >= pending.createdAt - 5_000,
      )
    )
      rows.push(pending, {
        id: 'pending-reply',
        role: 'assistant',
        text: '',
        status: 'pending',
        stage: 'reasoning',
        stageLabel: 'Thinking…',
        createdAt: pending.createdAt + 1,
      });
    return rows;
  }, [activeId, history.results, optimistic]);

  const send = React.useCallback(
    async (override?: string) => {
      const text = (override ?? draft).trim();
      if (!text || sending) return;
      setSending(true);
      setError(null);
      setDraft('');
      setOptimistic({
        conversationId: activeId,
        message: { id: 'pending-user', role: 'user', text, status: 'done', createdAt: Date.now() },
      });
      try {
        let conversationId = activeId as Id<'finaiConversations'> | null;
        if (!conversationId) {
          const created = await createConversation({});
          conversationId = created;
          setOptimistic((prev) => (prev ? { ...prev, conversationId: String(created) } : prev));
          // Open it unless the user has already moved to another conversation.
          setActiveId((current) => current ?? String(created));
        }
        await sendAction({ text, conversationId });
      } catch (cause) {
        setError(finaiErrorMessage(errorCode(cause)));
        setDraft(text);
      } finally {
        setOptimistic(null);
        setSending(false);
      }
    },
    [activeId, createConversation, draft, sendAction, sending],
  );

  const select = React.useCallback((id: string | null) => {
    setActiveId(id);
    setError(null);
  }, []);

  return {
    available: status?.available ?? true,
    conversations: (conversations ?? []).map((row) => ({ ...row, id: String(row.id) })),
    activeId,
    select,
    remove: async (id: string) => {
      await remove({ conversationId: id as Id<'finaiConversations'> });
      if (id === activeId) setActiveId(null);
    },
    messages,
    loading: !!activeId && history.status === 'LoadingFirstPage',
    canLoadOlder: history.status === 'CanLoadMore',
    loadOlder: () => history.loadMore(PAGE_SIZE),
    draft,
    setDraft,
    send,
    sending,
    error,
  };
}
