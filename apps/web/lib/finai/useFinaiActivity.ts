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
  const seenReplyIds = React.useRef<Set<string> | null>(null);
  const onReplyRef = React.useRef(onReply);
  React.useEffect(() => {
    onReplyRef.current = onReply;
  });

  React.useEffect(() => {
    if (!activity) {
      seenReplyIds.current = null;
      return;
    }
    if (seenReplyIds.current === null) {
      seenReplyIds.current = new Set(activity.replies.map((reply) => String(reply.replyId)));
      return;
    }
    for (const reply of activity.replies) {
      const replyId = String(reply.replyId);
      if (seenReplyIds.current.has(replyId)) continue;
      seenReplyIds.current.add(replyId);
      const latest: FinaiLatestReply = {
        ...reply,
        conversationId: String(reply.conversationId),
        replyId,
      };
      if (shouldToastReply(latest, -1, finaiViewing())) onReplyRef.current(latest);
    }
  }, [activity]);

  return {
    working: activity?.working ?? false,
    unreadCount: activity?.unreadCount ?? 0,
  };
}
