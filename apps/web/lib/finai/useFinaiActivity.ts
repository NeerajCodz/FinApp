'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { finaiViewing, shouldToastReply, type FinaiLatestReply } from '@finapp/ui/ai/finai';
import { collectUnseenReplies, type FinaiActivityTracker } from './activityTracker';

/**
 * FinAI replies keep going after the chat is closed. This watches for them: `working` while a
 * reply is being written, `unreadCount` chats with unseen replies, and `onReply` for each newly
 * finished reply whose chat isn't on screen (never for replies that finished before mount).
 */
export function useFinaiActivity(
  enabled: boolean,
  onReply: (reply: FinaiLatestReply) => void,
  userId: string | null,
) {
  const activity = useQuery(api.ai.assistant.activity, enabled ? {} : 'skip');
  const tracker = React.useRef<FinaiActivityTracker>({ userId, seenReplyIds: null });
  const onReplyRef = React.useRef(onReply);
  React.useEffect(() => {
    onReplyRef.current = onReply;
  });

  React.useEffect(() => {
    for (const latest of collectUnseenReplies(tracker.current, userId, activity)) {
      if (shouldToastReply(latest, -1, finaiViewing())) onReplyRef.current(latest);
    }
  }, [activity, userId]);

  return {
    working: activity?.working ?? false,
    unreadCount: activity?.unreadCount ?? 0,
  };
}
