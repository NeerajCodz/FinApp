/**
 * The single source of AI configuration: which Gemini model plays each role, generation
 * defaults, timeouts and per-user limits. Model ids live only here; everything else asks for a
 * role (`'chat' | 'ocr' | 'decision'`). The API key is the Convex env var `GEMINI_API_KEY` and
 * never leaves the server.
 */

export const aiModels = {
  /** The normal chatbot / LLM. */
  chat: 'gemini-3.8-flash',
  /** Receipt and bill parsing (vision + structured output). */
  ocr: 'gemini-3.5-flash-lite',
  /**
   * Classification after OCR (e.g. a scanned receipt's category). `gemini-decision-1` answers
   * typed questions with probabilities through `POST /v1beta/decisions` (`./decisions.ts`); it
   * does not generate text.
   */
  decision: 'gemini-decision-1',
  /** Small text jobs such as conversation titles. */
  utility: 'gemini-3.5-flash-lite',
} as const;

export type AiRole = keyof typeof aiModels;
export type AiModelId = (typeof aiModels)[AiRole];

/**
 * Models tried in order after the primary one when it is overloaded (429 / 5xx) or
 * unreachable, before anything has streamed.
 */
export const aiFallbackModels: Record<AiRole, readonly string[]> = {
  chat: ['gemini-3.6-flash', 'gemini-flash-latest'],
  ocr: ['gemini-3.1-flash-lite'],
  /** A different API: no text-model fallback. */
  decision: [],
  utility: ['gemini-3.1-flash-lite'],
};

/** The primary model for a role followed by its fallbacks. */
export function aiModelChain(role: AiRole): readonly string[] {
  return [aiModels[role], ...aiFallbackModels[role]];
}

/** The model for a given attempt: walk the chain, then start over from the primary. */
export function aiModelForAttempt(role: AiRole, attempt: number): string {
  const chain = aiModelChain(role);
  return chain[attempt % chain.length]!;
}

/** Attempts per request: every model in the chain at least once, plus the configured retries. */
export function aiAttempts(role: AiRole): number {
  return Math.max(aiRetry.retries + 1, aiModelChain(role).length);
}

/**
 * Wait before the next attempt only when the chain has wrapped back to the primary model;
 * moving on to a fallback model is immediate.
 */
export function aiShouldBackoff(role: AiRole, attempt: number): boolean {
  return (attempt + 1) % aiModelChain(role).length === 0;
}

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';

/** Per-role generation defaults; callers may override `temperature` and `maxOutputTokens`. */
export const aiGeneration: Record<
  AiRole,
  { temperature: number; maxOutputTokens: number; timeoutMs: number }
> = {
  chat: { temperature: 0.7, maxOutputTokens: 8192, timeoutMs: 30_000 },
  ocr: { temperature: 0, maxOutputTokens: 4096, timeoutMs: 45_000 },
  /** Only `timeoutMs` applies (the decisions API has no generation settings). */
  decision: { temperature: 0, maxOutputTokens: 1, timeoutMs: 10_000 },
  utility: { temperature: 0.2, maxOutputTokens: 256, timeoutMs: 10_000 },
};

/** Retries on 429 / 5xx / network errors: attempts after the first, with exponential backoff. */
export const aiRetry = { retries: 2, baseDelayMs: 600, maxDelayMs: 4_000 } as const;

/** Usage kinds counted per user per UTC day (`aiUsage` table). */
export const aiLimits = {
  ocr: { perDay: 30 },
  chat: { perDay: 200 },
  decision: { perDay: 400 },
  utility: { perDay: 400 },
} as const;
export type AiUsageKind = keyof typeof aiLimits;

/** Receipt uploads: images only, at most 8 MB, parsed within 15 minutes of the upload ticket. */
export const receiptUpload = {
  maxBytes: 8 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  ticketTtlMs: 15 * 60 * 1000,
} as const;

/** FinAI agent loop: the in-app assistant and `@finai` replies in chats. */
export const finaiAgent = {
  /** Gemini rounds per reply (each round may call several tools). */
  maxSteps: 6,
  /** Tool calls per reply across all rounds. */
  maxToolCalls: 12,
  /** Earlier turns of an assistant conversation sent as history. */
  historyTurns: 24,
  /** Recent thread messages given to an `@finai` reply as context. */
  mentionContextMessages: 30,
  /** Streamed text is written to the message at most this often. */
  streamFlushMs: 250,
  /** Longest reply the agent may produce, in characters. */
  maxReplyChars: 6_000,
  /** Longest user prompt, in characters. */
  maxPromptChars: 4_000,
  /** Confirmation cards expire after this long. */
  actionTtlMs: 30 * 60 * 1000,
  /** Confirmation cards one reply may propose (each stays reachable in the UI). */
  maxProposals: 5,
  /** A confirmation stuck in `running` this long (interrupted) may be confirmed again. */
  staleRunningMs: 2 * 60 * 1000,
  /** A thread can have one FinAI reply in progress; mentions inside this window are ignored. */
  mentionCooldownMs: 4_000,
} as const;

/** The mention handle that summons FinAI in group chats and DMs (case-insensitive). */
export const FINAI_HANDLE = 'finai';
