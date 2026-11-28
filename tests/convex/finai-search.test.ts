import { describe, expect, it, vi } from 'vitest';
import { assistantTools } from '../../convex/ai/assistantTools';

const tool = assistantTools.find((candidate) => candidate.name === 'search_transactions')!;

describe('FinAI transaction search pagination', () => {
  it('returns every match across raw pages when each page exceeds the result limit', async () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({
      id: `transaction-${index}`,
      title: `Match ${index}`,
      type: 'expense',
      amountMinor: 100n,
      currency: 'USD',
      occurredAt: Date.UTC(2025, 0, 1) - index,
    }));
    const runQuery = vi.fn(async (_ref: unknown, args: unknown) => {
      const { paginationOpts } = args as {
        paginationOpts: { cursor: string | null };
      };
      const page = paginationOpts.cursor === 'page-2' ? 1 : 0;
      return {
        items: rows.slice(page * 100, (page + 1) * 100),
        nextCursor: page === 0 ? 'page-2' : 'page-3',
        isDone: page === 1,
      };
    });
    const ctx = {
      run: { runQuery },
      defaultCurrency: 'USD',
      timeZone: 'UTC',
    } as never;

    const received: string[] = [];
    let cursor: string | undefined;
    let more = true;
    while (more) {
      const result = await tool.run(ctx, { query: 'Match', limit: 20, cursor });
      const data = result.data as {
        items: { id: string }[];
        more: boolean;
        cursor?: string;
      };
      received.push(...data.items.map((item) => item.id));
      more = data.more;
      cursor = data.cursor;
      if (more) expect(cursor).toBeTruthy();
    }

    expect(received).toEqual(rows.map((row) => row.id));
    expect(new Set(received).size).toBe(200);
    expect(runQuery).toHaveBeenCalledTimes(10);
  });
});
