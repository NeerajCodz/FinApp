import { describe, expect, it } from 'vitest';
import { collectNewReplies } from '../../apps/mobile/hooks/useFinaiActivity';

type Activity = NonNullable<Parameters<typeof collectNewReplies>[0]>;

function activity(replyIds: string[]): Activity {
  const replies = replyIds.map((replyId) => ({
    conversationId: `conversation-${replyId}`,
    replyId,
    title: `Reply ${replyId}`,
    preview: '',
    failed: false,
    at: 1,
  }));
  return {
    working: false,
    unreadCount: replies.length,
    latest: replies.at(-1) ?? null,
    replies,
  } as Activity;
}

describe('useFinaiActivity reply tracking', () => {
  it('preserves seen replies across unavailable activity and resets only on identity change', () => {
    const tracker = {
      userId: undefined as string | null | undefined,
      seenReplyIds: null as Set<string> | null,
    };

    expect(collectNewReplies(activity(['seen']), 'user-a', tracker)).toEqual([]);
    expect(collectNewReplies(undefined, 'user-a', tracker)).toEqual([]);
    expect(
      collectNewReplies(activity(['seen', 'finished-during-outage']), 'user-a', tracker).map(
        (reply) => reply.replyId,
      ),
    ).toEqual(['finished-during-outage']);
    expect(
      collectNewReplies(activity(['seen', 'finished-during-outage']), 'user-a', tracker),
    ).toEqual([]);

    expect(collectNewReplies(activity(['other-user-baseline']), 'user-b', tracker)).toEqual([]);
    expect(
      collectNewReplies(activity(['other-user-baseline', 'new-for-b']), 'user-b', tracker).map(
        (reply) => reply.replyId,
      ),
    ).toEqual(['new-for-b']);
  });
});
