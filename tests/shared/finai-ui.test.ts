import { describe, expect, it } from 'vitest';
import { buildA2uiMessages, FINAI_CATALOG_ID as SERVER_CATALOG } from '../../convex/ai/a2ui';
import {
  activeMention,
  applyMention,
  FINAI_CATALOG_ID,
  FINAI_MENTION,
  finaiChatOverrides,
  finaiErrorMessage,
  finaiTypingNames,
  mentionMatches,
  mentionsFinai,
  orbStateFor,
  parseFinaiSurface,
} from '../../packages/ui/src/ai/finai';

describe('FinAI A2UI parsing', () => {
  it('reads exactly what the server builds, in order', () => {
    expect(FINAI_CATALOG_ID).toBe(SERVER_CATALOG);
    const messages = buildA2uiMessages('finai-1', [
      {
        kind: 'summary',
        title: 'Month',
        metrics: [{ label: 'Spent', value: '₹10.00', tone: 'negative' }],
      },
      {
        kind: 'action',
        actionId: 'a1',
        title: 'Pay Max',
        lines: [{ label: 'Amount', value: '₹5.00' }],
      },
      {
        kind: 'balances',
        title: 'Trip',
        members: [{ name: 'Max', amount: 'owes ₹5.00', tone: 'negative' }],
        transfers: [{ from: 'Max', to: 'You', amount: '₹5.00' }],
      },
      {
        kind: 'bars',
        title: 'By category',
        bars: [{ label: 'Food', value: 1000, display: '₹10.00' }],
      },
    ]);
    const surface = parseFinaiSurface(JSON.stringify(messages))!;
    expect(surface.surfaceId).toBe('finai-1');
    expect(surface.nodes.map((node) => node.component)).toEqual([
      'ActionCard',
      'SummaryCard',
      'BalanceList',
      'BarChart',
    ]);
    expect(surface.nodes[0]).toMatchObject({
      actionId: 'a1',
      lines: [{ label: 'Amount', value: '₹5.00' }],
    });
  });

  it('rejects foreign catalogs, junk and unknown components', () => {
    expect(parseFinaiSurface(undefined)).toBeNull();
    expect(parseFinaiSurface('not json')).toBeNull();
    expect(
      parseFinaiSurface(
        JSON.stringify([
          {
            version: 'v0.9',
            createSurface: { surfaceId: 's', catalogId: 'https://evil.example/c.json' },
          },
        ]),
      ),
    ).toBeNull();
    const payload = [
      { version: 'v0.9', createSurface: { surfaceId: 's', catalogId: FINAI_CATALOG_ID } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'root', component: 'Column', children: ['x', 'y'] },
            { id: 'x', component: 'Iframe', src: 'https://evil.example' },
            {
              id: 'y',
              component: 'ProgressList',
              title: 'B',
              items: [{ label: 'L', progress: 9, detail: 'd', tone: 'weird' }],
            },
          ],
        },
      },
    ];
    const surface = parseFinaiSurface(JSON.stringify(payload))!;
    expect(surface.nodes).toEqual([
      {
        id: 'y',
        component: 'ProgressList',
        title: 'B',
        items: [{ label: 'L', progress: 1, detail: 'd', tone: 'neutral' }],
      },
    ]);
  });
});

describe('mention autocomplete', () => {
  it('finds the @query at the caret and replaces it', () => {
    expect(activeMention('hey @fi')).toEqual({ start: 4, query: 'fi' });
    expect(activeMention('@')).toEqual({ start: 0, query: '' });
    expect(activeMention('mail a@fi')).toBeNull();
    expect(activeMention('hey @fi there', 7)).toEqual({ start: 4, query: 'fi' });
    expect(mentionMatches([FINAI_MENTION], 'fin')).toHaveLength(1);
    expect(mentionMatches([FINAI_MENTION], 'zz')).toHaveLength(0);
    expect(applyMention('hey @fi', FINAI_MENTION)).toEqual({ draft: 'hey @finai ', caret: 11 });
    expect(applyMention('@f what', FINAI_MENTION, 2)).toEqual({ draft: '@finai what', caret: 7 });
    expect(mentionsFinai('@finai hi')).toBe(true);
    expect(mentionsFinai('x@finai.com')).toBe(false);
  });
});

describe('chat mapping', () => {
  it('shows FinAI replies as FinAI, with typing while busy', () => {
    const ai = { status: 'pending' as const, isRequester: true, actions: [] };
    expect(finaiChatOverrides(undefined)).toEqual({});
    expect(finaiChatOverrides(ai)).toMatchObject({
      kind: 'ai',
      mine: false,
      senderName: 'FinAI',
      ai,
    });
    expect(finaiTypingNames([{ ai }, {}])).toEqual(['FinAI']);
    expect(finaiTypingNames([{ ai: { status: 'done' } }])).toEqual([]);
    expect(orbStateFor({ status: 'streaming' })).toBe('working');
    expect(orbStateFor({ status: 'pending', stage: 'searching' })).toBe('searching');
    expect(finaiErrorMessage('AI_RATE_LIMITED')).toMatch(/limit/);
    expect(finaiErrorMessage('SOMETHING_NEW')).toBe('Something went wrong. Try again.');
  });
});
