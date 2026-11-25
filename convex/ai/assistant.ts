/**
 * The in-app FinAI assistant. `send` is an action the signed-in client calls: it stores the
 * prompt and an assistant placeholder, runs the agent loop with the user's own auth (so tools
 * read through the app's public queries), streams the reply text into the placeholder, then
 * attaches A2UI cards. Clients subscribe to `messages` and see each step live.
 */
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { api, internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import { action, internalMutation, mutation, query, type QueryCtx } from '../_generated/server';
import { getOptionalUser, requireUser } from '../shared/auth';
import { buildA2uiMessages } from './a2ui';
import { actionViews } from './actions';
import { applyStep, runAgent, type AgentProgress, type AgentStep } from './agent';
import { assistantTools } from './assistantTools';
import { aiLimits, finaiAgent } from './config';
import { aiError, aiErrorCode } from './errors';
import { generateText, isGeminiConfigured } from './gemini';
import type { GeminiContent, GeminiContentPart } from './geminiChat';
import { assistantSystemPrompt } from './prompts';
import { finaiPreferencePrompt, finaiToolAllowed } from '../shared/finaiSettings';
import { chatForUser } from './keys';
import { manageTools } from './manageTools';
import { importTools } from './importTools';
import { createStreamWriter } from './streamWriter';
import { deleteConversationAttachments, linkAttachments, presentAttachment } from './attachments';
import { attachmentParts } from './attachmentContent';
import { finaiStage, finaiStep } from './validators';
import { consumeAiQuota } from './usage';

const TITLE_FALLBACK_CHARS = 48;

/** Whether FinAI can answer on this deployment, and today's limit. */
export const status = query({
  args: {},
  handler: async () => ({ available: isGeminiConfigured(), dailyLimit: aiLimits.chat.perDay }),
});

export const conversations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const user = await getOptionalUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query('finaiConversations')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(Math.max(1, Math.min(100, Math.floor(limit ?? 30))));
    // Conversations opened but never used have no preview; keep them out of the list.
    const now = Date.now();
    return rows
      .filter((row) => row.preview !== undefined)
      .map((row) => ({
        id: row._id,
        title: row.title ?? 'New chat',
        preview: row.preview ?? '',
        updatedAt: row.updatedAt,
        unread: row.unreadAt !== undefined,
        working: isWorking(row, now),
      }));
  },
});

/** A reply older than this without any update is treated as abandoned (the action died). */
const REPLY_STALE_MS = 6 * 60_000;

function isWorking(row: Doc<'finaiConversations'>, now: number) {
  return row.working === true && now - row.updatedAt < REPLY_STALE_MS;
}

/**
 * FinAI activity for the launcher, tabs and sidebar: whether a reply is being written, how many
 * chats have unseen replies, and the newest finished reply (clients toast it when it changes and
 * that chat isn't on screen). Replies keep going after the chat is closed.
 */
export const activity = query({
  args: {},
  handler: async (ctx) => {
    const user = await getOptionalUser(ctx);
    if (!user) return { working: false, unreadCount: 0, latest: null };
    const rows = await ctx.db
      .query('finaiConversations')
      .withIndex('by_user_updatedAt', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(50);
    const now = Date.now();
    const unread = rows.filter((row) => row.unreadAt !== undefined);
    const newest = unread.reduce<Doc<'finaiConversations'> | null>(
      (best, row) => (!best || row.unreadAt! > best.unreadAt! ? row : best),
      null,
    );
    return {
      working: rows.some((row) => isWorking(row, now)),
      unreadCount: unread.length,
      latest:
        newest && newest.lastReplyId
          ? {
              conversationId: newest._id,
              replyId: newest.lastReplyId,
              title: newest.title ?? 'New chat',
              preview: newest.lastReplyFailed ? '' : (newest.preview ?? ''),
              failed: newest.lastReplyFailed === true,
              at: newest.unreadAt!,
            }
          : null,
    };
  },
});

/** Marks a conversation's replies as seen (the chat is open on screen). */
export const markRead = mutation({
  args: { conversationId: v.id('finaiConversations') },
  handler: async (ctx, { conversationId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== user._id) return null;
    if (conversation.unreadAt !== undefined)
      await ctx.db.patch(conversationId, { unreadAt: undefined });
    return null;
  },
});

type PresentedAttachment = Awaited<ReturnType<typeof presentAttachment>>;

function shapeMessage(
  row: Doc<'finaiMessages'>,
  actions: Awaited<ReturnType<typeof actionViews>>,
  attachments: Map<string, PresentedAttachment[]>,
) {
  const files = attachments.get(String(row._id));
  return {
    id: row._id,
    role: row.role,
    text: row.text,
    status: row.status,
    ...(row.stage ? { stage: row.stage } : {}),
    ...(row.stageLabel ? { stageLabel: row.stageLabel } : {}),
    ...(row.steps?.length ? { steps: row.steps } : {}),
    ...(row.a2ui ? { a2ui: row.a2ui } : {}),
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    actions: actions.get(String(row._id)) ?? [],
    ...(files?.length ? { attachments: files } : {}),
    createdAt: row.createdAt,
  };
}

/** Newest-first pages of one conversation, with each reply's confirmation-card states. */
export const messages = query({
  args: { conversationId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { conversationId, paginationOpts }) => {
    const empty = { page: [], isDone: true, continueCursor: '' };
    const user = await getOptionalUser(ctx);
    const id = ctx.db.normalizeId('finaiConversations', conversationId);
    if (!user || !id) return empty;
    const conversation = await ctx.db.get(id);
    if (!conversation || conversation.userId !== user._id) return empty;
    const result = await ctx.db
      .query('finaiMessages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', id))
      .order('desc')
      .paginate(paginationOpts);
    const actions = await actionViews(
      ctx,
      result.page.filter((row) => row.role === 'assistant').map((row) => String(row._id)),
      user._id,
    );
    const attachments = new Map<string, PresentedAttachment[]>();
    for (const row of result.page) {
      if (!row.attachments?.length) continue;
      const files = await Promise.all(row.attachments.map((id) => ctx.db.get(id)));
      attachments.set(
        String(row._id),
        await Promise.all(
          files
            .filter((file): file is Doc<'finaiAttachments'> => !!file && file.userId === user._id)
            .map((file) => presentAttachment(ctx, file)),
        ),
      );
    }
    return {
      ...result,
      page: result.page.map((row) => shapeMessage(row, actions, attachments)),
    };
  },
});

export const deleteConversation = mutation({
  args: { conversationId: v.id('finaiConversations') },
  handler: async (ctx, { conversationId }) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.userId !== user._id) return null;
    const rows = await ctx.db
      .query('finaiMessages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId))
      .collect();
    for (const row of rows) {
      const actions = await ctx.db
        .query('finaiActions')
        .withIndex('by_message', (q) => q.eq('messageId', String(row._id)))
        .collect();
      // The user deleted the chat: drop the stored payloads (notes, amounts, people) too.
      // A confirmation that is mid-write finishes on its own; its row is then simply gone.
      for (const stored of actions) await ctx.db.delete(stored._id);
      await ctx.db.delete(row._id);
    }
    await deleteConversationAttachments(ctx, conversationId);
    await ctx.db.delete(conversationId);
    return conversationId;
  },
});

/** An empty conversation, so the client can open the thread before the first reply streams. */
export const createConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const now = Date.now();
    return ctx.db.insert('finaiConversations', {
      userId: user._id,
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** An earlier turn for the model: its text plus the files it carried (by name and id). */
async function turnText(ctx: { db: QueryCtx['db'] }, row: Doc<'finaiMessages'>) {
  if (!row.attachments?.length) return row.text;
  const files = await Promise.all(row.attachments.map((id) => ctx.db.get(id)));
  const names = files
    .filter((file): file is Doc<'finaiAttachments'> => !!file)
    .map(
      (file) =>
        `"${file.name}" (id: ${file._id}, ${file.kind}${file.deletedAt !== undefined ? ', deleted' : ''})`,
    );
  return `${row.text}${row.text ? '\n' : ''}[Attached: ${names.join(', ')}]`;
}

/**
 * Stores the prompt and an assistant placeholder (creating the conversation if needed), after
 * counting one chat request. Returns the earlier turns for the model.
 */
export const begin = internalMutation({
  args: {
    conversationId: v.optional(v.id('finaiConversations')),
    text: v.string(),
    attachmentIds: v.optional(v.array(v.id('finaiAttachments'))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!user) throw new Error('AUTH_REQUIRED');
    const text = args.text.trim();
    const attachmentIds = args.attachmentIds ?? [];
    if ((!text && !attachmentIds.length) || text.length > finaiAgent.maxPromptChars)
      throw new Error('INVALID_PROMPT');
    // An attachment-only message is titled and previewed by its first file's name.
    const firstFile = attachmentIds.length ? await ctx.db.get(attachmentIds[0]!) : null;
    const label =
      text || (firstFile && firstFile.userId === user._id ? `📎 ${firstFile.name}` : '📎 Files');
    const now = Date.now();
    let conversationId = args.conversationId;
    if (conversationId) {
      const conversation = await ctx.db.get(conversationId);
      if (!conversation || conversation.userId !== user._id)
        throw new Error('CONVERSATION_NOT_FOUND');
      const busy = await ctx.db
        .query('finaiMessages')
        .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId!))
        .order('desc')
        .first();
      if (
        busy &&
        (busy.status === 'pending' || busy.status === 'streaming') &&
        now - busy.updatedAt < REPLY_STALE_MS
      )
        throw new Error('REPLY_IN_PROGRESS');
    }
    await consumeAiQuota(ctx, user._id, 'chat', now);
    const title =
      label.length > TITLE_FALLBACK_CHARS ? `${label.slice(0, TITLE_FALLBACK_CHARS - 1)}…` : label;
    if (!conversationId)
      conversationId = await ctx.db.insert('finaiConversations', {
        userId: user._id,
        title,
        preview: label.slice(0, 120),
        createdAt: now,
        updatedAt: now,
      });
    const hasMessages = !!(await ctx.db
      .query('finaiMessages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId!))
      .first());
    const isNew = !hasMessages;
    await ctx.db.patch(conversationId, {
      updatedAt: now,
      preview: label.slice(0, 120),
      working: true,
      unreadAt: undefined,
      ...(isNew ? { title } : {}),
    });

    const earlier = await ctx.db
      .query('finaiMessages')
      .withIndex('by_conversation_createdAt', (q) => q.eq('conversationId', conversationId!))
      .order('desc')
      .take(finaiAgent.historyTurns);
    const promptId = await ctx.db.insert('finaiMessages', {
      conversationId,
      userId: user._id,
      role: 'user',
      text,
      status: 'done',
      createdAt: now,
      updatedAt: now,
    });
    const linked = await linkAttachments(ctx, {
      userId: user._id,
      conversationId,
      messageId: promptId,
      attachmentIds,
      now,
    });
    if (linked.length) await ctx.db.patch(promptId, { attachments: linked });
    const replyId = await ctx.db.insert('finaiMessages', {
      conversationId,
      userId: user._id,
      role: 'assistant',
      text: '',
      status: 'pending',
      stage: 'reasoning',
      stageLabel: 'Thinking…',
      createdAt: now + 1,
      updatedAt: now,
    });
    return {
      conversationId,
      replyId,
      isNew,
      userId: user._id,
      attachmentIds: linked,
      history: await Promise.all(
        earlier
          .reverse()
          .filter((row) => row.status === 'done' && (row.text.trim() || row.attachments?.length))
          .map(async (row) => ({ role: row.role, text: await turnText(ctx, row) })),
      ),
    };
  },
});

export const progress = internalMutation({
  args: {
    replyId: v.id('finaiMessages'),
    stage: finaiStage,
    label: v.string(),
    steps: v.optional(v.array(finaiStep)),
  },
  handler: async (ctx, { replyId, stage, label, steps }) => {
    const row = await ctx.db.get(replyId);
    if (!row || row.status === 'done' || row.status === 'error') return;
    await ctx.db.patch(replyId, {
      stage,
      stageLabel: label,
      ...(steps ? { steps } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const streamText = internalMutation({
  args: { replyId: v.id('finaiMessages'), text: v.string() },
  handler: async (ctx, { replyId, text }) => {
    const row = await ctx.db.get(replyId);
    if (!row || row.status === 'done' || row.status === 'error') return;
    await ctx.db.patch(replyId, { text, status: 'streaming', updatedAt: Date.now() });
  },
});

export const complete = internalMutation({
  args: {
    replyId: v.id('finaiMessages'),
    text: v.string(),
    a2ui: v.optional(v.string()),
    toolsUsed: v.array(v.string()),
  },
  handler: async (ctx, { replyId, text, a2ui, toolsUsed }) => {
    const row = await ctx.db.get(replyId);
    if (!row) return;
    const now = Date.now();
    await ctx.db.patch(replyId, {
      text,
      status: 'done',
      stage: undefined,
      stageLabel: undefined,
      ...(a2ui ? { a2ui } : {}),
      toolsUsed,
      updatedAt: now,
    });
    await ctx.db.patch(row.conversationId, {
      updatedAt: now,
      preview: text.slice(0, 120),
      working: false,
      unreadAt: now,
      lastReplyId: replyId,
      lastReplyFailed: false,
    });
  },
});

export const fail = internalMutation({
  args: { replyId: v.id('finaiMessages'), errorCode: v.string(), text: v.optional(v.string()) },
  handler: async (ctx, { replyId, errorCode, text }) => {
    const row = await ctx.db.get(replyId);
    if (!row) return;
    await ctx.db.patch(replyId, {
      status: 'error',
      errorCode,
      stage: undefined,
      stageLabel: undefined,
      ...(text !== undefined ? { text } : {}),
      updatedAt: Date.now(),
    });
    const now = Date.now();
    await ctx.db.patch(row.conversationId, {
      updatedAt: now,
      working: false,
      unreadAt: now,
      lastReplyId: replyId,
      lastReplyFailed: true,
    });
  },
});

export const setTitle = internalMutation({
  args: { conversationId: v.id('finaiConversations'), title: v.string() },
  handler: async (ctx, { conversationId, title }) => {
    const row = await ctx.db.get(conversationId);
    if (row) await ctx.db.patch(conversationId, { title });
  },
});

export const consumeUtility = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await consumeAiQuota(ctx, userId, 'utility');
  },
});

/** Merges consecutive turns of one role so Gemini sees strictly alternating history. */
export function historyContents(
  history: readonly { role: 'user' | 'assistant'; text: string }[],
  prompt: string,
  attachments: GeminiContentPart[] = [],
): GeminiContent[] {
  const contents: GeminiContent[] = [];
  const current = prompt || (attachments.length ? 'Please look at the attached files.' : prompt);
  for (const turn of [...history, { role: 'user' as const, text: current }]) {
    const role = turn.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: turn.text });
    else contents.push({ role, parts: [{ text: turn.text }] });
  }
  while (contents[0]?.role === 'model') contents.shift();
  // Files sent with this message go with the prompt (earlier ones are named in their turn).
  if (attachments.length) contents[contents.length - 1]!.parts.push(...attachments);
  return contents;
}

/** A short title from the `utility` model; best effort, the prompt prefix stays otherwise. */
async function nameConversation(prompt: string, reply: string): Promise<string | null> {
  try {
    const result = await generateText({
      role: 'utility',
      systemInstruction:
        'Write a title of at most 5 words for this finance chat. Reply with the title only, no quotes or punctuation at the end.',
      parts: [{ text: `User: ${prompt.slice(0, 500)}\nAssistant: ${reply.slice(0, 500)}` }],
      maxOutputTokens: 256,
    });
    const title = result.text.replace(/["“”]/g, '').split('\n')[0]!.trim();
    return title && title.length <= 60 ? title : null;
  } catch {
    return null;
  }
}

export const send = action({
  args: {
    conversationId: v.optional(v.id('finaiConversations')),
    text: v.string(),
    attachmentIds: v.optional(v.array(v.id('finaiAttachments'))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ conversationId: Id<'finaiConversations'>; replyId: Id<'finaiMessages'> }> => {
    const settings = await ctx.runQuery(api.ai.settings.get, {});
    if (!settings.enabled) throw aiError('AI_DISABLED');
    const myId = await ctx.runQuery(internal.ai.keys.me, {});
    const byok = myId ? await chatForUser(ctx, myId) : { markInvalid: async () => undefined };
    if (!isGeminiConfigured() && !byok.chat) throw aiError('AI_NOT_CONFIGURED');
    const started = await ctx.runMutation(internal.ai.assistant.begin, args);
    const { conversationId, replyId } = started;
    try {
      const [me, accounts, groups] = await Promise.all([
        ctx.runQuery(api.users.queries.current, {}),
        ctx.runQuery(api.accounts.queries.list, {}),
        ctx.runQuery(api.mcp.listGroups, { paginationOpts: { numItems: 30, cursor: null } }),
      ]);
      const defaultCurrency = me?.defaultCurrency ?? 'INR';
      const timezone = me?.timezone ?? 'UTC';
      const baseSystem = assistantSystemPrompt({
        name: me?.displayName ?? me?.name ?? 'the user',
        today: new Date().toLocaleDateString('en-CA', { timeZone: timezone }),
        timezone,
        defaultCurrency,
        accounts: accounts.map((row) => ({
          id: String(row.id),
          name: row.name,
          currency: row.currency,
        })),
        groups: (groups.items as { id: string; name: string; currency: string }[]).map((row) => ({
          id: String(row.id),
          name: row.name,
          currency: row.currency,
        })),
      });
      const system = `${baseSystem}

${finaiPreferencePrompt(settings)}`;
      let steps: AgentStep[] = [];
      // Live text goes out on its own cadence so the model stream never waits on a write.
      const live = createStreamWriter(
        (text) => ctx.runMutation(internal.ai.assistant.streamText, { replyId, text }),
        finaiAgent.streamFlushMs,
      );
      const result = await runAgent({
        ctx: {
          run: ctx,
          userId: started.userId,
          scope: { type: 'assistant', id: String(conversationId) },
          messageId: String(replyId),
          defaultCurrency,
          timeZone: timezone,
        },
        system,
        ...(byok.chat ? { chat: byok.chat } : {}),
        contents: historyContents(
          started.history,
          args.text.trim(),
          started.attachmentIds.length
            ? await attachmentParts(
                ctx,
                await ctx.runQuery(internal.ai.attachments.forModel, {
                  userId: started.userId,
                  ids: started.attachmentIds,
                }),
              )
            : [],
        ),
        tools: [...assistantTools, ...manageTools, ...importTools].filter((tool) =>
          finaiToolAllowed(settings, tool.name),
        ),
        onProgress: async (step: AgentProgress) => {
          const next = applyStep(steps, step);
          if (next) steps = next;
          await ctx.runMutation(internal.ai.assistant.progress, {
            replyId,
            stage: step.stage,
            label: step.label,
            ...(next ? { steps: next } : {}),
          });
        },
        onText: (text) => live.push(text),
      });
      await live.drain();
      const a2ui = buildA2uiMessages(`finai-${replyId}`, result.views);
      await ctx.runMutation(internal.ai.assistant.complete, {
        replyId,
        text: result.text || (a2ui ? 'Here’s what I found.' : 'I couldn’t find an answer to that.'),
        ...(a2ui ? { a2ui: JSON.stringify(a2ui) } : {}),
        toolsUsed: result.toolsUsed,
      });
      await ctx.runMutation(internal.ai.usage.recordTokens, {
        userId: started.userId,
        kind: 'chat',
        promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.outputTokens,
      });
      if (started.isNew) {
        try {
          await ctx.runMutation(internal.ai.assistant.consumeUtility, { userId: started.userId });
          const title = await nameConversation(args.text, result.text);
          if (title)
            await ctx.runMutation(internal.ai.assistant.setTitle, { conversationId, title });
        } catch {
          // Titles are optional; the prompt prefix stays.
        }
      }
    } catch (error) {
      const errorCode = aiErrorCode(error) ?? 'AI_UNAVAILABLE';
      if (errorCode === 'AI_KEY_INVALID') await byok.markInvalid();
      console.warn('[ai] FinAI reply failed', errorCode, String(error));
      await ctx.runMutation(internal.ai.assistant.fail, { replyId, errorCode });
    }
    return { conversationId, replyId };
  },
});
