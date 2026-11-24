/**
 * Classification with `gemini-decision-1` (the `decision` role). It does not generate text: it
 * answers typed questions about an input with probabilities, through `POST /v1beta/decisions`.
 *
 * - `noul` questions answer yes/no as a probability (`noul`, 0..1).
 * - `choice` questions pick one key of `criteria` (`choice`, with per-key `probabilities`).
 *
 * Used after OCR to classify a scanned receipt (its category). Server-only.
 */
import { aiGeneration, aiModels, aiRetry, GEMINI_API_BASE } from './config';
import { aiError } from './errors';
import { backoff, defaultSleep, requireGeminiKey, RETRYABLE } from './gemini';

export type DecisionQuestion =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> };

export type DecisionAnswer =
  | { type: 'noul'; noul: number; confidence: number }
  | { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> };

export type DecideOptions<Q extends Record<string, DecisionQuestion>> = {
  input: string;
  questions: Q;
  timeoutMs?: number;
  /** Test seams. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
};

export type DecideResult<Q> = {
  answers: { [K in keyof Q]?: DecisionAnswer };
  model: string;
  totalTokens: number;
};

export const DECISIONS_URL = `${GEMINI_API_BASE}/decisions`;

function readAnswer(raw: unknown): DecisionAnswer | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const confidence = typeof value.confidence === 'number' ? value.confidence : 0;
  if (value.type === 'noul' && typeof value.noul === 'number')
    return { type: 'noul', noul: value.noul, confidence };
  if (value.type === 'choice' && typeof value.choice === 'string') {
    const probabilities: Record<string, number> = {};
    if (value.probabilities && typeof value.probabilities === 'object')
      for (const [key, p] of Object.entries(value.probabilities as Record<string, unknown>))
        if (typeof p === 'number') probabilities[key] = p;
    return { type: 'choice', choice: value.choice, confidence, probabilities };
  }
  return undefined;
}

/** Asks `gemini-decision-1` the questions about `input`. Retries 429 / 5xx / network errors. */
export async function decide<Q extends Record<string, DecisionQuestion>>(
  options: DecideOptions<Q>,
): Promise<DecideResult<Q>> {
  const apiKey = requireGeminiKey(options.apiKey);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? aiGeneration.decision.timeoutMs;
  const model = aiModels.decision;
  const body = JSON.stringify({ model, input: options.input, questions: options.questions });
  let lastFailure: 'busy' | 'unavailable' | 'timeout' = 'unavailable';
  for (let attempt = 0; attempt <= aiRetry.retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(DECISIONS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timer);
      lastFailure = controller.signal.aborted ? 'timeout' : 'unavailable';
      console.warn('[ai] decision request failed', lastFailure, String(cause));
      if (attempt < aiRetry.retries) await sleep(backoff(attempt, null));
      continue;
    }
    clearTimeout(timer);
    if (RETRYABLE.has(response.status)) {
      lastFailure = response.status === 429 ? 'busy' : 'unavailable';
      if (attempt < aiRetry.retries)
        await sleep(backoff(attempt, response.headers.get('retry-after')));
      continue;
    }
    if (!response.ok) {
      console.warn('[ai] decision rejected', response.status);
      throw aiError('AI_REQUEST_REJECTED');
    }
    let payload: { answers?: Record<string, unknown>; usage?: { total_tokens?: number } };
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      throw aiError('AI_BAD_RESPONSE');
    }
    const answers: { [K in keyof Q]?: DecisionAnswer } = {};
    for (const key of Object.keys(options.questions) as (keyof Q & string)[]) {
      const answer = readAnswer(payload.answers?.[key]);
      if (answer) answers[key] = answer;
    }
    return { answers, model, totalTokens: payload.usage?.total_tokens ?? 0 };
  }
  throw aiError(
    lastFailure === 'busy'
      ? 'AI_BUSY'
      : lastFailure === 'timeout'
        ? 'AI_TIMEOUT'
        : 'AI_UNAVAILABLE',
  );
}

/** Below this probability a classification is only a hint, not pre-filled. */
export const DECISION_MIN_CONFIDENCE = 0.6;

/**
 * The category a receipt most likely belongs to, chosen among the user's own categories, or
 * null when none fits confidently. Criteria keys are the category ids.
 */
export async function classifyReceiptCategory(
  receipt: { merchant: string | null; title: string; items: readonly { title: string }[] },
  categories: readonly { id: string; name: string; notes?: string }[],
  options: Omit<DecideOptions<never>, 'input' | 'questions'> = {},
): Promise<{ categoryId: string; confidence: number } | null> {
  const choices = categories.slice(0, 60);
  if (!choices.length) return null;
  const criteria: Record<string, string> = {};
  for (const category of choices)
    criteria[category.id] = category.notes ? `${category.name}: ${category.notes}` : category.name;
  const input = [
    receipt.merchant ? `Merchant: ${receipt.merchant}` : null,
    `Title: ${receipt.title}`,
    receipt.items.length
      ? `Items: ${receipt.items
          .slice(0, 30)
          .map((item) => item.title)
          .join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
  const result = await decide({
    ...options,
    input,
    questions: {
      category: {
        type: 'choice',
        instructions: 'Which spending category does this purchase belong to?',
        criteria,
      },
    },
  });
  const answer = result.answers.category;
  if (!answer || answer.type !== 'choice' || !(answer.choice in criteria)) return null;
  return answer.confidence >= DECISION_MIN_CONFIDENCE
    ? { categoryId: answer.choice, confidence: answer.confidence }
    : null;
}
