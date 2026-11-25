'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { finaiViewing, shouldToastReply, type FinaiLatestReply } from '@finapp/ui/ai/finai';

/**
 * FinAI replies keep going after the chat is closed. This watches for them: `working` while a
 * reply is being written, `unreadCount` chats with unseen replies, and `onReply` for each newly
 * finished reply whose chat isn't on screen (never for replies that finished before mount).
 */
export function useFinaiActivity(enabled: boolean, onReply: (reply: FinaiLatestReply) => void) {
  const activity = useQuery(api.ai.assistant.activity, enabled ? {} : 'skip');
  const seenAt = React.useRef<number | null>(null);
  const onReplyRef = React.useRef(onReply);
  React.useEffect(() => {
    onReplyRef.current = onReply;
  });

  const latest = React.useMemo<FinaiLatestReply | null>(
    () =>
      activity?.latest
        ? {
            ...activity.latest,
            conversationId: String(activity.latest.conversationId),
            replyId: String(activity.latest.replyId),
          }
        : null,
    [activity],
  );
  const latestAt = latest?.at ?? 0;
  React.useEffect(() => {
    if (!activity) return;
    if (seenAt.current === null) {
      seenAt.current = Math.max(latestAt, Date.now() - 1_000);
      return;
    }
    if (latest && shouldToastReply(latest, seenAt.current, finaiViewing()))
      onReplyRef.current(latest);
    seenAt.current = Math.max(seenAt.current, latestAt);
  }, [activity, latest, latestAt]);

  return {
    working: activity?.working ?? false,
    unreadCount: activity?.unreadCount ?? 0,
  };
}
