import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import type { ActionCtx } from '../../convex/_generated/server';
import { attachmentParts } from '../../convex/ai/attachmentContent';
import { finaiAttachmentLimits } from '../../convex/ai/config';
import { aiErrorCode } from '../../convex/ai/errors';
import { providerChat } from '../../convex/ai/providers';

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
  const upload = async (body: string | Uint8Array, type: string, actor = as(ids.ownerId)) => {
    const { ticket } = await actor.mutation(api.ai.attachments.generateUploadUrl, {});
    const storageId = await t.run((ctx) => ctx.storage.store(new Blob([body], { type })));
    return { ticket, storageId };
  };
  return { t, ids, owner: as(ids.ownerId), outsider: as(ids.outsiderId), upload };
}

const page = { numItems: 20, cursor: null };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const CSV =
  'Date,Description,Amount,Category\n2026-01-05,Coffee,-4.50,Food\n2026-01-06,Salary,2500,\n2026-01-07,Lunch,-12,Dining\nbad,Row,1,\n';

type UploadedFile = { ticket: string; storageId: Id<'_storage'> };

async function register(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  file: UploadedFile,
  name: string,
) {
  return owner.mutation(api.ai.attachments.register, { ...file, name });
}

async function registered(
  owner: Awaited<ReturnType<typeof fixture>>['owner'],
  file: UploadedFile,
  name: string,
) {
  const result = await register(owner, file, name);
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
    expect(await register(owner, exe, 'run.exe')).toEqual({
      error: 'UNSUPPORTED_FILE',
    });
    expect(await t.run((ctx) => ctx.db.system.get('_storage', exe.storageId))).toBeNull();

    const big = await upload(new Uint8Array(10 * 1024 * 1024 + 1), 'text/csv');
    expect(await register(owner, big, 'big.csv')).toEqual({
      error: 'FILE_TOO_LARGE',
    });
    // A file can't be registered twice (or claimed from another record).
    const csv = await upload(CSV, 'text/csv');
    await registered(owner, csv, 'bank.csv');
    expect(await codeOf(register(owner, csv, 'again.csv'))).toBe('INVALID_UPLOAD');
  });

  it('starts the registration grace period when an uploaded object reaches storage', async () => {
    const { t, owner } = await fixture();
    const { ticket: uploadTicket } = await owner.mutation(api.ai.attachments.generateUploadUrl, {});

    const storedId = await t.run((ctx) => ctx.storage.store(new Blob([CSV], { type: 'text/csv' })));
    await t.run(async (ctx) => {
      const upload = await ctx.db
        .query('finaiAttachmentUploads')
        .withIndex('by_ticket', (q) => q.eq('ticket', uploadTicket))
        .unique();
      if (!upload) throw new Error('upload ticket not found');
      await ctx.db.patch(upload._id, { createdAt: Date.now() - 16 * 60 * 1000 });
    });
    const registered = await owner.mutation(api.ai.attachments.register, {
      ticket: uploadTicket,
      storageId: storedId,
      name: 'delayed.csv',
    });

    expect(registered).toMatchObject({
      attachment: { kind: 'spreadsheet', name: 'delayed.csv' },
    });
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

  it('converts a real HEIF fixture for Anthropic and budgets the converted bytes', async () => {
    // Fixture: libheif tests/data/rainbow-451x461.heic (MIT; see adjacent COPYING).
    const heic = Uint8Array.from(
      Buffer.from(
        (
          await readFile(new URL('../fixtures/finai-heic.heif.base64', import.meta.url), 'utf8')
        ).trim(),
        'base64',
      ),
    );
    const heicId = 'heic-fixture' as Id<'_storage'>;
    const pngId = 'budget-png' as Id<'_storage'>;
    const stored = new Map<string, Uint8Array>([[heicId, heic]]);
    const t = convexTest(schema, modules);
    let converted: { data: ArrayBuffer; byteSize: number } | undefined;
    const ctx = {
      storage: {
        get: async (storageId: Id<'_storage'>) => {
          const bytes = stored.get(storageId);
          return bytes ? new Blob([bytes]) : null;
        },
      },
      runAction: async (_action: unknown, args: { bytes: ArrayBuffer; maxOutputBytes: number }) => {
        converted = await t.action(internal.ai.heicConversion.toJpeg, args);
        return converted;
      },
    } as unknown as ActionCtx;
    const heicAttachment = {
      id: 'heic',
      name: 'fixture.heif',
      kind: 'image' as const,
      mimeType: 'image/heif',
      size: heic.length,
      storageId: heicId,
    };

    const parts = await attachmentParts(ctx, [heicAttachment]);
    const inline = parts.find((part) => part.inlineData)?.inlineData;
    expect(inline?.mimeType).toBe('image/jpeg');
    expect(converted?.byteSize).toBeGreaterThan(heic.length);

    let requestBody = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        requestBody = String(init?.body);
        return new Response(
          [
            `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 1 } } })}`,
            `data: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}`,
            `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'ok' } })}`,
            `data: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } })}`,
          ].join('\n\n'),
          { status: 200, headers: { 'content-type': 'text/event-stream' } },
        );
      }),
    );
    await providerChat({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-test',
    })({
      role: 'chat',
      parts: [],
      contents: [{ role: 'user', parts: [{ inlineData: inline! }] }],
    });
    const anthropicBody = JSON.parse(requestBody) as {
      messages: Array<{ content: Array<{ source?: { media_type: string } }> }>;
    };
    expect(anthropicBody.messages[0]!.content[0]!.source?.media_type).toBe('image/jpeg');

    const almostFull = new Uint8Array(finaiAttachmentLimits.maxInlineBytes - heic.length);
    almostFull.set(PNG.subarray(0, 8));
    stored.set(pngId, almostFull);
    const capped = await attachmentParts(ctx, [
      { ...heicAttachment, id: 'png', name: 'large.png', storageId: pngId },
      heicAttachment,
    ]);
    expect(capped.some((part) => part.inlineData?.mimeType === 'image/jpeg')).toBe(false);
    expect(capped[0]?.text).toContain('too large to view together');
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
  it('retries a failed partial import immediately without duplicating committed rows', async () => {
    const { t, owner, upload } = await fixture();
    const csv = 'Date,Description,Amount\n2026-01-05,First,-4.50\n2026-01-06,Second,-2.00\n';
    const sheet = await registered(owner, await upload(csv, 'text/csv'), 'retry.csv');
    mockGemini([
      {
        call: {
          name: 'propose_import_transactions',
          args: {
            attachmentId: sheet.id,
            date: 'Date',
            description: 'Description',
            amount: 'Amount',
          },
        },
      },
      { text: 'Confirm to import.' },
    ]);
    const { conversationId, replyId } = await owner.action(api.ai.assistant.send, {
      text: 'import',
      attachmentIds: [sheet.id],
    });
    const messages = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    const card = messages.page.find((row) => row.id === replyId)!.actions[0]!;
    const originalPayload = await t.run(async (ctx) => {
      const actionRow = await ctx.db.get(card.id as Id<'finaiActions'>);
      const payload = JSON.parse(actionRow!.payload) as { rows: unknown[][] };
      payload.rows[1]![2] = 'invalid';
      await ctx.db.patch(card.id as Id<'finaiActions'>, { payload: JSON.stringify(payload) });
      return actionRow!.payload;
    });
    const failedResult = await owner.action(api.ai.actions.confirm, {
      actionId: card.id as Id<'finaiActions'>,
    });
    expect(failedResult).toMatchObject({
      status: 'failed',
      errorCode: 'INVALID_ACTION_PAYLOAD',
    });
    expect(
      await t.run(async (ctx) => (await ctx.db.get(card.id as Id<'finaiActions'>))?.status),
    ).toBe('failed');
    const failedMessages = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    expect(failedMessages.page.find((row) => row.id === replyId)!.actions[0]).toMatchObject({
      status: 'failed',
      errorCode: failedResult.errorCode,
      canDecide: true,
      canCancel: false,
    });
    await t.run(async (ctx) => {
      const payload = JSON.parse(originalPayload) as { rows: unknown[][] };
      payload.rows[1]![2] = '200';
      await ctx.db.patch(card.id as Id<'finaiActions'>, { payload: JSON.stringify(payload) });
    });
    expect(
      await owner.action(api.ai.actions.confirm, { actionId: card.id as Id<'finaiActions'> }),
    ).toMatchObject({
      status: 'done',
    });
    expect(await t.run((ctx) => ctx.db.query('transactions').collect())).toHaveLength(2);
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
