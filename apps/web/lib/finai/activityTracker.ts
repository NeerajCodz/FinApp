import type { FinaiLatestReply } from '@finapp/ui/ai/finai';

export type FinaiActivityTracker = {
  userId: string | null;
  seenReplyIds: Set<string> | null;
};

type ActivitySnapshot = { replies: readonly FinaiLatestReply[] };

export function collectUnseenReplies(
  tracker: FinaiActivityTracker,
  userId: string | null,
  activity: ActivitySnapshot | undefined,
): FinaiLatestReply[] {
  if (tracker.userId !== userId) {
    tracker.userId = userId;
    tracker.seenReplyIds = null;
  }
  if (!activity) return [];

  const seenReplyIds = tracker.seenReplyIds;
  if (seenReplyIds === null) {
    tracker.seenReplyIds = new Set(activity.replies.map((reply) => String(reply.replyId)));
    return [];
  }

  const unseen: FinaiLatestReply[] = [];
  for (const reply of activity.replies) {
    const replyId = String(reply.replyId);
    if (seenReplyIds.has(replyId)) continue;
    seenReplyIds.add(replyId);
    unseen.push({
      ...reply,
      conversationId: String(reply.conversationId),
      replyId,
    });
  }
  return unseen;
}
