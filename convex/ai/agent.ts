/**
 * The FinAI agent loop, shared by the in-app assistant and `@finai` chat replies. Each round
 * streams one Gemini turn with the available tools; function calls run against the tool list,
 * their results go back as function responses, and the loop ends when the model answers in
 * text (or the step and tool budgets run out, when it is asked to answer without tools).
 *
 * The loop is plain TypeScript over a `ctx` it never inspects, so tests drive it with a fake
 * model and fake tools.
 */
import { ConvexError } from 'convex/values';
import { finaiAgent } from './config';
import type { GeminiSchema } from './gemini';
import {
  streamChat,
  type ChatStreamOptions,
  type ChatStreamResult,
  type GeminiContent,
  type GeminiContentPart,
} from './geminiChat';
import type { FinView } from './a2ui';
import { presentMoney } from './present';

export type AgentStage = 'reasoning' | 'working' | 'searching';
export type AgentProgress = { stage: AgentStage; label: string; tool?: string };

export type AgentToolResult = {
  /** JSON-safe data for the model (bigints are converted by the loop). */
  data: unknown;
  /** Cards to show under the reply. */
  views?: FinView[];
};

export type AgentTool<Ctx> = {
  name: string;
  description: string;
  parameters?: GeminiSchema;
  /** Orb state and caption while the tool runs. */
  progress: AgentProgress;
  run: (ctx: Ctx, args: Record<string, unknown>) => Promise<AgentToolResult>;
};

export type AgentRunOptions<Ctx> = {
  ctx: Ctx;
  system: string;
  contents: GeminiContent[];
  tools: readonly AgentTool<Ctx>[];
  onProgress?: (progress: AgentProgress) => Promise<void> | void;
  /** Called with the full reply text so far whenever it grows. */
  onText?: (text: string) => Promise<void> | void;
  /** Test seam; defaults to the real streaming client. */
  chat?: (options: ChatStreamOptions) => Promise<ChatStreamResult>;
  maxSteps?: number;
  maxToolCalls?: number;
};

export type AgentRunResult = {
  text: string;
  views: FinView[];
  toolsUsed: string[];
  usage: { promptTokens: number; outputTokens: number };
  steps: number;
};

/** A stable error code for a failed tool call (ConvexError code, Error message, or UNKNOWN). */
export function toolErrorCode(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as unknown;
    if (data && typeof data === 'object' && 'code' in data)
      return String((data as { code: unknown }).code);
    if (typeof data === 'string') return data;
  }
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{2,60}$/.test(error.message)) return error.message;
  return 'TOOL_FAILED';
}

function asRecord(value: unknown): Record<string, unknown> {
  const presented = presentMoney(value);
  if (presented && typeof presented === 'object' && !Array.isArray(presented))
    return presented as Record<string, unknown>;
  return { result: presented };
}

export async function runAgent<Ctx>(options: AgentRunOptions<Ctx>): Promise<AgentRunResult> {
  const chat = options.chat ?? streamChat;
  const maxSteps = options.maxSteps ?? finaiAgent.maxSteps;
  const maxToolCalls = options.maxToolCalls ?? finaiAgent.maxToolCalls;
  const byName = new Map(options.tools.map((tool) => [tool.name, tool]));
  const functions = options.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    ...(tool.parameters ? { parameters: tool.parameters } : {}),
  }));
  const contents = [...options.contents];
  const views: FinView[] = [];
  const toolsUsed: string[] = [];
  const usage = { promptTokens: 0, outputTokens: 0 };
  let text = '';
  let toolCalls = 0;
  let steps = 0;

  for (let step = 0; step < maxSteps; step++) {
    steps = step + 1;
    const lastChance = step === maxSteps - 1 || toolCalls >= maxToolCalls;
    await options.onProgress?.({
      stage: 'reasoning',
      label: step === 0 ? 'Thinking…' : 'Putting it together…',
    });
    const prefix = text ? `${text}\n\n` : '';
    let stepText = '';
    const result = await chat({
      role: 'chat',
      systemInstruction: options.system,
      contents,
      functions: lastChance ? undefined : functions,
      onText: async (delta) => {
        stepText += delta;
        if (prefix.length + stepText.length > finaiAgent.maxReplyChars) return;
        await options.onText?.(prefix + stepText);
      },
    });
    usage.promptTokens += result.usage.promptTokens;
    usage.outputTokens += result.usage.outputTokens;
    if (stepText.trim()) text = (prefix + stepText).slice(0, finaiAgent.maxReplyChars);

    if (lastChance || result.functionCalls.length === 0) break;

    contents.push({ role: 'model', parts: result.parts });
    const responses: GeminiContentPart[] = [];
    for (const call of result.functionCalls) {
      const tool = byName.get(call.name);
      let data: Record<string, unknown>;
      if (!tool) data = { error: 'UNKNOWN_TOOL' };
      else if (toolCalls >= maxToolCalls) data = { error: 'TOOL_BUDGET_EXHAUSTED' };
      else {
        toolCalls += 1;
        toolsUsed.push(tool.name);
        await options.onProgress?.({ ...tool.progress, tool: tool.name });
        try {
          const outcome = await tool.run(options.ctx, call.args ?? {});
          data = asRecord(outcome.data);
          if (outcome.views) views.push(...outcome.views);
        } catch (error) {
          data = { error: toolErrorCode(error) };
        }
      }
      responses.push({
        functionResponse: { name: call.name, response: data, ...(call.id ? { id: call.id } : {}) },
      });
    }
    contents.push({ role: 'user', parts: responses });
  }

  return { text: text.trim(), views, toolsUsed, usage, steps };
}
