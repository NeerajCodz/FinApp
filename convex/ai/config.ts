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
   * Routing: does a message need tools, which intent is it, does a write need confirmation.
   * This is the product owner's configured id, kept verbatim (spaces included); request URLs
   * URL-encode it.
   */
  decision: 'gemini decision 1',
} as const;

export type AiRole = keyof typeof aiModels;
export type AiModelId = (typeof aiModels)[AiRole];

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';

/** Per-role generation defaults; callers may override `temperature` and `maxOutputTokens`. */
export const aiGeneration: Record<
  AiRole,
  { temperature: number; maxOutputTokens: number; timeoutMs: number }
> = {
  chat: { temperature: 0.7, maxOutputTokens: 2048, timeoutMs: 30_000 },
  ocr: { temperature: 0, maxOutputTokens: 4096, timeoutMs: 45_000 },
  decision: { temperature: 0, maxOutputTokens: 512, timeoutMs: 10_000 },
};

/** Retries on 429 / 5xx / network errors: attempts after the first, with exponential backoff. */
export const aiRetry = { retries: 2, baseDelayMs: 600, maxDelayMs: 4_000 } as const;

/** Usage kinds counted per user per UTC day (`aiUsage` table). */
export const aiLimits = {
  ocr: { perDay: 30 },
  chat: { perDay: 200 },
  decision: { perDay: 400 },
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
  /** A thread can have one FinAI reply in progress; mentions inside this window are ignored. */
  mentionCooldownMs: 4_000,
} as const;

/** The mention handle that summons FinAI in group chats and DMs (case-insensitive). */
export const FINAI_HANDLE = 'finai';
