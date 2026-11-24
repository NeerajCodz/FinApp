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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type Turn = { text?: string; call?: { name: string; args?: Record<string, unknown> } };

/** Streams scripted Gemini turns (one per streamGenerateContent call) and a title for others. */
function mockGemini(turns: Turn[]) {
  const queue = [...turns];
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const target = String(url);
    if (!target.includes('streamGenerateContent'))
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: 'Monthly check-in' }] }, finishReason: 'STOP' },
          ],
        }),
        { status: 200 },
      );
    const turn = queue.shift() ?? { text: 'Done.' };
    const part = turn.call
      ? { functionCall: { name: turn.call.name, args: turn.call.args ?? {} } }
      : { text: turn.text };
    const body = `data: ${JSON.stringify({
      candidates: [{ content: { role: 'model', parts: [part] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 },
    })}\n\n`;
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  });
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

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const user = (email: string, displayName: string) =>
      ctx.db.insert('users', {
        email,
        displayName,
        emailVerificationTime: now,
        defaultCurrency: 'USD',
      });
    const ownerId = await user('owner@example.com', 'Olive');
    const memberId = await user('member@example.com', 'Max');
    const outsiderId = await user('outsider@example.com', 'Otto');
    const account = (ownerId: Id<'users'>) =>
      ctx.db.insert('accounts', {
        ownerId,
        name: 'Checking',
        type: 'bank',
        currency: 'USD',
        openingBalanceMinor: 100_000n,
        isIncludedInTotal: true,
        createdAt: now,
        updatedAt: now,
      });
    const ownerAccountId = await account(ownerId);
    await account(memberId);
    const groupId = await ctx.db.insert('groups', {
      ownerId,
      name: 'Trip',
      currency: 'USD',
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('groupMembers', { groupId, userId: ownerId, role: 'owner', joinedAt: now });
    await ctx.db.insert('groupMembers', {
      groupId,
      userId: memberId,
      role: 'member',
      joinedAt: now,
    });
    const [low, high] = [ownerId, memberId].sort() as [Id<'users'>, Id<'users'>];
    const conversationId = await ctx.db.insert('directConversations', {
      userLowId: low,
      userHighId: high,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, memberId, outsiderId, ownerAccountId, groupId, conversationId };
  });
  const as = (id: string) => t.withIdentity({ subject: `${id}|session` });
  return { t, ids, owner: as(ids.ownerId), member: as(ids.memberId), outsider: as(ids.outsiderId) };
}

const page = { numItems: 20, cursor: null };

describe('FinAI assistant', () => {
  it('answers with tools, streams into the reply, attaches cards and names the chat', async () => {
    const { owner } = await fixture();
    const fetchMock = mockGemini([
      { call: { name: 'get_overview', args: { days: 30 } } },
      { text: 'Your balance is $1,000.00.' },
    ]);
    const { conversationId, replyId } = await owner.action(api.ai.assistant.send, {
      text: 'How am I doing?',
    });
    const messages = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    const reply = messages.page.find((row) => row.id === replyId)!;
    expect(reply).toMatchObject({
      role: 'assistant',
      status: 'done',
      text: 'Your balance is $1,000.00.',
    });
    const a2ui = JSON.parse(reply.a2ui!);
    expect(a2ui[0].createSurface.catalogId).toContain('finapp');
    expect(
      a2ui[1].updateComponents.components.map((c: { component: string }) => c.component),
    ).toContain('SummaryCard');
    // The function response went back to the model with formatted money.
    const second = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string);
    const response = second.contents.at(-1).parts[0].functionResponse.response;
    expect(response.totals[0]).toMatchObject({ currency: 'USD', balanceFormatted: '$1,000.00' });
    const conversations = await owner.query(api.ai.assistant.conversations, {});
    expect(conversations[0]).toMatchObject({ id: conversationId, title: 'Monthly check-in' });
  });

  it('keeps conversations private and records failures on the reply', async () => {
    const { owner, outsider } = await fixture();
    mockGemini([{ text: 'Hi!' }]);
    const { conversationId } = await owner.action(api.ai.assistant.send, { text: 'hello' });
    const foreign = await outsider.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    expect(foreign.page).toEqual([]);
    expect(
      await codeOf(outsider.action(api.ai.assistant.send, { conversationId, text: 'peek' })),
    ).toBe('CONVERSATION_NOT_FOUND');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 403 })),
    );
    const { replyId } = await owner.action(api.ai.assistant.send, {
      conversationId,
      text: 'again',
    });
    const rows = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    expect(rows.page.find((row) => row.id === replyId)).toMatchObject({
      status: 'error',
      errorCode: 'AI_REQUEST_REJECTED',
    });
  });

  it('opens an empty conversation for streaming and titles it from the first prompt', async () => {
    const { owner } = await fixture();
    const conversationId = await owner.mutation(api.ai.assistant.createConversation, {});
    expect(await owner.query(api.ai.assistant.conversations, {})).toEqual([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) =>
        String(url).includes('streamGenerateContent')
          ? new Response(
              `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Sure.' }] }, finishReason: 'STOP' }] })}

`,
              { status: 200 },
            )
          : new Response('no', { status: 404 }),
      ),
    );
    await owner.action(api.ai.assistant.send, { conversationId, text: 'Plan my week' });
    const [row] = await owner.query(api.ai.assistant.conversations, {});
    expect(row).toMatchObject({ id: conversationId, title: 'Plan my week', preview: 'Sure.' });
  });

  it('reports AI_NOT_CONFIGURED without a key', async () => {
    const { owner } = await fixture();
    vi.stubEnv('GEMINI_API_KEY', '');
    expect(await codeOf(owner.action(api.ai.assistant.send, { text: 'hi' }))).toBe(
      'AI_NOT_CONFIGURED',
    );
    expect(await owner.query(api.ai.assistant.status, {})).toMatchObject({ available: false });
  });

  it('only writes after the user confirms, once', async () => {
    const { t, ids, owner, member } = await fixture();
    mockGemini([
      { call: { name: 'propose_transaction', args: { title: 'Lunch', amount: '12.50' } } },
      { text: 'Review and confirm the card.' },
    ]);
    const { conversationId, replyId } = await owner.action(api.ai.assistant.send, {
      text: 'add lunch 12.50',
    });
    const before = await t.run((ctx) => ctx.db.query('transactions').collect());
    expect(before).toHaveLength(0);
    const rows = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    const [card] = rows.page.find((row) => row.id === replyId)!.actions;
    expect(card).toMatchObject({ status: 'pending', canDecide: true, title: 'Add expense: Lunch' });

    expect(await codeOf(member.action(api.ai.actions.confirm, { actionId: card!.id }))).toBe(
      'ACTION_NOT_FOUND',
    );
    expect(await owner.action(api.ai.actions.confirm, { actionId: card!.id })).toMatchObject({
      status: 'done',
    });
    const created = await t.run((ctx) => ctx.db.query('transactions').collect());
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      title: 'Lunch',
      amountMinor: 1250n,
      accountId: ids.ownerAccountId,
      type: 'expense',
    });
    expect(await codeOf(owner.action(api.ai.actions.confirm, { actionId: card!.id }))).toBe(
      'ACTION_ALREADY_DECIDED',
    );
  });

  it('lets the user cancel a proposal and expires stale ones', async () => {
    const { t, owner } = await fixture();
    mockGemini([
      { call: { name: 'propose_transaction', args: { title: 'Taxi', amount: '9' } } },
      { text: 'Confirm?' },
    ]);
    const { conversationId, replyId } = await owner.action(api.ai.assistant.send, {
      text: 'taxi 9',
    });
    const rows = await owner.query(api.ai.assistant.messages, {
      conversationId,
      paginationOpts: page,
    });
    const [card] = rows.page.find((row) => row.id === replyId)!.actions;
    expect(await owner.mutation(api.ai.actions.cancel, { actionId: card!.id })).toBe('cancelled');
    expect(await codeOf(owner.action(api.ai.actions.confirm, { actionId: card!.id }))).toBe(
      'ACTION_ALREADY_DECIDED',
    );
    await t.run((ctx) => ctx.db.patch(card!.id, { status: 'pending', expiresAt: Date.now() - 1 }));
    expect(await codeOf(owner.action(api.ai.actions.confirm, { actionId: card!.id }))).toBe(
      'ACTION_EXPIRED',
    );
  });
});

describe('@finai in chats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const drain = (t: Awaited<ReturnType<typeof fixture>>['t']) =>
    t.finishAllScheduledFunctions(vi.runAllTimers);
  async function replyFor(
    t: Awaited<ReturnType<typeof fixture>>['t'],
    table: 'groupMessages' | 'directMessages',
  ) {
    return t.run(async (ctx) => {
      const rows = await ctx.db.query(table).collect();
      return rows.find((row) => row.kind === 'ai')!;
    });
  }

  it('posts a thinking bubble, answers from the shared ledger, and shows it to every member', async () => {
    const { t, ids, owner, member } = await fixture();
    // An expense so there is something to explain: Olive paid $30 for both.
    await owner.mutation(api.groups.mutations.addExpense, {
      groupId: ids.groupId,
      accountId: ids.ownerAccountId,
      title: 'Dinner',
      amountMinor: 3000n,
      currency: 'USD',
      occurredAt: Date.now() - 1000,
      participants: [
        { userId: ids.ownerId, amountMinor: 1500n, method: 'equal' },
        { userId: ids.memberId, amountMinor: 1500n, method: 'equal' },
      ],
      clientMutationId: 'dinner-1',
    });
    const promptId = await owner.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: '@finai who owes whom?',
    });
    const placeholder = await replyFor(t, 'groupMessages');
    expect(placeholder).toMatchObject({
      senderId: ids.ownerId,
      ai: { status: 'pending', stage: 'reasoning', promptMessageId: String(promptId) },
    });

    const fetchMock = mockGemini([
      { call: { name: 'group_ledger' } },
      { text: 'Max owes Olive $15.00.' },
    ]);
    await drain(t);
    const firstRequest = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(firstRequest.contents[0].parts[0].text).toContain('Olive asks you: who owes whom?');
    const ledgerResponse = JSON.parse(fetchMock.mock.calls[1]![1]!.body as string).contents.at(-1)
      .parts[0].functionResponse.response;
    expect(ledgerResponse.transfers[0]).toMatchObject({
      fromName: 'Max',
      toName: 'Olive',
      amountFormatted: '$15.00',
    });
    // No private data: the chat tools never read accounts.
    expect(JSON.stringify(ledgerResponse)).not.toContain('Checking');

    const seenByMember = await member.query(api.groups.queries.chatMessagesPage, {
      groupId: String(ids.groupId),
      paginationOpts: page,
    });
    const reply = seenByMember.page.find((row) => row.kind === 'ai')!;
    expect(reply).toMatchObject({ text: 'Max owes Olive $15.00.' });
    expect(reply.ai).toMatchObject({ status: 'done', isRequester: false });
    expect(JSON.parse(reply.ai!.a2ui!)[1].updateComponents.components[1].component).toBe(
      'BalanceList',
    );
  });

  it('lets only the requester confirm a split FinAI prepared in the group', async () => {
    const { t, ids, owner, member } = await fixture();
    mockGemini([
      { call: { name: 'propose_group_expense', args: { title: 'Groceries', amount: '40' } } },
      { text: 'Olive, confirm the card to add it.' },
    ]);
    await owner.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: '@finai split 40 for groceries',
    });
    await drain(t);
    const memberView = await member.query(api.groups.queries.chatMessagesPage, {
      groupId: String(ids.groupId),
      paginationOpts: page,
    });
    const card = memberView.page.find((row) => row.kind === 'ai')!.ai!.actions[0]!;
    expect(card).toMatchObject({ status: 'pending', canDecide: false });
    expect(await codeOf(member.action(api.ai.actions.confirm, { actionId: card.id }))).toBe(
      'ACTION_NOT_FOUND',
    );
    expect(await owner.action(api.ai.actions.confirm, { actionId: card.id })).toMatchObject({
      status: 'done',
    });
    const balances = await member.query(api.groups.queries.balances, {
      groupId: String(ids.groupId),
    });
    expect(balances!.transfers).toEqual([
      { fromUserId: String(ids.memberId), toUserId: String(ids.ownerId), amountMinor: 2000n },
    ]);
  });

  it('answers in DMs and ignores messages without a mention', async () => {
    const { t, ids, owner } = await fixture();
    await owner.mutation(api.directMessages.mutations.sendText, {
      conversationId: ids.conversationId,
      text: 'no bot here, email me at a@finai.com',
    });
    expect(await replyFor(t, 'directMessages')).toBeFalsy();
    await owner.mutation(api.directMessages.mutations.sendText, {
      conversationId: ids.conversationId,
      text: '@finai what do we share?',
    });
    const placeholder = await replyFor(t, 'directMessages');
    expect(placeholder.ai).toMatchObject({ status: 'pending', requesterId: ids.ownerId });
    // A second mention while the first is running does not start another reply.
    await owner.mutation(api.directMessages.mutations.sendText, {
      conversationId: ids.conversationId,
      text: '@finai hello?',
    });
    const aiRows = await t.run(async (ctx) =>
      (await ctx.db.query('directMessages').collect()).filter((row) => row.kind === 'ai'),
    );
    expect(aiRows).toHaveLength(1);
  });

  it('posts an error bubble when FinAI is not configured', async () => {
    const { t, ids, member } = await fixture();
    vi.stubEnv('GEMINI_API_KEY', '');
    await member.mutation(api.groups.mutations.sendChatText, {
      groupId: ids.groupId,
      text: '@finai help',
    });
    expect((await replyFor(t, 'groupMessages')).ai).toMatchObject({
      status: 'error',
      errorCode: 'AI_NOT_CONFIGURED',
    });
  });
});
