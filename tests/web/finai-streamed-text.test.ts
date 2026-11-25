import { describe, expect, it } from 'vitest';
import { shouldToastReply } from '../../packages/ui/src/ai/finai';
import {
  balancePartialMarkdown,
  revealRate,
  revealStep,
} from '../../packages/ui/src/ai/streamedText';

describe('revealStep', () => {
  it('reveals at least a reading pace and never overshoots', () => {
    expect(revealStep(0, 10, 16, revealRate(10))).toBe(1);
    expect(revealStep(0, 3, 1000, revealRate(3))).toBe(3);
    expect(revealStep(5, 5, 16, revealRate(0))).toBe(5);
  });

  it('clears any chunk, small or large, within about half a second', () => {
    for (const size of [20, 400, 2000, 6000]) {
      const rate = revealRate(size);
      let shown = 0;
      let elapsed = 0;
      while (shown < size) {
        shown = revealStep(shown, size, 16, rate);
        elapsed += 16;
      }
      expect(elapsed).toBeLessThanOrEqual(size <= 30 ? 600 : 520);
    }
  });
});

describe('balancePartialMarkdown', () => {
  it('closes bold, italics, inline code and fences left open mid-stream', () => {
    expect(balancePartialMarkdown('You spent **₹1,2')).toBe('You spent **₹1,2**');
    expect(balancePartialMarkdown('an *estim')).toBe('an *estim*');
    expect(balancePartialMarkdown('run `list_tr')).toBe('run `list_tr`');
    expect(balancePartialMarkdown('```\nconst a')).toBe('```\nconst a\n```');
  });

  it('leaves balanced text and list bullets alone', () => {
    expect(balancePartialMarkdown('**Total** is *fine*')).toBe('**Total** is *fine*');
    expect(balancePartialMarkdown('* one\n* two')).toBe('* one\n* two');
  });

  it('holds back an opener that has no text after it yet', () => {
    expect(balancePartialMarkdown('Top category: **')).toBe('Top category: ');
  });
});

describe('shouldToastReply', () => {
  const reply = {
    conversationId: 'c1',
    replyId: 'r1',
    title: 'Budget check',
    preview: 'All good',
    failed: false,
    at: 2_000,
  };
  it('toasts only replies newer than what was seen, and never for the chat on screen', () => {
    expect(shouldToastReply(reply, 1_000, null)).toBe(true);
    expect(shouldToastReply(reply, 1_000, 'c2')).toBe(true);
    expect(shouldToastReply(reply, 1_000, 'c1')).toBe(false);
    expect(shouldToastReply(reply, 2_000, null)).toBe(false);
    expect(shouldToastReply(null, 0, null)).toBe(false);
  });
});
