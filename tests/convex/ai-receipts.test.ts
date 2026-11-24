import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import schema from '../../convex/schema';
import { aiLimits } from '../../convex/ai/config';
import { aiErrorCode } from '../../convex/ai/errors';
import { sniffImageType, validateReceiptImage } from '../../convex/ai/receipts';
import { usageWindowStart } from '../../convex/ai/usage';

const modules = import.meta.glob('../../convex/**/*.ts');
const people = {
  owner: { subject: 'scan-owner', email: 'scan-owner@example.com', name: 'Owner' },
  other: { subject: 'scan-other', email: 'scan-other@example.com', name: 'Other' },
};
type Person = keyof typeof people;

beforeEach(() => {
  vi.stubEnv('AUTH_RESEND_KEY', 're_test_key');
  vi.stubEnv('AUTH_EMAIL_FROM', 'Finapp <mail@example.com>');
  vi.stubEnv('GEMINI_API_KEY', 'test-gemini-key');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup() {
  const t = convexTest(schema, modules);
  const ids = {} as Record<Person, Id<'users'>>;
  for (const key of Object.keys(people) as Person[])
    ids[key] = await t.run((ctx) =>
      ctx.db.insert('users', {
        emailVerificationTime: 1,
        identityId: people[key].subject,
        email: people[key].email,
        name: people[key].name,
        username: `${key}_scanner`,
      }),
    );
  const as = (person: Person) => t.withIdentity(people[person]);
  /** Asks for a ticket as `person`, then stores `blob` as if uploaded to the URL. */
  const upload = async (person: Person, blob: Blob) => {
    const { ticket } = await as(person).mutation(api.ai.receipts.generateUploadUrl, {});
    const storageId = await t.run((ctx) => ctx.storage.store(blob));
    return { ticket, storageId };
  };
  const stored = (storageId: Id<'_storage'>) =>
    t.run((ctx) => ctx.db.system.get('_storage', storageId));
  return { t, ids, as, upload, stored };
}

const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' });
const geminiReceipt = {
  isReceipt: true,
  merchant: 'Corner Cafe',
  occurredAt: '2026-11-20',
  currency: 'INR',
  items: [
    { title: 'Cold coffee', quantity: 2, amount: 300, confidence: 0.9 },
    { title: 'Sandwich', amount: 180, confidence: 0.9 },
  ],
  tax: 24,
  total: 504,
  confidence: { merchant: 0.9, occurredAt: 0.9, currency: 0.9, items: 0.9, total: 0.9 },
  warnings: [],
};
function mockGemini(body: unknown = geminiReceipt) {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(body) }] }, finishReason: 'STOP' },
          ],
          usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 80, totalTokenCount: 980 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return aiErrorCode(error) ?? (error instanceof Error ? error.message : String(error));
  }
}

describe('receipt image checks', () => {
  it('accepts images by declared type and size, and sniffs the real type from bytes', () => {
    expect(validateReceiptImage({ contentType: 'image/heic', size: 1000 })).toBe(true);
    expect(validateReceiptImage({ contentType: 'image/png; charset=binary', size: 1 })).toBe(true);
    expect(validateReceiptImage({ contentType: 'application/pdf', size: 1000 })).toBe(false);
    expect(validateReceiptImage({ contentType: 'image/jpeg', size: 8 * 1024 * 1024 + 1 })).toBe(
      false,
    );
    expect(validateReceiptImage({ size: 0 })).toBe(false);
    const bytes = (...values: (number | string)[]) =>
      new Uint8Array(
        values.flatMap((value) =>
          typeof value === 'string' ? [...value].map((char) => char.charCodeAt(0)) : [value],
        ),
      );
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageType(bytes(0x89, 'PNG'))).toBe('image/png');
    expect(sniffImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
    expect(sniffImageType(bytes(0, 0, 0, 24, 'ftypheic'))).toBe('image/heic');
    expect(sniffImageType(bytes(0, 0, 0, 24, 'ftypmif1'))).toBe('image/heif');
    expect(sniffImageType(bytes('%PDF-1.7'))).toBeNull();
  });
});

describe('ai.receipts', () => {
  it('reports AI_NOT_CONFIGURED without a Gemini key', async () => {
    const { as, upload } = await setup();
    const { ticket, storageId } = await upload('owner', png());
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await codeOf(as('owner').mutation(api.ai.receipts.generateUploadUrl, {}))).toBe(
      'AI_NOT_CONFIGURED',
    );
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, { storageId, ticket }))).toBe(
      'AI_NOT_CONFIGURED',
    );
  });

  it('requires sign-in', async () => {
    const { t } = await setup();
    expect(await codeOf(t.mutation(api.ai.receipts.generateUploadUrl, {}))).toMatch(
      /AUTH_REQUIRED/,
    );
  });

  it('parses a receipt into a reconciled draft and deletes the image', async () => {
    const { t, ids, as, upload, stored } = await setup();
    const fetchMock = mockGemini();
    const { ticket, storageId } = await upload('owner', png());
    const draft = await as('owner').action(api.ai.receipts.parse, {
      storageId,
      ticket,
      currency: 'INR',
    });
    expect(draft).toMatchObject({
      title: 'Corner Cafe',
      currency: 'INR',
      amountMinor: 50400n,
      occurredAt: Date.UTC(2026, 10, 20, 12),
      lowConfidence: [],
    });
    expect(draft.items.map((item) => [item.title, item.amountMinor, item.quantity])).toEqual([
      ['Cold coffee', 30000n, 2],
      ['Sandwich', 18000n, undefined],
      ['Tax', 2400n, undefined],
    ]);
    expect(await stored(storageId)).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('gemini-3.5-flash-lite:generateContent');
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].inlineData).toEqual({
      mimeType: 'image/png',
      data: 'iVBORwECAw==',
    });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    const usage = await t.run((ctx) => ctx.db.query('aiUsage').collect());
    expect(usage).toEqual([
      expect.objectContaining({
        userId: ids.owner,
        kind: 'ocr',
        count: 1,
        promptTokens: 900,
        outputTokens: 80,
      }),
    ]);
    // Tickets are single use.
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, { storageId, ticket }))).toBe(
      'INVALID_UPLOAD_TICKET',
    );
  });

  it('rejects non-images and oversized images, deleting them', async () => {
    const { as, upload, stored } = await setup();
    const fetchMock = mockGemini();
    const text = await upload('owner', new Blob(['hello'], { type: 'text/plain' }));
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, text))).toBe('INVALID_IMAGE');
    expect(await stored(text.storageId)).toBeNull();
    const huge = await upload(
      'owner',
      new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'image/jpeg' }),
    );
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, huge))).toBe('INVALID_IMAGE');
    expect(await stored(huge.storageId)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("won't parse with someone else's ticket or touch their file", async () => {
    const { as, upload, stored } = await setup();
    mockGemini();
    const theirs = await upload('other', png());
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, theirs))).toBe(
      'INVALID_UPLOAD_TICKET',
    );
    expect(await stored(theirs.storageId)).not.toBeNull();
  });

  it('rate limits OCR per user per day', async () => {
    const { t, ids, as, upload, stored } = await setup();
    const fetchMock = mockGemini();
    await t.run((ctx) =>
      ctx.db.insert('aiUsage', {
        userId: ids.owner,
        kind: 'ocr',
        windowStart: usageWindowStart(Date.now()),
        count: aiLimits.ocr.perDay,
        updatedAt: Date.now(),
      }),
    );
    const blocked = await upload('owner', png());
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, blocked))).toBe(
      'AI_RATE_LIMITED',
    );
    expect(await stored(blocked.storageId)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // Someone else still has their own allowance.
    const allowed = await upload('other', png());
    await expect(as('other').action(api.ai.receipts.parse, allowed)).resolves.toMatchObject({
      amountMinor: 50400n,
    });
  });

  it('surfaces unreadable receipts and still deletes the image', async () => {
    const { as, upload, stored } = await setup();
    mockGemini({ isReceipt: false, items: [], total: null, confidence: {}, warnings: [] });
    const file = await upload('owner', png());
    expect(await codeOf(as('owner').action(api.ai.receipts.parse, file))).toBe(
      'RECEIPT_UNREADABLE',
    );
    expect(await stored(file.storageId)).toBeNull();
  });
});
