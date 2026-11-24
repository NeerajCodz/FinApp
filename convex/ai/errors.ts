import { ConvexError } from 'convex/values';

/**
 * Error codes AI features throw, as `ConvexError({ code, message })` so the code and a readable
 * message survive to the client in production. Clients map the code to their own copy.
 */
export const aiErrorCodes = [
  /** `GEMINI_API_KEY` is not set on the deployment. */
  'AI_NOT_CONFIGURED',
  /** The user hit their daily limit for this kind of request. */
  'AI_RATE_LIMITED',
  /** Gemini kept answering 429 after retries. */
  'AI_BUSY',
  /** Gemini returned 5xx or the network failed after retries. */
  'AI_UNAVAILABLE',
  'AI_TIMEOUT',
  /** The prompt or answer was blocked (safety, recitation, …). */
  'AI_BLOCKED',
  /** The answer was cut off (max tokens). */
  'AI_TRUNCATED',
  /** The answer was empty, not JSON, or failed validation. */
  'AI_BAD_RESPONSE',
  /** Gemini rejected the request (bad model id, key or payload: 400/401/403/404). */
  'AI_REQUEST_REJECTED',
  'INVALID_IMAGE',
  'INVALID_UPLOAD_TICKET',
  /** The image did not look like a receipt with a readable total. */
  'RECEIPT_UNREADABLE',
] as const;
export type AiErrorCode = (typeof aiErrorCodes)[number];
export type AiErrorData = { code: AiErrorCode; message: string; retryAfterMs?: number };

const defaultMessages: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: 'AI features are not set up on this server yet.',
  AI_RATE_LIMITED: 'You have reached today’s limit for this AI feature. Try again tomorrow.',
  AI_BUSY: 'The AI service is busy right now. Try again in a moment.',
  AI_UNAVAILABLE: 'The AI service is unavailable right now. Try again in a moment.',
  AI_TIMEOUT: 'The AI service took too long to answer. Try again.',
  AI_BLOCKED: 'The AI service declined to process this request.',
  AI_TRUNCATED: 'The AI answer was cut short. Try again.',
  AI_BAD_RESPONSE: 'The AI service returned something unexpected. Try again.',
  AI_REQUEST_REJECTED: 'The AI service rejected the request.',
  INVALID_IMAGE: 'Choose a JPEG, PNG, WebP or HEIC image up to 8 MB.',
  INVALID_UPLOAD_TICKET: 'This upload expired. Choose the image again.',
  RECEIPT_UNREADABLE: 'We couldn’t find a total on this image. Try a clearer photo.',
};

export function aiError(
  code: AiErrorCode,
  message = defaultMessages[code],
  extra: { retryAfterMs?: number } = {},
): ConvexError<AiErrorData> {
  return new ConvexError<AiErrorData>({ code, message, ...extra });
}

/** The AI error code carried by `error`, if any. */
export function aiErrorCode(error: unknown): AiErrorCode | null {
  const data =
    error instanceof ConvexError ? (error.data as unknown) : (error as { data?: unknown })?.data;
  const code =
    data && typeof data === 'object' && 'code' in data ? (data as { code: unknown }).code : null;
  return typeof code === 'string' && (aiErrorCodes as readonly string[]).includes(code)
    ? (code as AiErrorCode)
    : null;
}
