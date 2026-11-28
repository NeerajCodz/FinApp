import * as React from 'react';
import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@convex/_generated/api';
import { finaiViewing, shouldToastReply, type FinaiLatestReply } from '@finapp/ui/ai/finai';

/**
 * FinAI replies keep going after the chat is closed. This watches for them: `working` while a
 * reply is being written, `unreadCount` chats with unseen replies, and `onReply` for each newly
 * finished reply whose chat isn't on screen (never for replies that finished before mount).
 */
type Activity = FunctionReturnType<typeof api.ai.assistant.activity>;
type ActivityTracker = { userId: string | null | undefined; seenReplyIds: Set<string> | null };

/** Update the reply baseline and return replies that became visible after it was established. */
export function collectNewReplies(
  activity: Activity | undefined,
  userId: string | null | undefined,
  tracker: ActivityTracker,
): FinaiLatestReply[] {
  if (userId === undefined) return [];
  if (tracker.userId !== userId) {
    tracker.userId = userId;
    tracker.seenReplyIds = activity
      ? new Set(activity.replies.map((reply) => String(reply.replyId)))
      : null;
    return [];
  }
  if (!activity) return [];
  if (tracker.seenReplyIds === null) {
    tracker.seenReplyIds = new Set(activity.replies.map((reply) => String(reply.replyId)));
    return [];
  }

  const newlySeen: FinaiLatestReply[] = [];
  for (const reply of activity.replies) {
    const replyId = String(reply.replyId);
    if (tracker.seenReplyIds.has(replyId)) continue;
    tracker.seenReplyIds.add(replyId);
    newlySeen.push({
      ...reply,
      conversationId: String(reply.conversationId),
      replyId,
    });
  }
  return newlySeen;
}

export function useFinaiActivity(
  enabled: boolean,
  userId: string | null | undefined,
  onReply: (reply: FinaiLatestReply) => void,
) {
  const activity = useQuery(api.ai.assistant.activity, enabled ? {} : 'skip');
  const tracker = React.useRef<ActivityTracker>({ userId: undefined, seenReplyIds: null });
  const onReplyRef = React.useRef(onReply);
  React.useEffect(() => {
    onReplyRef.current = onReply;
  });

  React.useEffect(() => {
    for (const latest of collectNewReplies(activity, userId, tracker.current)) {
      if (shouldToastReply(latest, -1, finaiViewing())) onReplyRef.current(latest);
    }
  }, [activity, userId]);

  return {
    working: activity?.working ?? false,
    unreadCount: activity?.unreadCount ?? 0,
  };
}
