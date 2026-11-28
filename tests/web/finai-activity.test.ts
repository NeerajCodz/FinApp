import { describe, expect, it } from 'vitest';
import type { FinaiLatestReply } from '../../packages/ui/src/ai/finai';
import {
  collectUnseenReplies,
  type FinaiActivityTracker,
} from '../../apps/web/lib/finai/activityTracker';

const reply = (replyId: string): FinaiLatestReply => ({
  conversationId: 'conversation',
  replyId,
  title: replyId,
  preview: '',
  failed: false,
  at: 1,
});

describe('FinAI activity tracking', () => {
  it('preserves seen replies across temporary query unavailability', () => {
    const tracker: FinaiActivityTracker = { userId: 'alice', seenReplyIds: null };
    const existing = reply('existing');
    const completedDuringDisconnect = reply('completed-during-disconnect');

    expect(collectUnseenReplies(tracker, 'alice', { replies: [existing] })).toEqual([]);
    expect(collectUnseenReplies(tracker, 'alice', undefined)).toEqual([]);
    expect(
      collectUnseenReplies(tracker, 'alice', {
        replies: [existing, completedDuringDisconnect],
      }),
    ).toEqual([completedDuringDisconnect]);
  });

  it('seeds a fresh baseline when the signed-in user changes', () => {
    const tracker: FinaiActivityTracker = { userId: 'alice', seenReplyIds: null };
    expect(collectUnseenReplies(tracker, 'alice', { replies: [reply('alice-reply')] })).toEqual([]);

    const existingForBob = reply('bob-existing');
    expect(collectUnseenReplies(tracker, 'bob', { replies: [existingForBob] })).toEqual([]);
    expect(
      collectUnseenReplies(tracker, 'bob', {
        replies: [existingForBob, reply('bob-new')],
      }).map(({ replyId }) => replyId),
    ).toEqual(['bob-new']);
  });
});
