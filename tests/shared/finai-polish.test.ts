import { describe, expect, it } from 'vitest';
import { applyStep, type AgentStep } from '../../convex/ai/agent';
import { FINAI_LOGO, finaiLogoSvg } from '../../packages/ui/src/ai/logo';
import { parseInline, parseMarkdown } from '../../packages/ui/src/ai/markdown';
import { formatStepDuration, stepsSummary } from '../../packages/ui/src/ai/finai';

describe('FinAI markdown', () => {
  it('turns bold, lists and headings into structure instead of raw markers', () => {
    const blocks = parseMarkdown(
      [
        '30 days:',
        '',
        '* **Account Balance:** Your "Test" bank balance is -₹4,150.00.',
        '* **Spending:** ₹5,150.00',
        '',
        '## Budgets',
        '1. Food',
        '2. Travel',
      ].join('\n'),
    );
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'list', 'heading', 'list']);
    const list = blocks[1] as Extract<(typeof blocks)[number], { type: 'list' }>;
    expect(list.ordered).toBe(false);
    expect(list.items[0]![0]).toEqual({
      type: 'strong',
      children: [{ type: 'text', text: 'Account Balance:' }],
    });
    expect((blocks[3] as { ordered: boolean }).ordered).toBe(true);
    expect(JSON.stringify(blocks)).not.toContain('**');
  });

  it('keeps unmatched markers and snake_case literal, and never emits HTML', () => {
    expect(parseInline('2 * 3 and snake_case_name')).toEqual([
      { type: 'text', text: '2 * 3 and snake_case_name' },
    ]);
    expect(parseInline('<b>hi</b> `x`')).toEqual([
      { type: 'text', text: '<b>hi</b> ' },
      { type: 'code', text: 'x' },
    ]);
    expect(parseInline('[docs](https://example.com)')).toEqual([{ type: 'text', text: 'docs' }]);
  });
});

describe('agent steps', () => {
  it('records each tool call from start to end', () => {
    let steps: AgentStep[] = [];
    steps = applyStep(
      steps,
      { stage: 'searching', label: 'Searching your transactions…', tool: 'search', phase: 'start' },
      1000,
    )!;
    expect(steps).toEqual([
      {
        tool: 'search',
        label: 'Searching your transactions',
        stage: 'searching',
        status: 'running',
        startedAt: 1000,
      },
    ]);
    steps = applyStep(steps, {
      stage: 'searching',
      label: 'x',
      tool: 'search',
      phase: 'end',
      ok: true,
      durationMs: 420,
    })!;
    expect(steps[0]).toMatchObject({ status: 'done', durationMs: 420 });
    expect(applyStep(steps, { stage: 'reasoning', label: 'Thinking…' })).toBeNull();
    steps = applyStep(
      steps,
      { stage: 'working', label: 'Reading budgets…', tool: 'budgets', phase: 'start' },
      2000,
    )!;
    steps = applyStep(steps, {
      stage: 'working',
      label: 'x',
      tool: 'budgets',
      phase: 'end',
      ok: false,
      durationMs: 30,
    })!;
    expect(steps[1]).toMatchObject({ status: 'error' });
    expect(stepsSummary(steps, false)).toBe('Used 2 tools · 1 failed · 450ms');
    expect(formatStepDuration(2400)).toBe('2.4s');
  });

  it('summarises the running step while busy', () => {
    const steps: AgentStep[] = [
      { tool: 'a', label: 'Reading budgets', stage: 'working', status: 'running', startedAt: 1 },
    ];
    expect(stepsSummary(steps, true)).toBe('Reading budgets…');
  });
});

describe('FinAI logo', () => {
  it('is a themed, standalone SVG', () => {
    const svg = finaiLogoSvg('#111', '#0f0');
    expect(svg).toContain(FINAI_LOGO.ring);
    expect(svg).toContain('fill="#0f0"');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});
