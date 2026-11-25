import { describe, expect, it, vi } from 'vitest';
import { buildA2uiMessages, type FinView } from '../../convex/ai/a2ui';
import { aiAttempts, aiModelForAttempt, aiShouldBackoff } from '../../convex/ai/config';
import { classifyReceiptCategory, decide, DECISIONS_URL } from '../../convex/ai/decisions';
import { shortDate } from '../../convex/ai/present';
import type { ReceiptDraft } from '../../convex/ai/receiptDomain';
import {
  receiptDraftToForm,
  receiptReviewFor,
  rescaleMinor,
} from '../../packages/ui/src/ai/receiptScan';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('model chain', () => {
  it('walks the fallbacks before backing off on the primary again', () => {
    expect(aiAttempts('chat')).toBeGreaterThanOrEqual(3);
    expect(aiModelForAttempt('chat', 0)).toBe('gemini-3.8-flash');
    expect(aiModelForAttempt('chat', 1)).toBe('gemini-3.6-flash');
    expect(aiModelForAttempt('chat', 3)).toBe('gemini-3.5-flash-lite');
    expect(aiShouldBackoff('chat', 0)).toBe(false);
    expect(aiShouldBackoff('chat', 2)).toBe(false);
    expect(aiShouldBackoff('chat', 3)).toBe(true);
    // The decision model has no text fallback.
    expect(aiModelForAttempt('decision', 3)).toBe('gemini-decision-1');
  });
});

describe('gemini-decision-1', () => {
  it('posts typed questions to /decisions and reads choice answers', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      expect(body.model).toBe('gemini-decision-1');
      expect(body.questions.category.criteria).toEqual({ c1: 'Food', c2: 'Travel: cabs, trains' });
      return json({
        answers: {
          category: {
            type: 'choice',
            choice: 'c1',
            confidence: 0.93,
            probabilities: { c1: 0.93, c2: 0.07 },
          },
        },
        usage: { total_tokens: 90 },
      });
    }) as unknown as typeof fetch;
    const picked = await classifyReceiptCategory(
      { merchant: 'Pizza Hut', title: 'Pizza Hut', items: [{ title: 'Margherita' }] },
      [
        { id: 'c1', name: 'Food' },
        { id: 'c2', name: 'Travel', notes: 'cabs, trains' },
      ],
      { apiKey: 'k', fetchImpl },
    );
    expect(fetchImpl.mock.calls[0]![0]).toBe(DECISIONS_URL);
    expect(picked).toEqual({ categoryId: 'c1', confidence: 0.93 });
  });

  it('leaves the category empty when unsure or unknown', async () => {
    const reply = (choice: string, confidence: number) =>
      (async () =>
        json({
          answers: { category: { type: 'choice', choice, confidence } },
        })) as unknown as typeof fetch;
    const categories = [{ id: 'c1', name: 'Food' }];
    const receipt = { merchant: null, title: 'Shop', items: [] };
    expect(
      await classifyReceiptCategory(receipt, categories, {
        apiKey: 'k',
        fetchImpl: reply('c1', 0.3),
      }),
    ).toBeNull();
    expect(
      await classifyReceiptCategory(receipt, categories, {
        apiKey: 'k',
        fetchImpl: reply('zz', 0.99),
      }),
    ).toBeNull();
    expect(await classifyReceiptCategory(receipt, [], { apiKey: 'k' })).toBeNull();
  });

  it('reads noul answers and retries overload', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(
        json({ answers: { yes: { type: 'noul', noul: 0.8, confidence: 0.8 } } }),
      );
    const result = await decide({
      input: 'x',
      questions: { yes: { type: 'noul', instructions: 'Is it?' } },
      apiKey: 'k',
      fetchImpl,
      sleep: async () => {},
    });
    expect(result.answers.yes).toEqual({ type: 'noul', noul: 0.8, confidence: 0.8 });
  });
});

describe('FinAI cards', () => {
  it('keeps every confirmation card, even past the view limit', () => {
    const actions: FinView[] = Array.from({ length: 5 }, (_, index) => ({
      kind: 'action',
      actionId: `a${index}`,
      title: `Add ${index}`,
      lines: [],
    }));
    const summary: FinView = { kind: 'summary', title: 'S', metrics: [] };
    const messages = buildA2uiMessages('s', [summary, ...actions])!;
    const components = (
      messages[1] as { updateComponents: { components: { component: string }[] } }
    ).updateComponents.components;
    expect(components.filter((c) => c.component === 'ActionCard')).toHaveLength(5);
  });

  it('formats dates in the requester timezone', () => {
    const lateEvening = Date.UTC(2026, 10, 3, 20, 30); // 3 Nov 20:30 UTC = 4 Nov in Kolkata
    expect(shortDate(lateEvening, 'Asia/Kolkata')).toBe('Nov 4');
    expect(shortDate(lateEvening)).toBe('Nov 3');
    expect(shortDate(lateEvening, 'Not/AZone')).toBe('Nov 3');
  });
});

describe('receipt rows', () => {
  it('rounds rows together so they still add up', () => {
    expect(rescaleMinor([6n, 6n], 1)).toEqual([1n, 0n]);
    expect(rescaleMinor([125n, 125n, 250n], 1)).toEqual([13n, 12n, 25n]);
    const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);
    const rows = [1234n, 5678n, 9n, 3333n];
    expect(sum(rescaleMinor(rows, 1))).toBe((sum(rows) + 5n) / 10n);
  });

  const draft: ReceiptDraft = {
    title: 'Souq',
    merchant: 'Souq',
    occurredAt: null,
    currency: 'KWD',
    amountMinor: 12n,
    items: [
      { id: 'r1', title: 'A', amountMinor: 6n },
      { id: 'r2', title: 'B', amountMinor: 6n },
    ],
    lowConfidence: [],
    warnings: [],
    categoryId: 'c1',
  };

  it('keeps a 3-decimal bill consistent in a 2-decimal account', () => {
    const form = receiptDraftToForm(draft, 'INR');
    expect(form.rows.map((row) => row.amount)).toEqual(['0.01', '0.00']);
    expect(form.amount).toBe('0.01');
    expect(form.categoryId).toBe('c1');
  });

  it('re-checks the currency when the account changes', () => {
    expect(receiptReviewFor(draft, 'KWD').fields).not.toContain('currency');
    const eur = receiptReviewFor(draft, 'EUR');
    expect(eur.fields).toContain('currency');
    expect(eur.warnings[0]).toMatch(/KWD.*EUR/);
  });
});
