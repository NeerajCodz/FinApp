import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { aiErrorCode } from '../../convex/ai/errors';

const modules = import.meta.glob('../../convex/**/*.ts');

beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type Turn = { text?: string; call?: { name: string; args?: Record<string, unknown> } };

/** Scripted Gemini turns; returns the parsed request bodies of the chat calls. */
function mockGemini(turns: Turn[]) {
  const queue = [...turns];
  const bodies: Array<{
    contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).includes('streamGenerateContent'))
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: 'Statement' }] }, finishReason: 'STOP' }],
          }),
          { status: 200 },
        );
      bodies.push(JSON.parse(String(init?.body)));
      const turn = queue.shift() ?? { text: 'Done.' };
      const part = turn.call
        ? { functionCall: { name: turn.call.name, args: turn.call.args ?? {} } }
        : { text: turn.text };
      return new Response(
        `data: ${JSON.stringify({
          candidates: [{ content: { role: 'model', parts: [part] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
        })}\n\n`,
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    }),
  );
  return bodies;
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return aiErrorCode(error) ?? (error instanceof Error ? error.message : String(error));
  }
}

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const user = (email: string) =>
      ctx.db.insert('users', {
        email,
        displayName: email,
        emailVerificationTime: now,
        defaultCurrency: 'USD',
      });
    const ownerId = await user('owner@example.com');
    const outsiderId = await user('outsider@example.com');
    const accountId = await ctx.db.insert('accounts', {
      ownerId,
      name: 'Checking',
      type: 'bank',
      currency: 'USD',
      openingBalanceMinor: 0n,
      isIncludedInTotal: true,
      createdAt: now,
      updatedAt: now,
    });
    const foodId = await ctx.db.insert('categories', {
      ownerId,
      name: 'Food',
      kind: 'expense',
      isSystem: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, outsiderId, accountId, foodId };
  });
  const as = (id: string) => t.withIdentity({ subject: `${id}|session` });
  const upload = (body: string | Uint8Array, type: string) =>
    t.run((ctx) => ctx.storage.store(new Blob([body], { type })));
  return { t, ids, owner: as(ids.ownerId), outsider: as(ids.outsiderId), upload };
}

const page = { numItems: 20, cursor: null };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const CSV =
  'Date,Description,Amount,Category\n2026-01-05,Coffee,-4.50,Food\n2026-01-06,Salary,2500,\n2026-01-07,Lunch,-12,Dining\nbad,Row,1,\n';

async function registered(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  storageId: Id<'_storage'>,
  name: string,
) {
  const result = await owner.mutation(api.ai.attachments.register, { storageId, name });
  if (!('attachment' in result) || !result.attachment)
    throw new Error(`register failed: ${JSON.stringify(result)}`);
  return result.attachment;
}

describe('FinAI attachments', () => {
  it('registers supported files and deletes rejected ones', async () => {
    const { t, owner, upload } = await fixture();
    const image = await registered(owner, await upload(PNG, 'image/png'), 'receipt.png');
    expect(image).toMatchObject({ kind: 'image', mimeType: 'image/png', available: true });

    const exe = await upload('MZ', 'application/octet-stream');
    expect(
      await owner.mutation(api.ai.attachments.register, { storageId: exe, name: 'run.exe' }),
    ).toEqual({
      error: 'UNSUPPORTED_FILE',
    });
    expect(await t.run((ctx) => ctx.db.system.get('_storage', exe))).toBeNull();

    const big = await upload(new Uint8Array(10 * 1024 * 1024 + 1), 'text/csv');
    expect(
      await owner.mutation(api.ai.attachments.register, { storageId: big, name: 'big.csv' }),
    ).toEqual({
      error: 'FILE_TOO_LARGE',
    });
    // A file can't be registered twice (or claimed from another record).
    const csv = await upload(CSV, 'text/csv');
    await registered(owner, csv, 'bank.csv');
    expect(
      await codeOf(
        owner.mutation(api.ai.attachments.register, { storageId: csv, name: 'again.csv' }),
      ),
    ).toBe('INVALID_UPLOAD');
  });

  it('sends images inline and spreadsheets as text, and shows them on the message', async () => {
    const { owner, upload } = await fixture();
    const image = await registered(owner, await upload(PNG, 'image/png'), 'receipt.png');
    const sheet = await registered(owner, await upload(CSV, 'text/csv'), 'bank.csv');
    const bodies = mockGemini([{ text: 'Got them.' }]);
    const { conversationId } = await owner.action(api.ai.assistant.send, {
      text: '',
      attachmentIds: [image.id, sheet.id],
    });
    const parts = bodies[0]!.contents.at(-1)!.parts;
    expect(parts[0]).toEqual({ text: 'Please look at the attached files.' });
    const described = String(parts[1]!.text);
    expect(described).toContain(`"receipt.png" (id: ${image.id}, image): shown below.`);
    expect(described).toContain(`"bank.csv" (id: ${sheet.id}, spreadsheet): sheets "bank" 5 rows`);
    expect(parts).toContainEqual({
      inlineData: { mimeType: 'image/png', data: expect.any(String) },
    });
    expect(parts.some((part) => String(part.text).includes('2026-01-05,Coffee,-4.50,Food'))).toBe(
      true,
    );

    const rows = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    const prompt = rows.page.find((row) => row.role === 'user')!;
    expect(prompt.attachments?.map((file) => [file.name, file.kind, file.available])).toEqual([
      ['receipt.png', 'image', true],
      ['bank.csv', 'spreadsheet', true],
    ]);
    expect(prompt.attachments?.[0]?.url).toEqual(expect.any(String));
    // The chat is named by the model; until then an attachment-only prompt is named by its file.
    const [conversation] = await owner.query(api.ai.assistant.conversations, {});
    expect(conversation?.title).toBe('Statement');

    // Follow-ups name earlier files (with ids) instead of resending them.
    const later = mockGemini([{ text: 'Sure.' }]);
    await owner.action(api.ai.assistant.send, { conversationId, text: 'and now?' });
    const history = JSON.stringify(later[0]!.contents);
    expect(history).toContain(`[Attached: \\"receipt.png\\" (id: ${image.id}, image)`);
    expect(history).not.toContain('inlineData');
  });

  it("refuses someone else's or already-sent attachments", async () => {
    const { owner, outsider, upload } = await fixture();
    const sheet = await registered(owner, await upload(CSV, 'text/csv'), 'bank.csv');
    mockGemini([{ text: 'ok' }]);
    expect(
      await codeOf(
        outsider.action(api.ai.assistant.send, { text: 'peek', attachmentIds: [sheet.id] }),
      ),
    ).toBe('ATTACHMENT_NOT_FOUND');
    await owner.action(api.ai.assistant.send, { text: 'look', attachmentIds: [sheet.id] });
    expect(
      await codeOf(
        owner.action(api.ai.assistant.send, { text: 'again', attachmentIds: [sheet.id] }),
      ),
    ).toBe('ATTACHMENT_NOT_FOUND');
  });

  it('imports every spreadsheet row after one confirmation, idempotently', async () => {
    const { t, ids, owner, upload } = await fixture();
    const sheet = await registered(owner, await upload(CSV, 'text/csv'), 'bank.csv');
    const bodies = mockGemini([
      {
        call: {
          name: 'propose_import_transactions',
          args: {
            attachmentId: sheet.id,
            date: 'Date',
            description: 'Description',
            amount: 'Amount',
            category: 'Category',
          },
        },
      },
      { text: 'Confirm to import 3 transactions.' },
    ]);
    const { conversationId, replyId } = await owner.action(api.ai.assistant.send, {
      text: 'import this',
      attachmentIds: [sheet.id],
    });
    const toolResult = bodies[1]!.contents.at(-1)!.parts[0]!.functionResponse as {
      response: Record<string, unknown>;
    };
    expect(toolResult.response).toMatchObject({
      status: 'awaiting_confirmation',
      count: 3,
      skipped: [{ row: 5, reason: 'Unreadable date “bad”' }],
      unmatchedCategories: ['Dining'],
    });
    expect(await t.run((ctx) => ctx.db.query('transactions').collect())).toHaveLength(0);

    const rows = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    const [card] = rows.page.find((row) => row.id === replyId)!.actions;
    expect(card).toMatchObject({
      title: 'Import 3 transactions from “bank.csv”',
      status: 'pending',
    });
    expect(await owner.action(api.ai.actions.confirm, { actionId: card!.id })).toMatchObject({
      status: 'done',
    });
    const created = await t.run((ctx) => ctx.db.query('transactions').collect());
    expect(
      created
        .map((row) => [row.title, row.type, row.amountMinor, row.categoryId ?? null, row.accountId])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['Coffee', 'expense', 450n, ids.foodId, ids.accountId],
      ['Lunch', 'expense', 1200n, null, ids.accountId],
      ['Salary', 'income', 250_000n, null, ids.accountId],
    ]);
  });

  it('reports wrong column names with the real headers', async () => {
    const { owner, upload } = await fixture();
    const sheet = await registered(owner, await upload(CSV, 'text/csv'), 'bank.csv');
    const bodies = mockGemini([
      {
        call: {
          name: 'propose_import_transactions',
          args: { attachmentId: sheet.id, date: 'Day', amount: 'Amount' },
        },
      },
      { text: 'Which column has the date?' },
    ]);
    await owner.action(api.ai.assistant.send, { text: 'import', attachmentIds: [sheet.id] });
    const response = (
      bodies[1]!.contents.at(-1)!.parts[0]!.functionResponse as { response: unknown }
    ).response;
    expect(response).toMatchObject({
      error: 'IMPORT_COLUMN_NOT_FOUND:date',
      headers: ['Date', 'Description', 'Amount', 'Category'],
    });
  });

  it('deletes files when they expire per the retention setting, keeping the name in the chat', async () => {
    const { t, owner, upload } = await fixture();
    await owner.mutation(api.ai.settings.update, { attachmentRetention: '1h' });
    const sheet = await registered(owner, await upload(CSV, 'text/csv'), 'bank.csv');
    const pending = await registered(owner, await upload(PNG, 'image/png'), 'unsent.png');
    mockGemini([{ text: 'ok' }]);
    const { conversationId } = await owner.action(api.ai.assistant.send, {
      text: 'hi',
      attachmentIds: [sheet.id],
    });

    // Nothing is due yet.
    expect(await t.mutation(internal.ai.attachments.purgeExpired, {})).toBe(0);
    await t.run(async (ctx) => {
      // Fast-forward both expiries.
      for (const id of [sheet.id, pending.id])
        await ctx.db.patch(id as Id<'finaiAttachments'>, { expiresAt: Date.now() - 1 });
    });
    expect(await t.mutation(internal.ai.attachments.purgeExpired, {})).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query('finaiAttachments').collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'bank.csv', deletedAt: expect.any(Number) });
    expect(rows[0]!.storageId).toBeUndefined();
    const messages = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    expect(messages.page.find((row) => row.role === 'user')?.attachments?.[0]).toMatchObject({
      name: 'bank.csv',
      available: false,
    });
    // "Never" keeps files indefinitely.
    await owner.mutation(api.ai.settings.update, { attachmentRetention: 'never' });
    const kept = await registered(owner, await upload(CSV, 'text/csv'), 'kept.csv');
    await owner.action(api.ai.assistant.send, {
      conversationId,
      text: 'keep',
      attachmentIds: [kept.id],
    });
    const keptRow = await t.run((ctx) => ctx.db.get(kept.id as Id<'finaiAttachments'>));
    expect(keptRow?.expiresAt).toBeUndefined();
  });

  it('removes files with the conversation, and refuses uploads when attachments are off', async () => {
    const { t, owner, upload } = await fixture();
    const sheet = await registered(owner, await upload(CSV, 'text/csv'), 'bank.csv');
    mockGemini([{ text: 'ok' }]);
    const { conversationId } = await owner.action(api.ai.assistant.send, {
      text: 'hi',
      attachmentIds: [sheet.id],
    });
    await owner.mutation(api.ai.assistant.deleteConversation, { conversationId });
    expect(await t.run((ctx) => ctx.db.query('finaiAttachments').collect())).toEqual([]);

    await owner.mutation(api.ai.settings.update, { allowAttachments: false });
    expect(await codeOf(owner.mutation(api.ai.attachments.generateUploadUrl, {}))).toBe(
      'ATTACHMENTS_DISABLED',
    );
  });
});
