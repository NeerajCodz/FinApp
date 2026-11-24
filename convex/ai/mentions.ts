/**
 * `@finai` in group chats and DMs. The send mutations call `maybeScheduleFinaiReply` after
 * storing a message: when it mentions @finai it posts a FinAI placeholder bubble (kind `ai`,
 * Thinking Orb state, counted against the asker's daily chat limit) and schedules
 * `runReply`, which builds the thread's shared context, runs the agent with chat-scoped tools
 * and streams the answer into that bubble.
 */
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import { internalAction, internalMutation, type MutationCtx } from '../_generated/server';
import { buildA2uiMessages } from './a2ui';
import { runAgent } from './agent';
import { chatTools } from './chatTools';
import { FINAI_HANDLE, finaiAgent } from './config';
import { aiErrorCode, type AiErrorCode } from './errors';
import { isGeminiConfigured } from './gemini';
import type { GeminiContent } from './geminiChat';
import { chatSystemPrompt } from './prompts';
import { consumeAiQuota } from './usage';
import { finaiReplyStatus, finaiStage } from './validators';

const mentionPattern = new RegExp(`(^|[^\\w@])@${FINAI_HANDLE}\\b`, 'i');

/** Whether a chat message mentions @finai (not as part of an email or another handle). */
export function mentionsFinai(text: string | undefined): boolean {
  return !!text && mentionPattern.test(text);
}

/** The question with the mention removed, or the whole text when nothing else remains. */
export function stripMention(text: string): string {
  const stripped = text.replace(new RegExp(`@${FINAI_HANDLE}\\b[,:]?`, 'gi'), '').trim();
  return stripped || text.trim();
}

type Scope =
  | { type: 'group'; id: Id<'groups'>; expiresAt?: number }
  | { type: 'direct'; id: Id<'directConversations'> };

async function insertReply(
  ctx: MutationCtx,
  scope: Scope,
  requesterId: Id<'users'>,
  promptMessageId: string,
  createdAt: number,
  ai: { status: 'pending' | 'error'; errorCode?: AiErrorCode },
) {
  const state = {
    requesterId,
    promptMessageId,
    status: ai.status,
    ...(ai.status === 'pending'
      ? { stage: 'reasoning' as const, stageLabel: 'Thinking…' }
      : { errorCode: ai.errorCode }),
  };
  if (scope.type === 'group') {
    const id = await ctx.db.insert('groupMessages', {
      groupId: scope.id,
      senderId: requesterId,
      kind: 'ai',
      text: '',
      createdAt,
      ...(scope.expiresAt !== undefined ? { expiresAt: scope.expiresAt } : {}),
      ai: state,
    });
    if (scope.expiresAt !== undefined)
      await ctx.scheduler.runAt(scope.expiresAt, internal.groups.mutations.deleteExpiredMessage, {
        messageId: id,
      });
    return String(id);
  }
  return String(
    await ctx.db.insert('directMessages', {
      conversationId: scope.id,
      senderId: requesterId,
      kind: 'ai',
      text: '',
      createdAt,
      ai: state,
    }),
  );
}

async function replyInProgress(ctx: MutationCtx, scope: Scope, now: number) {
  const recent =
    scope.type === 'group'
      ? await ctx.db
          .query('groupMessages')
          .withIndex('by_group_createdAt', (q) =>
            q.eq('groupId', scope.id).gte('createdAt', now - 120_000),
          )
          .collect()
      : await ctx.db
          .query('directMessages')
          .withIndex('by_conversation_createdAt', (q) =>
            q.eq('conversationId', scope.id).gte('createdAt', now - 120_000),
          )
          .collect();
  return recent.some(
    (message) =>
      message.kind === 'ai' &&
      (message.ai?.status === 'pending' ||
        message.ai?.status === 'streaming' ||
        now - message.createdAt < finaiAgent.mentionCooldownMs),
  );
}

/**
 * Called by the chat send mutations. Returns the FinAI reply message id when a reply was
 * scheduled (or an error bubble posted), null when the message does not mention @finai or a
 * reply is already running in the thread.
 */
export async function maybeScheduleFinaiReply(
  ctx: MutationCtx,
  scope: Scope,
  requesterId: Id<'users'>,
  promptMessageId: string,
  text: string,
  createdAt: number,
): Promise<string | null> {
  if (!mentionsFinai(text)) return null;
  if (await replyInProgress(ctx, scope, createdAt)) return null;
  const replyAt = createdAt + 1;
  if (!isGeminiConfigured())
    return insertReply(ctx, scope, requesterId, promptMessageId, replyAt, {
      status: 'error',
      errorCode: 'AI_NOT_CONFIGURED',
    });
  try {
    await consumeAiQuota(ctx, requesterId, 'chat', createdAt);
  } catch {
    return insertReply(ctx, scope, requesterId, promptMessageId, replyAt, {
      status: 'error',
      errorCode: 'AI_RATE_LIMITED',
    });
  }
  const replyId = await insertReply(ctx, scope, requesterId, promptMessageId, replyAt, {
    status: 'pending',
  });
  await ctx.scheduler.runAfter(0, internal.ai.mentions.runReply, {
    scopeType: scope.type,
    scopeId: String(scope.id),
    requesterId,
    replyId,
    prompt: text,
    promptCreatedAt: createdAt,
  });
  return replyId;
}

const scopeType = v.union(v.literal('group'), v.literal('direct'));

/** Patches the FinAI state (and optionally text) of a reply bubble. */
export const patchReply = internalMutation({
  args: {
    scopeType,
    replyId: v.string(),
    text: v.optional(v.string()),
    status: v.optional(finaiReplyStatus),
    stage: v.optional(finaiStage),
    stageLabel: v.optional(v.string()),
    a2ui: v.optional(v.string()),
    errorCode: v.optional(v.string()),
  },
  handler: async (ctx, { scopeType: type, replyId, text, ...patch }) => {
    const id =
      type === 'group'
        ? ctx.db.normalizeId('groupMessages', replyId)
        : ctx.db.normalizeId('directMessages', replyId);
    if (!id) return;
    const message = await ctx.db.get(id);
    if (!message || message.kind !== 'ai' || !message.ai) return;
    if (message.ai.status === 'done' || message.ai.status === 'error') return;
    const finished = patch.status === 'done' || patch.status === 'error';
    const ai = {
      ...message.ai,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.stage ? { stage: patch.stage } : {}),
      ...(patch.stageLabel ? { stageLabel: patch.stageLabel } : {}),
      ...(patch.a2ui ? { a2ui: patch.a2ui } : {}),
      ...(patch.errorCode ? { errorCode: patch.errorCode } : {}),
    };
    if (finished) {
      delete ai.stage;
      delete ai.stageLabel;
    }
    await ctx.db.patch(id, { ai, ...(text !== undefined ? { text } : {}) });
    if (finished && 'conversationId' in message)
      await ctx.db.patch(message.conversationId, { updatedAt: Date.now() });
  },
});

function transcript(
  messages: readonly { sender: string; text: string; id: string }[],
  promptId: string | null,
): string {
  return messages
    .filter((message) => message.id !== promptId && message.text.trim())
    .map((message) => `${message.sender}: ${message.text}`)
    .join('\n');
}

export const runReply = internalAction({
  args: {
    scopeType,
    scopeId: v.string(),
    requesterId: v.id('users'),
    replyId: v.string(),
    prompt: v.string(),
    promptCreatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const patch = (fields: Omit<Parameters<typeof patchArgs>[0], 'scopeType' | 'replyId'>) =>
      ctx.runMutation(
        internal.ai.mentions.patchReply,
        patchArgs({
          scopeType: args.scopeType,
          replyId: args.replyId,
          ...fields,
        }),
      );
    try {
      const snapshot = await ctx.runQuery(internal.ai.chatContext.threadSnapshot, {
        scopeType: args.scopeType,
        scopeId: args.scopeId,
        requesterId: args.requesterId,
        beforeCreatedAt: args.promptCreatedAt,
        limit: finaiAgent.mentionContextMessages,
      });
      if (!snapshot) {
        await patch({ status: 'error', errorCode: 'NOT_MEMBER' });
        return;
      }
      const groups = snapshot.group
        ? [snapshot.group]
        : snapshot.sharedGroups.map((g) => ({ ...g, id: String(g.id) }));
      const system = chatSystemPrompt({
        scope: args.scopeType,
        title: snapshot.title,
        today: new Date().toISOString().slice(0, 10),
        requesterName: snapshot.requesterName,
        participants: snapshot.participants,
        groups,
      });
      const promptMessage = snapshot.messages[snapshot.messages.length - 1];
      const promptId =
        promptMessage && promptMessage.createdAt === args.promptCreatedAt ? promptMessage.id : null;
      const history = transcript(snapshot.messages, promptId);
      const contents: GeminiContent[] = [
        {
          role: 'user',
          parts: [
            {
              text: `${history ? `Recent messages in this chat (oldest first):\n${history}\n\n` : ''}${snapshot.requesterName} asks you: ${stripMention(args.prompt)}`,
            },
          ],
        },
      ];
      let lastFlush = 0;
      const result = await runAgent({
        ctx: {
          run: ctx,
          userId: args.requesterId,
          scope: { type: args.scopeType, id: args.scopeId },
          messageId: args.replyId,
          defaultCurrency: snapshot.group?.currency ?? snapshot.sharedGroups[0]?.currency ?? 'INR',
        },
        system,
        contents,
        tools: chatTools({
          viewerIds: snapshot.participants.map((p) => p.id as Id<'users'>),
          groupId: snapshot.group?.id ?? null,
          sharedGroupIds: snapshot.sharedGroups.map((g) => String(g.id)),
        }),
        onProgress: async (step) => {
          await patch({ stage: step.stage, stageLabel: step.label });
        },
        onText: async (text) => {
          if (Date.now() - lastFlush < finaiAgent.streamFlushMs) return;
          lastFlush = Date.now();
          await patch({ text, status: 'streaming' });
        },
      });
      const a2ui = buildA2uiMessages(`finai-${args.replyId}`, result.views);
      await patch({
        status: 'done',
        text: result.text || (a2ui ? 'Here’s what I found.' : 'I couldn’t find an answer to that.'),
        ...(a2ui ? { a2ui: JSON.stringify(a2ui) } : {}),
      });
      await ctx.runMutation(internal.ai.usage.recordTokens, {
        userId: args.requesterId,
        kind: 'chat',
        promptTokens: result.usage.promptTokens,
        outputTokens: result.usage.outputTokens,
      });
    } catch (error) {
      const errorCode = aiErrorCode(error) ?? 'AI_UNAVAILABLE';
      console.warn('[ai] @finai reply failed', errorCode, String(error));
      await patch({ status: 'error', errorCode });
    }
  },
});

/** Typed identity for patchReply's arguments (keeps `patch` above checked). */
function patchArgs(value: {
  scopeType: 'group' | 'direct';
  replyId: string;
  text?: string;
  status?: 'pending' | 'streaming' | 'done' | 'error';
  stage?: 'reasoning' | 'working' | 'searching';
  stageLabel?: string;
  a2ui?: string;
  errorCode?: string;
}) {
  return value;
}
