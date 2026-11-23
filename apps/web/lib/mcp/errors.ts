import { ConvexError } from 'convex/values';

export type McpToolError = {
  code: string;
  message: string;
  data?: Record<string, unknown>;
};

/** Short, actionable guidance for backend error codes a model is likely to hit. */
const hints: Record<string, string> = {
  AUTH_REQUIRED: 'The Finapp session is no longer valid. Reconnect the integration.',
  NOT_MEMBER: 'You are not a current member of that group.',
  INSUFFICIENT_PERMISSION:
    'You do not have permission for this action (for example only the creator or a group admin can change an expense).',
  TRANSACTION_CHANGED:
    'Someone changed this expense since it was read. Fetch it again with finapp.groups.expenses.get and retry with the new version.',
  OUTSTANDING_BALANCE:
    'This member still has an unsettled balance in the group. Settle up first (see finapp.groups.balances), then retry.',
  ITEMS_TOTAL_MISMATCH: 'The line items must add up exactly to amountMinor.',
  INVALID_SPLIT: 'Participant amounts must add up exactly to the expense total.',
  INVALID_CURRENCY: 'Use the currency of the account or group.',
  INVALID_FILTERS:
    'Check the filters: endAt must be after startAt, the window at most 366 days, and limit 1–100.',
  INVALID_DATE_RANGE: 'endAt must be after startAt and the window at most 366 days.',
  GROUP_ARCHIVED: 'That group is archived.',
  GROUP_NOT_FOUND: 'That group does not exist or is not visible to you.',
  GROUP_UNAVAILABLE: 'That group does not exist or is not visible to you.',
  TRANSACTION_UNAVAILABLE: 'That transaction does not exist or is not visible to you.',
  NOTHING_OWED: 'That member does not currently owe you anything in this group.',
  INVALID_NUDGE_TARGET: 'You can only remind another current or former member of the group.',
  DUPLICATE_MUTATION: 'This change was already applied.',
  DEFAULT_CURRENCY_REQUIRED: 'Set a default currency in your profile first.',
  MISSING_SCOPE: 'This connection was not granted the permission this tool needs.',
};

function codeFromMessage(message: string): string | undefined {
  // Convex prefixes errors with request metadata; the thrown code is the first SCREAMING_CASE
  // token after "Uncaught Error:" or, failing that, anywhere in the message.
  const uncaught = message.match(/Uncaught (?:Convex)?Error:\s*([A-Z][A-Z0-9_]{2,})/);
  if (uncaught) return uncaught[1];
  const any = message.match(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/);
  return any?.[1];
}

/** Normalises Convex/zod/runtime failures into a stable `{ code, message, data }`. */
export function toToolError(error: unknown): McpToolError {
  if (error instanceof ConvexError) {
    const data =
      error.data && typeof error.data === 'object'
        ? (error.data as Record<string, unknown>)
        : { code: String(error.data) };
    const code = typeof data.code === 'string' ? data.code : 'REQUEST_FAILED';
    return { code, message: hints[code] ?? code, data };
  }
  const raw = error instanceof Error ? error.message : 'The request failed.';
  const code = codeFromMessage(raw) ?? 'REQUEST_FAILED';
  return {
    code,
    message: hints[code] ?? (code === 'REQUEST_FAILED' ? 'The request failed.' : code),
  };
}

export function errorText(error: McpToolError): string {
  return `${error.code}: ${error.message}`;
}
